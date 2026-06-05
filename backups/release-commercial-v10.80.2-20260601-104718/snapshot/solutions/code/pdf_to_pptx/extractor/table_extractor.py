"""
表格提取器 — 基于 pdfplumber
"""

import logging
from typing import List
import pdfplumber

from pdf_to_pptx.converter_types import TableBlock

logger = logging.getLogger("pdf_to_pptx")


class TableExtractor:
    """使用 pdfplumber 提取 PDF 表格"""

    def extract_page(self, pdf_path: str, page_num: int) -> List[TableBlock]:
        """
        提取指定页的表格

        Returns:
            List[TableBlock]
        """
        tables = []

        with pdfplumber.open(pdf_path) as pdf:
            page = pdf.pages[page_num - 1]  # 0-indexed

            # 提取所有表格
            table_settings = {
                "vertical_strategy": "lines_strict",
                "horizontal_strategy": "lines_strict",
                "intersection_tolerance": 5,
            }

            found_tables = page.find_tables(table_settings)

            for table in found_tables:
                cells = table.extract()
                if not cells:
                    continue

                rows = len(cells)
                cols = max(len(row) for row in cells) if cells else 0

                bbox = (
                    table.bbox[0],
                    table.bbox[1],
                    table.bbox[2],
                    table.bbox[3],
                )

                tables.append(TableBlock(
                    bbox=bbox,
                    rows=rows,
                    cols=cols,
                    cells=cells,
                    merged_cells=[],  # TODO: 合并单元格检测
                ))

        logger.debug(f"Page {page_num}: extracted {len(tables)} tables")
        return tables
