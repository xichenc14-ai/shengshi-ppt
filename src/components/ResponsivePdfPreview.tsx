'use client';

import { useEffect, useMemo, useState } from 'react';

type ResponsivePdfPreviewProps = {
  src: string;
  fetchSrc?: string;
  title?: string;
};

type RenderedPage = {
  pageNumber: number;
  imageUrl: string;
  width: number;
  height: number;
};

const MAX_RENDER_WIDTH = 900;
const SLIDE_ASPECT_RATIO = 16 / 9;

function getPdfJs() {
  // Keep PDF.js out of the Next/Turbopack bundle. Mobile preview needs the
  // browser build plus a same-origin worker, otherwise iOS/Chrome can fail.
  return Function('return import("/pdfjs/pdf.min.mjs")')() as Promise<any>;
}

function installDomMatrixArraySupport() {
  const CurrentDOMMatrix = window.DOMMatrix || (window as any).WebKitCSSMatrix;
  if (!CurrentDOMMatrix) return;

  try {
    // Some Turbopack/PDF.js polyfills only accept CSS matrix strings, while
    // PDF.js also calls new DOMMatrix([a,b,c,d,e,f]) on complex pages.
    new CurrentDOMMatrix([1, 0, 0, 1, 0, 0]);
    return;
  } catch {
    // Install a small compatibility wrapper below.
  }

  class SafeDOMMatrix extends CurrentDOMMatrix {
    constructor(init?: string | number[] | Float32Array | Float64Array) {
      if (Array.isArray(init) || ArrayBuffer.isView(init)) {
        super();
        this.applyArray(init);
        return;
      }
      super(init);
    }

    applyArray(init: number[] | Float32Array | Float64Array): this {
      const values = Array.from(init).map(Number);
      if (values.length >= 6) {
        this.a = values[0];
        this.b = values[1];
        this.c = values[2];
        this.d = values[3];
        this.e = values[4];
        this.f = values[5];
        this.m11 = values[0];
        this.m12 = values[1];
        this.m21 = values[2];
        this.m22 = values[3];
        this.m41 = values[4];
        this.m42 = values[5];
      }
      return this;
    }

    setMatrixValue(value: string | number[] | Float32Array | Float64Array): this {
      if (Array.isArray(value) || ArrayBuffer.isView(value)) return this.applyArray(value);
      super.setMatrixValue(String(value || ''));
      return this;
    }
  }

  window.DOMMatrix = SafeDOMMatrix as typeof DOMMatrix;
  window.DOMMatrixReadOnly = SafeDOMMatrix as typeof DOMMatrixReadOnly;
}

function findVisibleContentBounds(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d');
  if (!context) return null;

  const { width, height } = canvas;
  const data = context.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const offset = (y * width + x) * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const a = data[offset + 3];
      if (a > 20 && (r < 245 || g < 245 || b < 245)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX <= minX || maxY <= minY) return null;
  return { minX, minY, maxX, maxY };
}

function cropMobileSlideCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  if (canvas.height / canvas.width < 1.15) return canvas;

  const targetHeight = Math.round(canvas.width / SLIDE_ASPECT_RATIO);
  if (targetHeight >= canvas.height) return canvas;

  const bounds = findVisibleContentBounds(canvas);
  const centerY = bounds ? (bounds.minY + bounds.maxY) / 2 : canvas.height / 2;
  const sourceY = Math.max(0, Math.min(canvas.height - targetHeight, Math.round(centerY - targetHeight / 2)));
  const cropped = document.createElement('canvas');
  cropped.width = canvas.width;
  cropped.height = targetHeight;
  const croppedContext = cropped.getContext('2d');
  if (!croppedContext) return canvas;
  croppedContext.drawImage(canvas, 0, sourceY, canvas.width, targetHeight, 0, 0, canvas.width, targetHeight);
  return cropped;
}

export default function ResponsivePdfPreview({ src, fetchSrc, title = 'PDF 预览' }: ResponsivePdfPreviewProps) {
  const previewSrc = src || fetchSrc || '';
  const effectiveFetchSrc = useMemo(() => fetchSrc || src || '', [fetchSrc, src]);
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!effectiveFetchSrc) return;

    let cancelled = false;
    const objectUrls: string[] = [];

    async function renderMobilePreview() {
      setLoading(true);
      setError('');
      setPages([]);
      setCurrentPage(1);

      try {
        const pdfjs = await getPdfJs();
        installDomMatrixArraySupport();
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';

        const response = await fetch(effectiveFetchSrc, { credentials: 'same-origin' });
        if (!response.ok) {
          throw new Error(`PDF 获取失败：${response.status}`);
        }

        const data = await response.arrayBuffer();
        const loadingTask = pdfjs.getDocument({
          data,
          cMapUrl: '/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: '/standard_fonts/',
          disableFontFace: true,
          useSystemFonts: true,
          disableAutoFetch: false,
          disableStream: false,
          isEvalSupported: false,
        });
        const pdf = await loadingTask.promise;
        const renderedPages: RenderedPage[] = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (cancelled) break;

          const page = await pdf.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = Math.min(2, Math.max(1, MAX_RENDER_WIDTH / baseViewport.width));
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) {
            throw new Error('当前浏览器不支持 Canvas 渲染 PDF');
          }

          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          await page.render({
            canvasContext: context,
            viewport,
            annotationMode: pdfjs.AnnotationMode?.DISABLE,
          }).promise;

          const previewCanvas = cropMobileSlideCanvas(canvas);
          const blob: Blob = await new Promise((resolve, reject) => {
            previewCanvas.toBlob((value) => {
              if (value) resolve(value);
              else reject(new Error('PDF 页面转图片失败'));
            }, 'image/png', 0.92);
          });
          const imageUrl = URL.createObjectURL(blob);
          objectUrls.push(imageUrl);
          renderedPages.push({ pageNumber, imageUrl, width: previewCanvas.width, height: previewCanvas.height });

          if (!cancelled) {
            setPages([...renderedPages]);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'PDF 预览加载失败');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    renderMobilePreview();

    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [effectiveFetchSrc]);

  return (
    <>
      <object
        data={previewSrc}
        type="application/pdf"
        className="hidden w-full h-[78vh] bg-white md:block"
        aria-label={title}
      >
        <iframe
          src={previewSrc}
          className="block w-full h-[78vh] bg-white"
          title={title}
        />
        <div className="flex min-h-[78vh] flex-col items-center justify-center gap-4 bg-[#0f1020] px-6 text-center text-white">
          <p className="text-sm text-slate-200">当前浏览器无法直接嵌入 PDF 预览。</p>
          <a
            href={fetchSrc || src}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-full bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-white/20"
          >
            打开 PDF 原文件
          </a>
        </div>
      </object>

      <div className="block md:hidden" data-testid="responsive-pdf-preview-mobile">
        <div className="rounded-[24px] bg-[#0f1020] p-2 shadow-inner shadow-black/15">
          {loading && pages.length === 0 ? (
            <div className="flex min-h-[56vh] items-center justify-center px-6 text-center text-sm text-white/70">
              正在加载 PDF 预览...
            </div>
          ) : null}

          {pages.length > 0 ? (
            <div className="rounded-[18px] bg-[#111325] p-2">
              <div className="sr-only" aria-live="polite">第 {currentPage} / {pages.length} 页</div>

              <div className="relative overflow-hidden rounded-[18px] bg-white shadow-[0_10px_28px_rgba(0,0,0,0.22)]">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage <= 1}
                  aria-label="上一页"
                  className="absolute left-2 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-xl font-semibold text-slate-700 shadow-lg shadow-slate-900/10 backdrop-blur transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(pages.length, prev + 1))}
                  disabled={currentPage >= pages.length}
                  aria-label="下一页"
                  className="absolute right-2 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-xl font-semibold text-slate-700 shadow-lg shadow-slate-900/10 backdrop-blur transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  ›
                </button>

              {pages
                .filter((page) => page.pageNumber === currentPage)
                .map((page) => (
                <figure key={page.pageNumber} className="bg-white">
                  <div className="flex aspect-[16/9] w-full items-center justify-center overflow-hidden bg-white">
                    <img
                      src={page.imageUrl}
                      alt={`第 ${page.pageNumber} 页 PDF 预览`}
                      className="block h-full w-full object-contain"
                      width={page.width}
                      height={page.height}
                      loading={page.pageNumber <= 2 ? 'eager' : 'lazy'}
                    />
                  </div>
                </figure>
              ))}

                <div className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-slate-950/70 px-3 py-1 text-[11px] font-medium text-white backdrop-blur">
                  {currentPage} / {pages.length}
                </div>
              </div>

              <div className="mt-2 flex items-center justify-center gap-1.5">
                {pages.map((page) => (
                  <button
                    key={`dot-${page.pageNumber}`}
                    type="button"
                    aria-label={`跳转到第 ${page.pageNumber} 页`}
                    onClick={() => setCurrentPage(page.pageNumber)}
                    className={`h-1.5 rounded-full transition-all ${
                      page.pageNumber === currentPage
                        ? 'w-5 bg-white'
                        : 'w-1.5 bg-white/35'
                    }`}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="flex min-h-[56vh] flex-col items-center justify-center gap-4 px-6 text-center text-white">
              <p className="text-sm text-rose-100">{error}</p>
              <a
                href={fetchSrc || src}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-white/20"
              >
                打开 PDF 原文件
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
