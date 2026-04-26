import { NextRequest, NextResponse } from 'next/server';
import { selectBestKey } from '@/lib/gamma-key-pool';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';

/**
 * PDF 代理 API - v10.15
 * 
 * GET /api/proxy-pdf?generationId=xxx
 * 
 * 用途：获取PDF文件流供前端PDF.js渲染
 * 流程：
 * 1. 获取Gamma generation状态
 * 2. 调用exports API请求PDF导出
 * 3. 轮询等待导出完成（最多40秒）
 * 4. 返回PDF流给前端
 * 
 * 注意：这是预览用途，不需要attachment header
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const generationId = searchParams.get('generationId');

  if (!generationId) {
    return NextResponse.json({ error: '缺少generationId' }, { status: 400 });
  }

  try {
    const selectedKey = selectBestKey();
    const apiKey = selectedKey.key;

    // 1. 查询 Gamma 生成状态
    const statusRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}`, {
      headers: {
        'X-API-KEY': apiKey,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    if (!statusRes.ok) {
      return NextResponse.json({ error: `获取状态失败: ${statusRes.status}` }, { status: 502 });
    }

    const statusData = await statusRes.json();

    if (statusData.status === 'pending' || statusData.status === 'in_progress' || statusData.status === 'processing') {
      return NextResponse.json({ error: 'PPT仍在生成中', status: 'pending' }, { status: 400 });
    }

    if (statusData.status === 'failed') {
      return NextResponse.json({ error: statusData.error || 'PPT生成失败', status: 'failed' }, { status: 500 });
    }

    // 2. 尝试获取已有的 PDF 导出链接（如果之前已导出）
    let pdfUrl = '';
    
    // 先检查 exportUrl 是否已经是 PDF
    if (statusData.exportUrl && (statusData.exportUrl.toLowerCase().includes('.pdf') || statusData.exportUrl.includes('/pdf/'))) {
      pdfUrl = statusData.exportUrl;
    }

    // 如果没有 PDF URL，调用 exports API 创建导出任务
    if (!pdfUrl) {
      console.log('[ProxyPDF] 尝试创建 PDF 导出任务...');
      
      try {
        const pdfExportRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}/exports`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': apiKey,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          },
          body: JSON.stringify({ format: 'pdf' }),
        });

        if (!pdfExportRes.ok) {
          console.warn('[ProxyPDF] exports API 失败:', pdfExportRes.status);
          // exports API失败，返回PPTX fallback提示
          return NextResponse.json({ 
            error: 'PDF导出不可用，请下载PPTX版本',
            fallbackPptx: true,
            pptxUrl: statusData.exportUrl,
          }, { status: 503 });
        }

        const pdfExportData = await pdfExportRes.json();
        
        // 可能直接返回 URL
        if (pdfExportData.url) {
          pdfUrl = pdfExportData.url;
        } else if (pdfExportData.exportUrl) {
          pdfUrl = pdfExportData.exportUrl;
        } else if (pdfExportData.pdfUrl) {
          pdfUrl = pdfExportData.pdfUrl;
        } else if (pdfExportData.id) {
          // 需要轮询等待导出完成
          const exportId = pdfExportData.id;
          console.log('[ProxyPDF] 开始轮询导出任务:', exportId);
          
          //最多轮询20次（40秒）
          for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 2000)); // 2秒间隔
            
            const checkRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}/exports/${exportId}`, {
              headers: { 
                'X-API-KEY': apiKey, 
                'User-Agent': 'Mozilla/5.0' 
              },
            });
            
            if (!checkRes.ok) {
              console.warn('[ProxyPDF] 查询导出状态失败:', checkRes.status);
              continue;
            }
            
            const checkData = await checkRes.json();
            
            if (checkData.url || checkData.exportUrl || checkData.pdfUrl) {
              pdfUrl = checkData.url || checkData.exportUrl || checkData.pdfUrl;
              console.log('[ProxyPDF] PDF导出完成:', pdfUrl);
              break;
            }
            
            if (checkData.status === 'failed') {
              console.warn('[ProxyPDF] PDF导出任务失败');
              return NextResponse.json({ 
                error: 'PDF导出失败，请下载PPTX版本',
                fallbackPptx: true,
                pptxUrl: statusData.exportUrl,
              }, { status: 500 });
            }
            
            console.log(`[ProxyPDF] 轮询 ${i+1}/20, 状态: ${checkData.status || 'pending'}`);
          }
        }
      } catch (exportErr: any) {
        console.error('[ProxyPDF] exports API异常:', exportErr.message);
        return NextResponse.json({ 
          error: 'PDF导出请求失败',
          fallbackPptx: true,
          pptxUrl: statusData.exportUrl,
        }, { status: 503 });
      }
    }

    // 如果最终没有获取到PDF URL
    if (!pdfUrl) {
      return NextResponse.json({ 
        error: 'PDF导出超时（40秒），建议下载PPTX',
        fallbackPptx: true,
        pptxUrl: statusData.exportUrl,
      }, { status: 504 });
    }

    // 3. 代理获取 PDF 文件
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60秒下载超时
    
    try {
      const pdfRes = await fetch(pdfUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!pdfRes.ok) {
        return NextResponse.json({ error: `PDF下载失败: ${pdfRes.status}` }, { status: 502 });
      }

      // 检查 Content-Type
      const contentType = pdfRes.headers.get('Content-Type') || '';
      if (contentType.includes('application/json')) {
        console.error('[ProxyPDF] Gamma返回JSON而非PDF:', contentType);
        return NextResponse.json({ 
          error: 'PDF格式暂不可用',
          fallbackPptx: true,
        }, { status: 502 });
      }

      const buffer = await pdfRes.arrayBuffer();
      
      // 返回PDF流（inline，用于预览）
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Length': buffer.byteLength.toString(),
          'Cache-Control': 'public, max-age=3600', // 缓存1小时
        },
      });
    } catch (downloadErr: any) {
      clearTimeout(timeout);
      if (downloadErr.name === 'AbortError') {
        return NextResponse.json({ error: 'PDF下载超时', fallbackPptx: true }, { status: 504 });
      }
      throw downloadErr;
    }

  } catch (e: any) {
    console.error('[ProxyPDF] Error:', e.message);
    return NextResponse.json({ error: e.message || 'PDF获取失败', fallbackPptx: true }, { status: 500 });
  }
}