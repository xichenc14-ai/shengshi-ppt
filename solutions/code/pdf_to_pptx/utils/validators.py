"""
质量校验工具

用于验证转换结果的质量
"""

from typing import List, Tuple
import difflib

from pdf_to_pptx.converter_types import ConversionResult


def compute_text_fidelity(original_text: str, rebuilt_text: str) -> float:
    """
    计算文字还原率

    Args:
        original_text: 原始 PDF 提取的文本
        rebuilt_text: PPTX 重建后的文本

    Returns:
        0.0 - 1.0 的相似度
    """
    if not original_text:
        return 0.0

    ratio = difflib.SequenceMatcher(None, original_text, rebuilt_text).ratio()
    return ratio


def compute_editability_rate(editables: int, total: int) -> float:
    """
    计算可编辑率

    Args:
        editables: 可编辑项目数
        total: 总项目数

    Returns:
        0.0 - 1.0
    """
    if total == 0:
        return 0.0
    return editables / total


def compute_layout_iou(
    bbox1: Tuple[float, float, float, float],
    bbox2: Tuple[float, float, float, float],
) -> float:
    """
    计算两个 bbox 的 IoU（Intersection over Union）

    Args:
        bbox1: (x0, y0, x1, y1)
        bbox2: (x0, y0, x1, y1)

    Returns:
        IoU 值 0.0 - 1.0
    """
    x1 = max(bbox1[0], bbox2[0])
    y1 = max(bbox1[1], bbox2[1])
    x2 = min(bbox1[2], bbox2[2])
    y2 = min(bbox1[3], bbox2[3])

    inter_w = max(0, x2 - x1)
    inter_h = max(0, y2 - y1)
    inter = inter_w * inter_h

    area1 = (bbox1[2] - bbox1[0]) * (bbox1[3] - bbox1[1])
    area2 = (bbox2[2] - bbox2[0]) * (bbox2[3] - bbox2[1])
    union = area1 + area2 - inter

    return inter / union if union > 0 else 0.0


def check_quality(result: ConversionResult) -> bool:
    """
    检查转换结果是否达到最低质量标准

    Args:
        result: ConversionResult

    Returns:
        True if quality meets threshold (grade C or above)
    """
    return result.grade in ("A", "B", "C")