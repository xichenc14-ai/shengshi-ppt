'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// 设置 PDF.js worker
// 使用 CDN 加载 worker，避免打包问题
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

interface PDFPreviewProps {
  generationId: string;
  onClose?: () => void;
}

/**
 * PDF 预览组件 - v10.15
 * 
 * 使用 PDF.js 在浏览器中渲染 PDF
 * 支持：
 * - 多页翻页
 * - 缩放
 * - 加载进度提示
 * - 错误处理 + fallback提示
 */
export default function PDFPreview({ generationId, onClose }: PDFPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fallbackPptx, setFallbackPptx] = useState(false);

  // 加载 PDF
  useEffect(() => {
    if (!generationId) return;

    const loadPDF = async () => {
      setLoading(true);
      setLoadingProgress(10);
      setError(null);
      setFallbackPptx(false);

      try {
        // 通过 API 获取 PDF
        setLoadingProgress(20);
        const res = await fetch(`/api/export-pdf?generationId=${generationId}`);
        
        setLoadingProgress(40);
        
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'PDF获取失败' }));
          if (data.fallbackPptx) {
            setLoading(false);
            setFallbackPptx(true);
            setError(data.error || 'PDF暂不可用，建议下载PPTX');
            return;
          }
          throw new Error(data.error || `PDF获取失败: ${res.status}`);
        }

        // 检查 Content-Type
        const contentType = res.headers.get('Content-Type') || '';
        if (!contentType.includes('application/pdf')) {
          setLoading(false);
          setFallbackPptx(true);
          setError('PDF格式暂不可用，建议下载PPTX');
          return;
        }

        setLoadingProgress(60);
        
        // 获取 ArrayBuffer
        const arrayBuffer = await res.arrayBuffer();
        
        setLoadingProgress(80);
        
        // 用 PDF.js 加载
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setLoadingProgress(100);
        setLoading(false);

        // 渲染第一页
        renderPage(pdf, 1, scale);

      } catch (err: any) {
        console.error('[PDFPreview] 加载失败:', err);
        setLoading(false);
        setError(err.message || 'PDF加载失败');
        setFallbackPptx(true);
      }
    };

    loadPDF();
  }, [generationId]);

  // 渲染指定页
  const renderPage = useCallback(async (pdf: pdfjsLib.PDFDocumentProxy, pageNum: number, renderScale: number) => {
    if (!canvasRef.current) return;

    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: renderScale });

      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: context!,
        viewport: viewport,
        canvas: canvas,
      } as any).promise;

    } catch (err) {
      console.error('[PDFPreview] 渲染失败:', err);
    }
  }, []);

  // 切换页
  useEffect(() => {
    if (pdfDoc && currentPage >= 1 && currentPage <= totalPages) {
      renderPage(pdfDoc, currentPage, scale);
    }
  }, [currentPage, scale, pdfDoc, renderPage]);

  // 翻页
  const goToPrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };
  const goToNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  // 缩放
  const zoomIn = () => setScale(Math.min(scale + 0.25, 3));
  const zoomOut = () => setScale(Math.max(scale - 0.25, 0.5));
  const resetZoom = () => setScale(1.5);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goToPrevPage();
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goToNextPage();
      if (e.key === '+' || e.key === '=') zoomIn();
      if (e.key === '-') zoomOut();
      if (e.key === 'Escape' && onClose) onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages, scale, onClose]);

  // 加载中状态
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
          <div className="mb-4">
            <div className="w-16 h-16 mx-auto border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">正在生成PDF预览...</h3>
          <p className="text-sm text-gray-500 mb-4">
            Gamma需要导出PDF（可能需要40秒）
          </p>
          {/* 进度条 */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div 
              className="bg-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${loadingProgress}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-400">{loadingProgress}%</p>
          {onClose && (
            <button 
              onClick={onClose}
              className="mt-4 text-sm text-gray-500 hover:text-gray-700"
            >
              取消
            </button>
          )}
        </div>
      </div>
    );
  }

  // 错误状态 + fallback提示
  if (error) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">PDF预览不可用</h3>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          
          {fallbackPptx && (
            <div className="bg-orange-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-orange-700">
                💡 建议：下载PPTX文件后，用 Keynote/PowerPoint/WPS 打开即可预览
              </p>
            </div>
          )}
          
          {onClose && (
            <button 
              onClick={onClose}
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              关闭
            </button>
          )}
        </div>
      </div>
    );
  }

  // 正常渲染
  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col z-50">
      {/* 工具栏 */}
      <div className="bg-white/95 border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* 页数 */}
          <div className="text-sm text-gray-600">
            {currentPage} / {totalPages} 页
          </div>
          
          {/* 翻页按钮 */}
          <div className="flex items-center gap-1">
            <button 
              onClick={goToPrevPage}
              disabled={currentPage <= 1}
              className="px-3 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              ←上一页
            </button>
            <button 
              onClick={goToNextPage}
              disabled={currentPage >= totalPages}
              className="px-3 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              下一页→
            </button>
          </div>
        </div>
        
        {/* 缩放控制 */}
        <div className="flex items-center gap-2">
          <button 
            onClick={zoomOut}
            className="px-3 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
          >
            −
          </button>
          <span className="text-sm text-gray-600 w-16 text-center">{Math.round(scale * 100)}%</span>
          <button 
            onClick={zoomIn}
            className="px-3 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
          >
            +
          </button>
          <button 
            onClick={resetZoom}
            className="px-3 py-1 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 transition-all ml-2"
          >
            重置
          </button>
        </div>
        
        {/* 关闭按钮 */}
        {onClose && (
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-all"
          >
            关闭预览
          </button>
        )}
      </div>
      
      {/* PDF渲染区域 */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-gray-900">
        <canvas 
          ref={canvasRef}
          className="bg-white shadow-2xl max-w-full max-h-full"
          style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
        />
      </div>
      
      {/* 底部快捷键提示 */}
      <div className="bg-white/95 border-t px-4 py-2 text-xs text-gray-500 text-center">
        ←→ 翻页 | +/- 缩放 | Esc 关闭
      </div>
    </div>
  );
}