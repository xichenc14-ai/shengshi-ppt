import { NextRequest, NextResponse } from 'next/server';
import { selectBestKey } from '@/lib/gamma-key-pool';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';
const GAMMA_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * PDF Export API - v10.15
 * 
 * GET /api/export-pdf?generationId=xxx
 * 
 * 流程：
 * 1. 接收generationId
 * 2. 检查generation状态（必须completed）
 * 3. 调用Gamma exports API创建PDF导出任务
 * 4. 轮询等待导出完成（最多40秒）
 * 5. 下载PDF并返回文件流
 * 
 * 认证方式：X-API-KEY header（Gamma API规范）
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const generationId = searchParams.get('generationId');

  if (!generationId) {
    return NextResponse.json({ error: '缺少generationId' }, { status: 400 });
  }

  console.log('[ExportPDF] 开始处理:', generationId);

  try {
    const selectedKey = selectBestKey();
    const apiKey = selectedKey.key;
    console.log('[ExportPDF] 使用Key:', selectedKey.label);

    // Step 1: 检查generation状态
    const statusRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}`, {
      headers: {
        'X-API-KEY': apiKey,
        'User-Agent': GAMMA_UA,
      },
    });

    if (!statusRes.ok) {
      console.error('[ExportPDF] 状态查询失败:', statusRes.status);
      return NextResponse.json({ 
        error: `获取状态失败: ${statusRes.status}`,
        fallbackPptx: true,
      }, { status: 502 });
    }

    const statusData = await statusRes.json();
    console.log('[ExportPDF] Generation状态:', statusData.status);

    // 检查是否已完成
    if (statusData.status === 'pending' || statusData.status === 'in_progress' || statusData.status === 'processing') {
      return NextResponse.json({ 
        error: 'PPT仍在生成中，请稍后再试',
        status: 'pending',
      }, { status: 400 });
    }

    if (statusData.status === 'failed') {
      return NextResponse.json({ 
        error: statusData.error || 'PPT生成失败',
        status: 'failed',
      }, { status: 500 });
    }

    // Step 2: 检查是否已有PDF URL（可能之前已导出）
    // exportUrl格式: https://assets.api.gamma.app/export/pdf/{id}/{hash}/{id}.pdf
    let pdfUrl = '';
    
    if (statusData.exportUrl && statusData.exportUrl.toLowerCase().includes('.pdf')) {
      pdfUrl = statusData.exportUrl;
      console.log('[ExportPDF] 已有PDF URL:', pdfUrl);
    }

    // Step 3: 如果没有PDF URL，调用exports API创建导出任务
    if (!pdfUrl) {
      console.log('[ExportPDF] 创建PDF导出任务...');
      
      const exportRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}/exports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey,  // ⚠️ 使用X-API-KEY，不是Bearer
          'User-Agent': GAMMA_UA,
        },
        body: JSON.stringify({ format: 'pdf' }),
      });

      if (!exportRes.ok) {
        const errText = await exportRes.text();
        console.error('[ExportPDF] exports API失败:', exportRes.status, errText);
        
        // 尝试使用export单数API作为fallback
        console.log('[ExportPDF] 尝试fallback: /export API...');
        const fallbackRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}/export`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': apiKey,
            'User-Agent': GAMMA_UA,
          },
          body: JSON.stringify({ format: 'pdf' }),
        });

        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          pdfUrl = fallbackData.exportUrl || fallbackData.url || fallbackData.pdfUrl;
          console.log('[ExportPDF] Fallback成功:', pdfUrl);
        } else {
          return NextResponse.json({ 
            error: 'PDF导出不可用',
            fallbackPptx: true,
            pptxUrl: statusData.exportUrl,
          }, { status: 503 });
        }
      } else {
        const exportData = await exportRes.json();
        console.log('[ExportPDF] exports响应:', JSON.stringify(exportData));
        
        // 可能直接返回URL
        if (exportData.url) {
          pdfUrl = exportData.url;
        } else if (exportData.exportUrl) {
          pdfUrl = exportData.exportUrl;
        } else if (exportData.pdfUrl) {
          pdfUrl = exportData.pdfUrl;
        } else if (exportData.downloadUrl) {
          pdfUrl = exportData.downloadUrl;
        } else if (exportData.id || exportData.exportId) {
          // 需要轮询等待导出完成
          const exportId = exportData.id || exportData.exportId;
          console.log('[ExportPDF] 开始轮询导出任务:', exportId);
          
          // 最多轮询20次（40秒，每2秒一次）
          for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 2000));
            
            const checkRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}/exports/${exportId}`, {
              headers: { 
                'X-API-KEY': apiKey, 
                'User-Agent': GAMMA_UA,
              },
            });
            
            if (!checkRes.ok) {
              console.warn('[ExportPDF] 查询导出状态失败:', checkRes.status);
              continue;
            }
            
            const checkData = await checkRes.json();
            console.log(`[ExportPDF] 轮询 ${i+1}/20, 状态: ${checkData.status || 'unknown'}`);
            
            // 检查是否有URL
            if (checkData.url || checkData.exportUrl || checkData.pdfUrl || checkData.downloadUrl) {
              pdfUrl = checkData.url || checkData.exportUrl || checkData.pdfUrl || checkData.downloadUrl;
              console.log('[ExportPDF] PDF导出完成:', pdfUrl);
              break;
            }
            
            // 检查是否失败
            if (checkData.status === 'failed' || checkData.error) {
              console.error('[ExportPDF] PDF导出失败:', checkData.error);
              return NextResponse.json({ 
                error: checkData.error || 'PDF导出失败',
                fallbackPptx: true,
                pptxUrl: statusData.exportUrl,
              }, { status: 500 });
            }
            
            // 检查是否完成
            if (checkData.status === 'completed' || checkData.status === 'ready') {
              pdfUrl = checkData.url || checkData.exportUrl || checkData.pdfUrl || checkData.downloadUrl;
              if (pdfUrl) {
                console.log('[ExportPDF] 导出完成:', pdfUrl);
                break;
              }
            }
          }
        }
      }
    }

    // Step 4: 如果最终没有获取到PDF URL
    if (!pdfUrl) {
      console.error('[ExportPDF] PDF导出超时或失败');
      return NextResponse.json({ 
        error: 'PDF导出超时（40秒），建议下载PPTX',
        fallbackPptx: true,
        pptxUrl: statusData.exportUrl,
      }, { status: 504 });
    }

    // Step 5: 下载PDF文件
    console.log('[ExportPDF] 下载PDF:', pdfUrl);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    
    try {
      const pdfRes = await fetch(pdfUrl, {
        headers: { 'User-Agent': GAMMA_UA },
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!pdfRes.ok) {
        console.error('[ExportPDF] PDF下载失败:', pdfRes.status);
        return NextResponse.json({ 
          error: `PDF下载失败: ${pdfRes.status}`,
          fallbackPptx: true,
        }, { status: 502 });
      }

      // 检查Content-Type
      const contentType = pdfRes.headers.get('Content-Type') || '';
      console.log('[ExportPDF] Content-Type:', contentType);
      
      if (contentType.includes('application/json')) {
        console.error('[ExportPDF] Gamma返回JSON而非PDF');
        return NextResponse.json({ 
          error: 'PDF格式暂不可用',
          fallbackPptx: true,
        }, { status: 502 });
      }

      const buffer = await pdfRes.arrayBuffer();
      console.log('[ExportPDF] PDF大小:', buffer.byteLength, 'bytes');
      
      // Step 6: 返回PDF流（inline，用于预览）
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Length': buffer.byteLength.toString(),
          'Cache-Control': 'public, max-age=3600',
        },
      });
      
    } catch (downloadErr: any) {
      clearTimeout(timeout);
      if (downloadErr.name === 'AbortError') {
        return NextResponse.json({ 
          error: 'PDF下载超时',
          fallbackPptx: true,
        }, { status: 504 });
      }
      throw downloadErr;
    }

  } catch (e: any) {
    console.error('[ExportPDF] Error:', e.message);
    return NextResponse.json({ 
      error: e.message || 'PDF获取失败',
      fallbackPptx: true,
    }, { status: 500 });
  }
}