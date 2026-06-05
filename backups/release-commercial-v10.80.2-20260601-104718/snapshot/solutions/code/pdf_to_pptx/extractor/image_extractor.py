"""
图片提取器 — 基于 PyMuPDF
"""

import os
import logging
import hashlib
from typing import List
import fitz  # PyMuPDF

from pdf_to_pptx.converter_types import ImageBlock

logger = logging.getLogger("pdf_to_pptx")


class ImageExtractor:
    """从 PDF 提取内嵌图片"""

    def __init__(self, resource_dir: str = "resources"):
        self.resource_dir = resource_dir
        os.makedirs(resource_dir, exist_ok=True)

    def extract_page(self, pdf_path: str, page_num: int) -> List[ImageBlock]:
        """
        提取指定页的图片

        Returns:
            List[ImageBlock]
        """
        images = []
        doc = fitz.open(pdf_path)
        page = doc[page_num - 1]

        image_list = page.get_images(full=True)

        for img_idx, img in enumerate(image_list):
            xref = img[0]
            try:
                base_image = page.parent.extract_image(xref)
                img_bytes = base_image["image"]
                img_ext = base_image["ext"]
                img_width = base_image["width"]
                img_height = base_image["height"]

                # 生成唯一文件名
                img_hash = hashlib.md5(img_bytes[:1024]).hexdigest()[:8]
                filename = f"slide_{page_num:02d}_img_{img_idx+1:03d}_{img_hash}.{img_ext}"
                img_path = os.path.join(self.resource_dir, filename)

                # 避免重复写入
                if not os.path.exists(img_path):
                    with open(img_path, "wb") as f:
                        f.write(img_bytes)

                # 查找图片位置（PyMuPDF 不直接提供 bbox）
                # 使用页面 mediabox 作为占位
                rect = page.rect
                images.append(ImageBlock(
                    image_id=f"img_{page_num}_{img_idx+1}",
                    local_path=img_path,
                    bbox=(0, 0, rect.width, rect.height),  # TODO: 精确 bbox
                    width=img_width,
                    height=img_height,
                    original_ref=f"xref_{xref}",
                ))

                logger.debug(f"Extracted image: {filename} ({img_width}x{img_height})")

            except Exception as e:
                logger.warning(f"Failed to extract image xref={xref}: {e}")

        doc.close()
        return images
