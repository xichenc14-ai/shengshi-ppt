"""
PDF/图片 转 PPTX 主转换器
"""

import os
import logging
from typing import List, Dict, Optional, Any, Literal

from pdf_to_pptx.converter_types import (
    ConversionResult,
    BatchResult,
    TextBlock,
    ImageBlock,
    ShapeBlock,
    TableBlock,
    PageContent,
)
from pdf_to_pptx.extractor.pdf_extractor import PDFExtractor
from pdf_to_pptx.extractor.table_extractor import TableExtractor
from pdf_to_pptx.extractor.image_extractor import ImageExtractor
from pdf_to_pptx.extractor.color_analyzer import ColorAnalyzer
from pdf_to_pptx.builder.pptx_builder import PPTXBuilder

logger = logging.getLogger("pdf_to_pptx")


class PDFToPPTXError(Exception):
    """基础异常"""
    pass


class PDFParseError(PDFToPPTXError):
    """PDF 解析失败"""
    pass


class PDFPasswordError(PDFToPPTXError):
    """PDF 受密码保护"""
    pass


class PDFToPPTXConverter:
    """
    PDF/图片 转 PPTX 主转换器

    Example:
        converter = PDFToPPTXConverter()
        result = converter.convert("input.pdf", "output.pptx")
        print(result.summary)
    """

    def __init__(
        self,
        dpi: int = 300,
        lang: str = "zh-CN",
        vision_model: bool = True,
        resource_dir: str = "resources",
        on_progress: Optional[callable] = None,
    ):
        """
        Args:
            dpi: PDF 渲染 DPI（用于图片分析和 OCR）
            lang: OCR 语言
            vision_model: 是否启用 AI 视觉分析（MiniMax VL-01）
            resource_dir: 图片资源存储目录名
            on_progress: 进度回调 (current: int, total: int) -> None
        """
        self.dpi = dpi
        self.lang = lang
        self.vision_model = vision_model
        self.resource_dir = resource_dir
        self.on_progress = on_progress

    def convert(
        self,
        input_path: str,
        output_path: str,
        options: Optional[Dict[str, Any]] = None,
    ) -> ConversionResult:
        """
        将 PDF 或图片文件转换为 PPTX

        Args:
            input_path: 输入文件路径（支持 .pdf, .png, .jpg, .jpeg）
            output_path: 输出 PPTX 文件路径
            options: 转换选项

        Returns:
            ConversionResult
        """
        options = options or {}

        # 参数校验
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Input file not found: {input_path}")

        ext = os.path.splitext(input_path)[1].lower()
        if ext not in {".pdf", ".png", ".jpg", ".jpeg"}:
            raise PDFToPPTXError(f"Unsupported format: {ext}")

        # 创建资源目录
        output_dir = os.path.dirname(output_path) or "."
        resource_path = os.path.join(output_dir, self.resource_dir)
        os.makedirs(resource_path, exist_ok=True)

        try:
            # 阶段一：内容提取
            logger.info(f"Extracting content from: {input_path}")
            pages = self._extract_pages(input_path, options)

            # 阶段二：AI 视觉分析（可选）
            if self.vision_model:
                pages = self._analyze_layouts(pages)

            # 阶段三：PPTX 构建
            logger.info(f"Building PPTX: {output_path}")
            builder = PPTXBuilder(
                resource_dir=resource_path,
                options=options,
            )
            builder.build(pages)

            if self.on_progress:
                self.on_progress(len(pages), len(pages))

            builder.save(output_path)

            # 生成结果
            result = ConversionResult(
                status="success",
                total_pages=len(pages),
                slides_created=len(pages),
                images_extracted=sum(len(p.images_extracted or []) for p in pages),
                tables_extracted=sum(len(p.table_blocks or []) for p in pages),
                shapes_extracted=sum(len(p.shape_blocks or []) for p in pages),
            )
            result.calculate_score()
            return result

        except PDFParseError as e:
            logger.error(f"PDF parse error: {e}")
            return ConversionResult(
                status="failed",
                message=str(e),
            )
        except Exception as e:
            logger.error(f"Conversion error: {e}")
            return ConversionResult(
                status="failed",
                message=str(e),
                issues=[f"Unexpected error: {e}"],
            )

    def convert_batch(
        self,
        input_paths: List[str],
        output_dir: str,
        options: Optional[Dict[str, Any]] = None,
    ) -> BatchResult:
        """批量转换"""
        results = []
        for path in input_paths:
            basename = os.path.splitext(os.path.basename(path))[0]
            output_path = os.path.join(output_dir, basename + ".pptx")
            result = self.convert(path, output_path, options)
            results.append(result)

        success = sum(1 for r in results if r.status == "success")
        partial = sum(1 for r in results if r.status == "partial_success")
        failed = sum(1 for r in results if r.status == "failed")

        return BatchResult(
            total_files=len(input_paths),
            success_count=success,
            partial_count=partial,
            failed_count=failed,
            results=results,
        )

    # ──────────────────── private ────────────────────

    def _extract_pages(self, input_path: str, options: Dict) -> List[PageContent]:
        """内容提取"""
        ext = os.path.splitext(input_path)[1].lower()

        if ext == ".pdf":
            return self._extract_from_pdf(input_path, options)
        else:
            # 图片输入 → 作为单页处理
            return self._extract_from_image(input_path, options)

    def _extract_from_pdf(self, pdf_path: str, options: Dict) -> List[PageContent]:
        """从 PDF 提取内容"""
        extractor = PDFExtractor()
        pages = extractor.extract(pdf_path)

        # 提取表格
        if options.get("preserve_tables", True):
            table_ext = TableExtractor()
            for page in pages:
                page.table_blocks = table_ext.extract_page(pdf_path, page.page_number)

        # 提取图片
        if options.get("preserve_images", True):
            img_ext = ImageExtractor()
            for page in pages:
                page.images_extracted = img_ext.extract_page(pdf_path, page.page_number)

        # 色彩分析
        if options.get("preserve_colors", True):
            color_analyzer = ColorAnalyzer()
            for page in pages:
                colors = color_analyzer.analyze_page(pdf_path, page.page_number)
                page.theme_colors = colors

        return pages

    def _extract_from_image(self, image_path: str, options: Dict) -> List[PageContent]:
        """从图片提取内容（调用 AI 视觉分析）"""
        # TODO: 实现图片输入的 AI 布局分析
        raise NotImplementedError("Image input support coming in Phase 5")

    def _analyze_layouts(self, pages: List[PageContent]) -> List[PageContent]:
        """AI 布局分析（MiniMax VL-01）"""
        # TODO: 实现 MiniMax VL-01 布局分析
        # 目前为占位，后续 Phase 5 实现
        return pages
