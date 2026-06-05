# 编码规范 — PDF/图片 转 PPTX 模块

> **项目：** 省心PPT (shengxin-ppt)
> **模块：** pdf_to_pptx
> **版本：** v1.0
> **日期：** 2026-05-20

---

## 1. 项目结构

```
pdf_to_pptx/
├── __init__.py              # 公开 API，版本号
├── converter.py             # 主入口类
├── extractor/               # 内容提取层
│   ├── __init__.py
│   ├── pdf_extractor.py     # PDF 文本+图形提取
│   ├── table_extractor.py   # 表格专项提取
│   ├── image_extractor.py   # 图片资源提取
│   └── color_analyzer.py    # 色彩分析
├── analyzer/                # AI 分析层
│   ├── __init__.py
│   ├── layout_analyzer.py   # 布局分析（MiniMax VL-01）
│   └── font_mapper.py       # 字体映射
├── builder/                 # PPTX 重建层
│   ├── __init__.py
│   ├── pptx_builder.py      # 主构建器
│   ├── text_builder.py      # 文本框构建
│   ├── shape_builder.py     # 图形/形状构建
│   ├── image_builder.py     # 图片模块构建
│   └── table_builder.py     # 表格构建
└── utils/
    ├── __init__.py
    ├── coord.py             # 坐标系转换
    ├── color.py             # 颜色格式转换
    └── validators.py        # 质量校验
```

---

## 2. 命名规范

### 2.1 文件命名
- 全小写 + 下划线：`pdf_extractor.py`
- 测试文件：`test_*.py`

### 2.2 类命名
- 大驼峰：`PDFExtractor`, `PPTXBuilder`
- 后缀规则：
  - 提取器：`*Extractor`
  - 构建器：`*Builder`
  - 分析器：`*Analyzer`

### 2.3 函数/方法命名
- 小驼峰或下划线：`extract_text()`, `build_textbox()`
- 私有方法：单下划线前缀 `_extract_images()`

### 2.4 常量命名
- 全大写 + 下划线：`PT_TO_EMU`, `DEFAULT_DPI`

---

## 3. 类型注解

```python
from typing import List, Dict, Optional, Tuple, Union
from dataclasses import dataclass
import fitz

@dataclass
class TextBlock:
    """PDF 文本块"""
    text: str
    bbox: Tuple[float, float, float, float]  # (x0, y0, x1, y1)
    font: str
    size: float
    color: Tuple[int, int, int]  # RGB 0-255

    def to_pptx_coords(self, page_height: float) -> Dict[str, float]:
        """转换为 PPTX 坐标"""
        ...

class PDFExtractor:
    def extract(self, pdf_path: str) -> List[TextBlock]:
        ...

    def extract_images(self, pdf_path: str) -> List[Dict]:
        ...
```

---

## 4. 异常处理

### 4.1 自定义异常

```python
class PDFToPPTXError(Exception):
    """基础异常"""
    pass

class PDFParseError(PDFToPPTXError):
    """PDF 解析失败"""
    pass

class ImageExtractError(PDFToPPTXError):
    """图片提取失败"""
    pass

class TableExtractError(PDFToPPTXError):
    """表格提取失败"""
    pass
```

### 4.2 使用原则

- 每个模块的公共方法必须 `try/except` 包装
- 捕获异常后记录日志（`logging`），转换为 `PDFToPPTXError` 子类
- 单页失败不影响整份文档转换，记录到 `result["issues"]`

---

## 5. 日志规范

```python
import logging

logger = logging.getLogger("pdf_to_pptx")

# 日志级别
# ERROR: 转换失败
# WARNING: 部分内容丢失（可继续）
# INFO: 转换进度
# DEBUG: 详细参数

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
```

---

## 6. 坐标与单位

| 来源/目标 | 单位 | 说明 |
|-----------|------|------|
| PDF (PyMuPDF) | PT (点) | 1 PT = 1/72 inch |
| PPTX (python-pptx) | EMU | 1 PT = 914400/72 ≈ 12700 EMU |
| 英寸 (inch) | EMU | 1 inch = 914400 EMU |

**转换常量：**

```python
PT_TO_EMU = 914400 / 72  # 12700.0
INCH_TO_EMU = 914400
CM_TO_EMU = INCH_TO_EMU / 2.54
```

**PDF → PPTX 坐标转换：**

```python
def pdf_to_pptx_coord(value_pt: float) -> int:
    """PDF PT → PPTX EMU"""
    return int(value_pt * PT_TO_EMU)
```

---

## 7. 图片处理规范

```python
# 图片命名规范
# 格式: slide_{页码}_img_{序号}_{md5前8位}.{ext}
# 示例: slide_01_img_001_a3f2d1c8.png

# 图片存储
# 资源目录: {output_dir}/resources/
# PPTX 引用: 使用相对路径（相对于 PPTX 文件位置）

# 图片质量
# 提取的位图: 保持原始 DPI，仅压缩明显过大的图（> 5MB → JPEG 85%）
# 缩略图: 不生成（按需）
```

---

## 8. 色彩规范

```python
from pptx.dml.color import RGBColor

# 颜色来源优先级
# 1. PDF 精确颜色值（优先）
# 2. AI 分析推断的主色调
# 3. 默认黑色/白色

def fitz_color_to_rgb(color: Union[tuple, list]) -> RGBColor:
    """PyMuPDF 颜色 → PPTX RGBColor"""
    if len(color) >= 3:
        r, g, b = color[0], color[1], color[2]
        # PyMuPDF 通常返回 0-1 范围的浮点数
        if isinstance(r, float):
            r, g, b = int(r*255), int(g*255), int(b*255)
        return RGBColor(r, g, b)
    return RGBColor(0, 0, 0)  # fallback 黑色
```

---

## 9. 文本处理规范

```python
# 文字编码
# - 全部使用 UTF-8
# - PDF 编码问题: 使用 `errors="ignore"` 跳过无法解码字符，记录 WARNING

# 文字方向
# - LTR（默认）: 横向文本框
# - 支持竖排（后续扩展）

# 字体 fallback
FONT_FALLBACK = {
    "SimHei": "Microsoft YaHei",
    "SimSun": "SimSun",
    "Arial": "Arial",
    "Helvetica": "Calibri",
    "Times": "Times New Roman",
}
```

---

## 10. API 设计规范

```python
class PDFToPPTXConverter:
    """主转换器类"""

    def __init__(
        self,
        dpi: int = 300,
        lang: str = "zh-CN",
        vision_model: bool = True,
        resource_dir: str = "resources",
    ):
        """
        Args:
            dpi: PDF 渲染 DPI（用于图片分析）
            lang: OCR 语言
            vision_model: 是否启用 AI 视觉分析
            resource_dir: 图片资源存储目录
        """

    def convert(
        self,
        input_path: str,
        output_path: str,
        options: Optional[Dict] = None,
    ) -> Dict:
        """
        转换文件

        Args:
            input_path: 输入 PDF 或图片路径
            output_path: 输出 PPTX 路径
            options: 选项（preserve_colors 等）

        Returns:
            {
                "status": "success" | "partial_success" | "failed",
                "slides": int,
                "images_extracted": int,
                "tables_extracted": int,
                "issues": List[str],
            }
        """
```

---

## 11. 测试规范

```python
# 测试文件命名
test_pdf_extractor.py
test_text_builder.py
test_coord.py

# 测试用例命名
def test_pdf_to_pptx_coord_conversion():
    ...

def test_color_fitz_to_rgb():
    ...

# 测试数据
tests/fixtures/
├── simple_text.pdf
├── with_images.pdf
├── with_table.pdf
└── scanned.pdf
```

---

## 12. 代码格式化

```bash
# Black 格式化
black pdf_to_pptx/

# isort 导入排序
isort pdf_to_pptx/

# flake8 检查
flake8 pdf_to_pptx/ --max-line-length=120

# pre-commit（推荐）
# .pre-commit-config.yaml 配置 black + isort + flake8
```

---

*更新日期：2026-05-20*
