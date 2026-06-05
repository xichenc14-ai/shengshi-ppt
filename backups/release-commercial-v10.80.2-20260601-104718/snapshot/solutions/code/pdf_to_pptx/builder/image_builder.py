"""
图片模块构建器
"""

import os
import uuid
from pptx.util import Emu

from pdf_to_pptx.converter_types import ImageBlock


class ImageBuilder:
    """图片模块构建"""

    def __init__(self, slide, resource_dir: str = "resources"):
        self.slide = slide
        self.resource_dir = resource_dir

    def add_image(self, image_block: ImageBlock) -> None:
        """
        添加模块化图片（可替换/可移除）

        shape.name 格式: "module_image_{uuid}"
        """
        if not os.path.exists(image_block.local_path):
            return  # 文件不存在，跳过

        # 坐标转换（简化版）
        from pdf_to_pptx.utils.coord import pdf_bbox_to_pptx
        left, top, width, height = pdf_bbox_to_pptx(
            image_block.bbox,
            page_height=0,  # TODO: 传入 page_height
        )

        # 设置合理尺寸
        if width <= 0:
            width = Emu(image_block.width * 1000)
        if height <= 0:
            height = Emu(image_block.height * 1000)

        pic = self.slide.shapes.add_picture(
            image_block.local_path,
            left, top, width, height
        )

        # 标记为模块化图片
        pic.name = f"module_image_{uuid.uuid4().hex[:8]}"

        return pic