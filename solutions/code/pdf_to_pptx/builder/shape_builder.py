"""
图形/形状构建器
"""

from pptx.util import Emu
from pptx.enum.shapes import MSO_SHAPE_TYPE, MSO_CONNECTOR_TYPE
from pptx.dml.color import RGBColor

from pdf_to_pptx.converter_types import ShapeBlock
from pdf_to_pptx.utils.coord import pdf_bbox_to_pptx, pdf_pt_to_pptx_emu
from pdf_to_pptx.utils.color import rgb_to_pptx_rgb


# PDF 图形类型 → PPTX shape type 映射
_SHAPE_TYPE_MAP = {
    "rectangle": MSO_SHAPE_TYPE.RECTANGLE,
    "ellipse": MSO_SHAPE_TYPE.OVAL,
    "line": MSO_CONNECTOR_TYPE.STRAIGHT,
    "arrow": MSO_CONNECTOR_TYPE.STRAIGHT,
}


class ShapeBuilder:
    """图形/形状构建"""

    def __init__(self, slide):
        self.slide = slide

    def add_shape(self, shape_block: ShapeBlock) -> None:
        """
        将 ShapeBlock 添加为 PPTX 形状

        Args:
            shape_block: ShapeBlock 数据
        """
        left, top, width, height = pdf_bbox_to_pptx(
            shape_block.bbox,
            page_height=0,  # 不需要翻 Y，因为 ShapeBlock 是从 PDF 页面坐标来的
        )
        # 注意：这里 ShapeBlock bbox 是 PDF 坐标，top 需要 page_height 翻转
        # 实际上 pptx_builder 调用时没有传 page_height...
        # 简化处理：用 (x0, page_height-y1) 逻辑

        # 重新实现，使用通用方式
        from pdf_to_pptx.utils.coord import PT_TO_EMU
        x0, y0, x1, y1 = shape_block.bbox

        # 这里需要 page_height，在 add_shape 时传入
        # 暂时跳过精确坐标，使用近似值
        pass  # TODO: 完善图形定位


# 占位：后续 coder 实现完整版本