# 接口约定 — PDF/图片 转 PPTX 模块

> **项目：** 省心PPT (shengxin-ppt)
> **模块：** pdf_to_pptx
> **版本：** v1.0
> **日期：** 2026-05-20

---

## 1. 公共 API

### 1.1 主类：`PDFToPPTXConverter`

```python
from pdf_to_pptx import PDFToPPTXConverter

converter = PDFToPPTXConverter(
    dpi: int = 300,
    lang: str = "zh-CN",
    vision_model: bool = True,
    resource_dir: str = "resources",
)
```

#### `converter.convert()`

**签名：**

```python
def convert(
    self,
    input_path: str,
    output_path: str,
    options: Optional[Dict[str, Any]] = None,
) -> ConversionResult:
    """
    将 PDF 或图片文件转换为 PPTX

    Args:
        input_path: 输入文件路径（支持 .pdf, .png, .jpg, .jpeg）
        output_path: 输出 PPTX 文件路径
        options: 转换选项（见 1.2）

    Returns:
        ConversionResult 数据类（见 2.1）

    Raises:
        FileNotFoundError: 输入文件不存在
        PDFParseError: PDF 解析失败（非加密或损坏）
        PDFPasswordError: PDF 受密码保护
    """
```

**示例：**

```python
from pdf_to_pptx import PDFToPPTXConverter

converter = PDFToPPTXConverter()
result = converter.convert(
    input_path="report.pdf",
    output_path="report.pptx",
    options={
        "preserve_colors": True,
        "preserve_images": True,
        "preserve_tables": True,
        "preserve_shapes": True,
        "ocr_fallback": True,
    }
)

print(result.status)  # "success"
print(result.summary)
```

---

### 1.2 转换选项 `options`

```python
options: Dict[str, Any] = {
    # 内容保留
    "preserve_colors": True,      # 保留原始颜色（默认 True）
    "preserve_images": True,     # 保留图片（默认 True）
    "preserve_tables": True,     # 保留表格结构（默认 True）
    "preserve_shapes": True,     # 保留矢量图形（默认 True）

    # 降级策略
    "ocr_fallback": True,         # 扫描件自动 OCR（默认 True）
    "table_fallback_to_image": True,  # 复杂表格降级为图片（默认 True）
    "shape_fallback_to_image": True,  # 复杂图形降级为图片（默认 False）

    # 输出控制
    "one_page_per_slide": True,   # 每页 PDF → 每页幻灯片（默认 True）
    "skip_empty_pages": False,    # 跳过空白页（默认 False）

    # 样式
    "slide_width_inch": 13.333,   # 幻灯片宽度 inch（默认 16:9 = 13.333"）
    "slide_height_inch": 7.5,    # 幻灯片高度 inch（默认 16:9 = 7.5"）
    "theme_colors": None,         # 自定义主题色（默认从 PDF 提取）
}
```

---

### 1.3 批处理 API：`convert_batch()`

```python
def convert_batch(
    self,
    input_paths: List[str],
    output_dir: str,
    options: Optional[Dict[str, Any]] = None,
) -> BatchResult:
    """
    批量转换多个文件

    Args:
        input_paths: 输入文件路径列表
        output_dir: 输出目录（每个文件同名 .pptx）
        options: 同 convert()

    Returns:
        BatchResult 数据类（见 2.2）
    """
```

---

## 2. 数据类型定义

### 2.1 `ConversionResult`

```python
from dataclasses import dataclass, field
from typing import List, Optional

@dataclass
class ConversionResult:
    """单文件转换结果"""

    # 状态
    status: Literal["success", "partial_success", "failed"]
    message: str = ""

    # 内容统计
    total_pages: int = 0
    slides_created: int = 0
    images_extracted: int = 0
    tables_extracted: int = 0
    shapes_extracted: int = 0

    # 质量指标
    text_fidelity: float = 0.0      # 0.0 - 1.0
    visual_fidelity: float = 0.0   # 0.0 - 1.0
    editability_rate: float = 0.0   # 0.0 - 1.0
    overall_score: float = 0.0      # 综合评分 0.0 - 100.0
    grade: Literal["A", "B", "C", "D"] = "D"

    # 问题记录
    issues: List[str] = field(default_factory=list)
    failed_pages: List[int] = field(default_factory=list)  # 1-indexed

    # 资源文件
    resource_dir: str = ""

    @property
    def summary(self) -> str:
        """人类可读的摘要文本"""
        lines = [
            f"✅ 转换{'完成' if self.status != 'failed' else '失败'}",
            f"📄 {self.total_pages} 页 → {self.slides_created} 页幻灯片",
            f"✏️ 文字 {self.text_fidelity:.0%} 还原",
            f"🖼️ 图片 {self.images_extracted} 张",
            f"📊 表格 {self.tables_extracted} 个",
            f"🏆 质量评分 {self.overall_score:.1f}（{self.grade}）",
        ]
        if self.issues:
            lines.append(f"⚠️ {len(self.issues)} 个问题")
        return "\n".join(lines)
```

### 2.2 `BatchResult`

```python
@dataclass
class BatchResult:
    """批量转换结果"""

    total_files: int
    success_count: int
    partial_count: int
    failed_count: int

    results: List[ConversionResult] = field(default_factory=list)

    @property
    def summary(self) -> str:
        return (
            f"批量转换: {self.success_count} 成功，"
            f"{self.partial_count} 部分成功，"
            f"{self.failed_count} 失败 / 共 {self.total_files} 个文件"
        )
```

---

### 2.3 `PageContent`

```python
@dataclass
class PageContent:
    """单页内容（内部数据结构）"""

    page_number: int              # 1-indexed
    width: float                  # 页面宽度（PT）
    height: float                # 页面高度（PT）

    # 内容块
    text_blocks: List["TextBlock"] = field(default_factory=list)
    image_blocks: List["ImageBlock"] = field(default_factory=list)
    shape_blocks: List["ShapeBlock"] = field(default_factory=list)
    table_blocks: List["TableBlock"] = field(default_factory=list)

    # 元数据
    background_color: Optional[Tuple[int,int,int]] = None
    theme_colors: List[Tuple[int,int,int]] = field(default_factory=list)
    fonts_used: List[str] = field(default_factory=list)


@dataclass
class TextBlock:
    """文本块"""
    text: str
    bbox: Tuple[float, float, float, float]  # (x0, y0, x1, y1) in PT
    font: str
    size: float           # PT
    color: Tuple[int,int,int]  # RGB
    bold: bool = False
    italic: bool = False
    is_title: bool = False


@dataclass
class ImageBlock:
    """图片块"""
    image_id: str         # 唯一标识
    local_path: str       # 本地文件路径
    bbox: Tuple[float,float,float,float]
    width: int
    height: int
    original_ref: Optional[str] = None  # PDF 原始引用


@dataclass
class ShapeBlock:
    """图形块"""
    shape_type: Literal["rectangle", "ellipse", "line", "arrow", "freeform"]
    bbox: Tuple[float,float,float,float]
    fill_color: Optional[Tuple[int,int,int]] = None
    line_color: Optional[Tuple[int,int,int]] = None
    line_width: float = 0


@dataclass
class TableBlock:
    """表格块"""
    bbox: Tuple[float,float,float,float]
    rows: int
    cols: int
    cells: List[List[str]]     # 二维数组
    merged_cells: List[Tuple[int,int,int,int]] = []  # (row,col,row_span,col_span)
```

---

## 3. 内部模块 API

### 3.1 `PDFExtractor`

```python
class PDFExtractor:
    """PDF 内容提取器"""

    def extract(self, pdf_path: str) -> List[PageContent]:
        """提取整份 PDF 的内容"""
        ...

    def extract_page(self, pdf_path: str, page_num: int) -> PageContent:
        """提取指定页内容"""
        ...
```

### 3.2 `PPTXBuilder`

```python
class PPTXBuilder:
    """PPTX 文件构建器"""

    def __init__(
        self,
        slide_width: float = 13.333,  # inch
        slide_height: float = 7.5,    # inch
        resource_dir: str = "resources",
    ):
        ...

    def add_slide(self, page_content: PageContent) -> None:
        """根据 PageContent 添加一页幻灯片"""
        ...

    def save(self, output_path: str) -> None:
        """保存 PPTX 文件"""
        ...
```

---

## 4. 错误码约定

| 错误码 | 常量名 | 说明 |
|--------|--------|------|
| `E001` | `ERR_FILE_NOT_FOUND` | 输入文件不存在 |
| `E002` | `ERR_UNSUPPORTED_FORMAT` | 不支持的文件格式 |
| `E003` | `ERR_PDF_ENCRYPTED` | PDF 受密码保护 |
| `E004` | `ERR_PDF_CORRUPTED` | PDF 文件损坏 |
| `E005` | `ERR_IMAGE_TOO_LARGE` | 图片过大（> 50MB）|
| `E006` | `ERR_OCR_FAILED` | OCR 识别失败 |
| `E007` | `ERR_PPTX_SAVE_FAILED` | PPTX 保存失败 |
| `E008` | `ERR_MEMORY_EXCEEDED` | 内存超限 |

---

## 5. 事件/回调约定

```python
from typing import Callable

class PDFToPPTXConverter:
    def __init__(
        self,
        dpi: int = 300,
        on_progress: Optional[Callable[[int, int], None]] = None,
        # on_progress(current_page, total_pages)
    ):
        ...
```

**进度回调示例：**

```python
def show_progress(current, total):
    print(f"进度: {current}/{total} ({current/total*100:.0f}%)")

converter = PDFToPPTXConverter(on_progress=show_progress)
result = converter.convert("input.pdf", "output.pptx")
```

---

## 6. 文件路径约定

```
输入文件: /path/to/input.pdf
输出文件: /path/to/output.pptx
资源目录: /path/to/output_resources/
    ├── slide_01_img_001_abc123.png
    ├── slide_02_img_001_def456.png
    └── ...
```

- 资源目录默认创建在输出 PPTX 同目录下
- 资源文件使用相对路径嵌入 PPTX

---

## 7. 版本兼容性

```python
# pdf_to_pptx/__init__.py
__version__ = "1.0.0"
__compatible_pptx_version__ = "0.6.21"

# API 版本标记（未来扩展用）
API_VERSION = "v1"
```

---

*更新日期：2026-05-20*
