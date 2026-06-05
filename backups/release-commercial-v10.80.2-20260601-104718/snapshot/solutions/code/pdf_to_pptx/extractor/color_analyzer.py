"""
色彩分析器 — 从 PDF 提取主题色
"""

import logging
from typing import List, Tuple
import fitz  # PyMuPDF

from pdf_to_pptx.utils.color import fitz_color_to_rgb, dominant_colors

logger = logging.getLogger("pdf_to_pptx")


class ColorAnalyzer:
    """分析 PDF 页面色彩体系"""

    def analyze_page(self, pdf_path: str, page_num: int) -> List[Tuple[int, int, int]]:
        """
        分析页面主色调

        Returns:
            按重要性排序的 RGB 颜色列表
        """
        colors = []

        doc = fitz.open(pdf_path)
        page = doc[page_num - 1]

        # 提取文本颜色
        text_dict = page.get_text("dict")
        for block in text_dict.get("blocks", []):
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    color = span.get("color")
                    if color is not None:
                        rgb = fitz_color_to_rgb(color)
                        if rgb != (255, 255, 255) and rgb != (0, 0, 0):
                            colors.append(rgb)

        # 提取绘图颜色（填充色）
        for drawing in page.get_drawings():
            fill = drawing.get("fill")
            if fill:
                rgb = fitz_color_to_rgb(fill)
                if rgb != (255, 255, 255):
                    colors.append(rgb)

        doc.close()

        # 聚类提取主色
        dominant = dominant_colors(colors, n=5)
        logger.debug(f"Page {page_num}: extracted {len(dominant)} dominant colors")

        return dominant
