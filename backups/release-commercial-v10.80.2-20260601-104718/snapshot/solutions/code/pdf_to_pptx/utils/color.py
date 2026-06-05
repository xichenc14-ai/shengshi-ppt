"""
颜色格式转换工具
"""

from typing import Tuple, Union, Optional
import numpy as np

try:
    from pptx.dml.color import RGBColor
except ImportError:
    RGBColor = None  # python-pptx may not be installed in all environments


def fitz_color_to_rgb(
    color: Union[tuple, list, int, None]
) -> Tuple[int, int, int]:
    """
    将 PyMuPDF 颜色格式转换为 RGB tuple

    PyMuPDF 颜色可能是：
      - int (单通道，灰度)
      - tuple[float] (RGB，0-1 范围)
      - tuple[float] (CMYK，0-1 范围)
      - None

    Returns:
        (R, G, B) 每个通道 0-255
    """
    if color is None:
        return (0, 0, 0)

    # 灰度 int → RGB
    if isinstance(color, int):
        gray = int(color * 255)
        return (gray, gray, gray)

    # CMYK → RGB（简化）
    if len(color) == 4:
        c, m, y, k = color
        r = int((1 - c) * (1 - k) * 255)
        g = int((1 - m) * (1 - k) * 255)
        b = int((1 - y) * (1 - k) * 255)
        return (r, g, b)

    # RGB
    if len(color) >= 3:
        r, g, b = color[0], color[1], color[2]
        # 判断是否为 0-1 范围
        if isinstance(r, float) and r <= 1.0:
            r, g, b = int(r * 255), int(g * 255), int(b * 255)
        else:
            r, g, b = int(r), int(g), int(b)
        return (r, g, b)

    return (0, 0, 0)


def rgb_to_hex(rgb: Tuple[int, int, int]) -> str:
    """RGB → 十六进制字符串"""
    r, g, b = rgb
    return f"#{r:02X}{g:02X}{b:02X}"


def hex_to_rgb(hex_str: str) -> Tuple[int, int, int]:
    """十六进制字符串 → RGB"""
    hex_str = hex_str.lstrip("#")
    return (
        int(hex_str[0:2], 16),
        int(hex_str[2:4], 16),
        int(hex_str[4:6], 16),
    )


def rgb_to_pptx_rgb(rgb: Tuple[int, int, int]):
    """RGB tuple → python-pptx RGBColor"""
    if RGBColor is None:
        return rgb
    return RGBColor(rgb[0], rgb[1], rgb[2])


def color_delta_e_2000(
    rgb1: Tuple[int, int, int],
    rgb2: Tuple[int, int, int],
) -> float:
    """
    计算两个 RGB 颜色的 CIEDE2000 色差（简化实现）

    Returns:
        ΔE 值，< 5 表示几乎无差异，< 10 表示有细微差异
    """
    # 简化：直接用欧氏距离
    r1, g1, b1 = np.array(rgb1) / 255
    r2, g2, b2 = np.array(rgb2) / 255

    delta = np.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
    return float(delta * 100)


def dominant_colors(
    colors: list,
    n: int = 5,
) -> list:
    """
    从颜色列表中提取主色调（简化 k-means）

    Args:
        colors: RGB tuple 列表
        n: 返回前 n 个主色

    Returns:
        按出现频率排序的 RGB 列表
    """
    if not colors:
        return []

    from collections import Counter

    # 量化到 16 级减少噪声
    quantized = [
        (c[0] // 16, c[1] // 16, c[2] // 16) for c in colors
    ]
    counter = Counter(quantized)

    # 取最常见的颜色
    top = counter.most_common(n)
    return [
        (r * 16, g * 16, b * 16)
        for (r, g, b), _ in top
    ]
