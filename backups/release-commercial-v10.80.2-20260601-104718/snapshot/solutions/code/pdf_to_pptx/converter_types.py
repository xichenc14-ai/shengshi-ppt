"""
数据类型定义 — PDF/图片 转 PPTX
"""

from dataclasses import dataclass, field
from typing import List, Tuple, Optional, Literal


@dataclass
class TextBlock:
    """PDF 文本块"""
    text: str
    bbox: Tuple[float, float, float, float]  # (x0, y0, x1, y1) in PT
    font: str
    size: float           # PT
    color: Tuple[int, int, int]  # RGB 0-255
    bold: bool = False
    italic: bool = False
    is_title: bool = False


@dataclass
class ImageBlock:
    """图片块"""
    image_id: str         # 唯一标识
    local_path: str       # 本地文件路径
    bbox: Tuple[float, float, float, float]  # (x0, y0, x1, y1) in PT
    width: int            # 像素宽
    height: int           # 像素高
    original_ref: Optional[str] = None  # PDF 原始引用


@dataclass
class ShapeBlock:
    """图形块"""
    shape_type: Literal["rectangle", "ellipse", "line", "arrow", "freeform"]
    bbox: Tuple[float, float, float, float]
    fill_color: Optional[Tuple[int, int, int]] = None  # RGB
    line_color: Optional[Tuple[int, int, int]] = None   # RGB
    line_width: float = 0


@dataclass
class TableCell:
    """表格单元格"""
    text: str
    row: int
    col: int
    row_span: int = 1
    col_span: int = 1


@dataclass
class TableBlock:
    """表格块"""
    bbox: Tuple[float, float, float, float]
    rows: int
    cols: int
    cells: List[List[str]]  # 二维数组 [row][col]
    merged_cells: List[Tuple[int, int, int, int]] = field(
        default_factory=list
    )  # (row, col, row_span, col_span)


@dataclass
class PageContent:
    """单页内容"""
    page_number: int       # 1-indexed
    width: float           # 页面宽度（PT）
    height: float          # 页面高度（PT）

    text_blocks: List[TextBlock] = field(default_factory=list)
    image_blocks: List[ImageBlock] = field(default_factory=list)
    shape_blocks: List[ShapeBlock] = field(default_factory=list)
    table_blocks: List[TableBlock] = field(default_factory=list)

    # 提取结果（由 extractor 填充）
    images_extracted: Optional[List[ImageBlock]] = None

    # 元数据
    background_color: Optional[Tuple[int, int, int]] = None
    theme_colors: List[Tuple[int, int, int]] = field(default_factory=list)
    fonts_used: List[str] = field(default_factory=list)


@dataclass
class ConversionResult:
    """单文件转换结果"""

    status: Literal["success", "partial_success", "failed"] = "failed"
    message: str = ""

    total_pages: int = 0
    slides_created: int = 0
    images_extracted: int = 0
    tables_extracted: int = 0
    shapes_extracted: int = 0

    # 质量指标（0.0 - 1.0）
    text_fidelity: float = 0.0
    visual_fidelity: float = 0.0
    editability_rate: float = 0.0
    overall_score: float = 0.0
    grade: Literal["A", "B", "C", "D"] = "D"

    issues: List[str] = field(default_factory=list)
    failed_pages: List[int] = field(default_factory=list)
    resource_dir: str = ""

    def calculate_score(self) -> None:
        """计算综合评分"""
        self.overall_score = (
            self.text_fidelity * 0.35 +
            self.visual_fidelity * 0.30 +
            self.editability_rate * 0.20 +
            self._layout_accuracy_estimate() * 0.15
        ) * 100

        if self.overall_score >= 90:
            self.grade = "A"
        elif self.overall_score >= 75:
            self.grade = "B"
        elif self.overall_score >= 60:
            self.grade = "C"
        else:
            self.grade = "D"

        # 估算文字还原率（基于 issues）
        if self.total_pages > 0:
            self.text_fidelity = max(0, 1.0 - len(self.issues) / (self.total_pages * 2))
            self.editability_rate = max(0, 1.0 - len(self.failed_pages) / self.total_pages)

    def _layout_accuracy_estimate(self) -> float:
        return max(0, 1.0 - len(self.failed_pages) / self.total_pages) if self.total_pages > 0 else 0

    @property
    def summary(self) -> str:
        lines = [
            f"{'✅' if self.status != 'failed' else '❌'} 转换{'完成' if self.status != 'failed' else '失败'}",
            f"📄 {self.total_pages} 页 → {self.slides_created} 页幻灯片",
            f"✏️ 文字 {self.text_fidelity:.0%} 还原",
            f"🖼️ 图片 {self.images_extracted} 张",
            f"📊 表格 {self.tables_extracted} 个",
            f"🏆 质量评分 {self.overall_score:.1f}（{self.grade}）",
        ]
        if self.issues:
            lines.append(f"⚠️ {len(self.issues)} 个问题")
        return "\n".join(lines)


@dataclass
class BatchResult:
    """批量转换结果"""
    total_files: int = 0
    success_count: int = 0
    partial_count: int = 0
    failed_count: int = 0
    results: List[ConversionResult] = field(default_factory=list)

    @property
    def summary(self) -> str:
        return (
            f"批量转换: {self.success_count} 成功，"
            f"{self.partial_count} 部分成功，"
            f"{self.failed_count} 失败 / 共 {self.total_files} 个文件"
        )
