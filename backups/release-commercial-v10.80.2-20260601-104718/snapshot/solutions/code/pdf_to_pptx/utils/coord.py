"""
坐标转换工具 — PDF PT ↔ PPTX EMU
"""

# ── 常量 ────────────────────────────────────────────────────────────────────────

# PPTX 使用 EMU（English Metric Units）
# 1 PT = 914400 / 72 ≈ 12700 EMU
PT_TO_EMU = 914400 / 72  # ≈ 12700.0
INCH_TO_EMU = 914400
CM_TO_EMU = INCH_TO_EMU / 2.54

# ── 坐标转换 ──────────────────────────────────────────────────────────────────

def pdf_pt_to_pptx_emu(value_pt: float) -> int:
    """PDF PT → PPTX EMU"""
    return int(value_pt * PT_TO_EMU)


def pptx_emu_to_pdf_pt(value_emu: int) -> float:
    """PPTX EMU → PDF PT"""
    return value_emu / PT_TO_EMU


def pdf_bbox_to_pptx(
    bbox: tuple,
    page_height: float,
) -> tuple:
    """
    将 PDF bbox (x0, y0, x1, y1) 转换为 PPTX 坐标 (left, top, width, height)

    PDF 坐标原点在左下，PPTX 原点在左上，但两者 Y 轴方向相同（向下），
    因此 Y 坐标需要用 page_height - y1 进行翻转。

    Args:
        bbox: (x0, y0, x1, y1) in PT
        page_height: PDF 页面高度 in PT

    Returns:
        (left, top, width, height) in EMU
    """
    x0, y0, x1, y1 = bbox

    left = pdf_pt_to_pptx_emu(x0)
    # PDF y1 是上边界，PPTX top 也是上边界，直接用 page_height - y1 翻转
    top = pdf_pt_to_pptx_emu(page_height - y1)
    width = pdf_pt_to_pptx_emu(x1 - x0)
    height = pdf_pt_to_pptx_emu(y1 - y0)

    return left, top, width, height


def inch_to_emu(value_inch: float) -> int:
    """英寸 → EMU"""
    return int(value_inch * INCH_TO_EMU)


def emu_to_pt(value_emu: int) -> float:
    """EMU → PT"""
    return value_emu / PT_TO_EMU
