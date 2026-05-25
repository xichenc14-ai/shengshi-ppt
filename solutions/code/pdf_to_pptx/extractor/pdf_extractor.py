"""
PDF 文本和图形提取器 — 基于 PyMuPDF
"""

import logging
from typing import List, Tuple
import fitz  # PyMuPDF

from pdf_to_pptx.converter_types import PageContent, TextBlock, ShapeBlock
from pdf_to_pptx.utils.coord import pdf_pt_to_pptx_emu
from pdf_to_pptx.utils.color import fitz_color_to_rgb

logger = logging.getLogger("pdf_to_pptx")


class PDFExtractor:
    """
    使用 PyMuPDF 提取 PDF 内容
    支持：文本块、图形路径、字体信息
    """

    def extract(self, pdf_path: str) -> List[PageContent]:
        """
        提取整份 PDF 的内容

        Args:
            pdf_path: PDF 文件路径

        Returns:
            List[PageContent]
        """
        pages = []
        doc = fitz.open(pdf_path)

        try:
            for page_num in range(doc.page_count):
                page = doc[page_num]
                content = self._extract_page(page, page_num + 1)
                pages.append(content)
        finally:
            doc.close()

        return pages

    def extract_page(self, pdf_path: str, page_num: int) -> PageContent:
        """提取指定页"""
        doc = fitz.open(pdf_path)
        try:
            page = doc[page_num - 1]  # 0-indexed
            return self._extract_page(page, page_num)
        finally:
            doc.close()

    def _extract_page(self, page: fitz.Page, page_num: int) -> PageContent:
        """提取单页内容"""
        rect = page.rect
        content = PageContent(
            page_number=page_num,
            width=rect.width,
            height=rect.height,
        )

        # 提取文本块
        content.text_blocks = self._extract_text(page)

        # 提取矢量图形
        content.shape_blocks = self._extract_shapes(page)

        # 提取字体信息
        content.fonts_used = self._extract_fonts(page)

        # 背景色
        content.background_color = self._extract_background(page)

        return content

    def _extract_text(self, page: fitz.Page) -> List[TextBlock]:
        """提取文本块（带坐标、字体、颜色）"""
        blocks = page.get_text("dict")["blocks"]
        text_blocks = []

        for block in blocks:
            if block.get("type") != 0:  # 0 = text block
                continue

            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    tb = TextBlock(
                        text=span["text"],
                        bbox=(
                            span["bbox"][0],
                            span["bbox"][1],
                            span["bbox"][2],
                            span["bbox"][3],
                        ),
                        font=span["font"],
                        size=span["size"],
                        color=fitz_color_to_rgb(span.get("color", 0)),
                        bold="bold" in span["font"].lower(),
                        italic="italic" in span["font"].lower(),
                        is_title=span["size"] > 14,  # 简单判断
                    )
                    text_blocks.append(tb)

        return text_blocks

    def _extract_shapes(self, page: fitz.Page) -> List[ShapeBlock]:
        """提取矢量图形"""
        drawings = page.get_drawings()
        shapes = []

        for d in drawings:
            # 简化处理：只提取基本矩形/椭圆
            rect = d.get("rect")
            if not rect:
                continue

            shape_type = self._classify_shape(d, rect)
            fill = fitz_color_to_rgb(d.get("fill", None)) if d.get("fill") else None
            stroke = fitz_color_to_rgb(d.get("color", None)) if d.get("color") else None

            shapes.append(ShapeBlock(
                shape_type=shape_type,
                bbox=(rect.x0, rect.y0, rect.x1, rect.y1),
                fill_color=fill,
                line_color=stroke,
                line_width=d.get("width", 0),
            ))

        return shapes

    def _classify_shape(
        self, drawing: dict, rect
    ) -> Literal["rectangle", "ellipse", "line", "arrow", "freeform"]:
        """判断图形类型（简化版）"""
        items = drawing.get("items", [])
        if not items:
            return "rectangle"

        # 简单启发式
        if len(items) == 1:
            type_char = items[0][0]
            if type_char == "l":
                return "line"
            elif type_char == "re":
                # 进一步判断是否为圆
                if abs(rect.width - rect.height) < 5:
                    return "ellipse"
                return "rectangle"

        return "freeform"

    def _extract_fonts(self, page: fitz.Page) -> List[str]:
        """提取字体列表"""
        font_list = page.get_fonts()
        return [f[3] for f in font_list]  # font name at index 3

    def _extract_background(self, page: fitz.Page) -> Tuple[int, int, int]:
        """提取页面背景色"""
        # PyMuPDF 1.23+ 支持
        try:
            bg = page.background
            if bg and bg.n > 0:
                # 返回默认白色
                return (255, 255, 255)
        except Exception:
            pass
        return (255, 255, 255)
