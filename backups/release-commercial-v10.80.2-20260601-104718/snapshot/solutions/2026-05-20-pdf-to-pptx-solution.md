# PDF/图片 转 PPTX 技术方案

> **项目：** 省心PPT (shengxin-ppt)
> **版本：** v1.0
> **日期：** 2026-05-20
> **作者：** tech-lead
> **状态：** 技术方案（待 coder 实现）

---

## 目录

1. [技术目标](#1-技术目标)
2. [技术路线总览](#2-技术路线总览)
3. [核心能力拆解](#3-核心能力拆解)
4. [技术选型](#4-技术选型)
5. [模块详细设计](#5-模块详细设计)
6. [实现阶段计划](#6-实现阶段计划)
7. [关键技术难点与对策](#7-关键技术难点与对策)
8. [依赖库清单](#8-依赖库清单)

---

## 1. 技术目标

### 1.1 最终目标

将 PDF 文件或图片（截图、扫描件、设计稿）转换为可编辑的 PPTX 文件，实现**精准还原**：

| 维度 | 目标 |
|------|------|
| **插图/图片** | 保留原始图片，模块化嵌入，可替换 |
| **色系/风格** | 完整提取主题色、背景色、渐变色 |
| **文字** | 文字内容可编辑，字体尽量还原 |
| **图形/形状** | 矩形、圆形、线条、箭头等基本图形还原 |
| **表格/图表** | 表格结构化还原，数据可编辑 |
| **布局** | 页面比例、元素位置尽量保持一致 |

### 1.2 适用范围

- ✅ 矢量 PDF（文字层完好）
- ✅ 图片类 PDF（扫描件需 OCR）
- ✅ 截图、设计稿（需 AI 布局分析）
- ⚠️ 手写体（识别率有限）
- ❌ 纯图片无文字（只能重建为图片占位）

---

## 2. 技术路线总览

```
输入文件（PDF / 图片）
        │
        ▼
┌─────────────────────────────────────────┐
│  阶段一：内容提取层                        │
│  ├─ PyMuPDF：文本、字体、坐标、元数据       │
│  ├─ pdfplumber：表格结构提取              │
│  ├─ PyMuPDF：图片资源提取（位图+矢量图）    │
│  └─ pdf2image：页面渲染为高清图片          │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│  阶段二：视觉分析层（AI 驱动）               │
│  ├─ MiniMax VL-01：布局区域分割            │
│  ├─ MiniMax VL-01：样式标签识别（标题/正文） │
│  ├─ MiniMax VL-01：色彩体系提取            │
│  └─ OCR（pdfminer/pytesseract）：文字识别  │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│  阶段三：PPTX 重建层                       │
│  ├─ python-pptx：幻灯片结构构建            │
│  ├─ 文本框定位：坐标 1:1 映射              │
│  ├─ 图片模块化：Picture Placeholder        │
│  ├─ 图形重建：AutoShape 还原              │
│  └─ 样式应用：主题色、字体、字号            │
└─────────────────────────────────────────┘
        │
        ▼
   输出 PPTX（可编辑）
```

---

## 3. 核心能力拆解

### 3.1 文字提取与重建

**输入：** PDF 文字层
**输出：** 可编辑文本框

**技术路径：**
1. PyMuPDF `page.get_text("dict")` 提取带坐标的文本块
2. 每个文本块包含：`bbox`, `font`, `size`, `color`, `text`
3. 文本按阅读顺序（Y轴分组 + X轴排序）排列
4. python-pptx `slide.shapes.add_textbox()` 重建

**关键字段映射：**

| PDF 属性 | PPTX 属性 | 说明 |
|---------|---------|------|
| `bbox[x0,y0,x1,y1]` | `left,top,width,height` | 坐标转换（单位: EMU） |
| `font` | `font.name` | 字体名称映射 |
| `size` | `font.size` | 字号（PT） |
| `color`（RGB） | `font.color.rgb` | 文字颜色 |
| `text` | `text_frame.paragraphs[0].text` | 文本内容 |

### 3.2 图片提取与模块化处理

**输入：** PDF 内嵌图片
**输出：** 独立图片文件 + PPTX 引用

**技术路径：**
1. PyMuPDF `page.get_images(full=True)` 提取所有图片
2. 每张图获取：`xref`, `width`, `height`, `colorspace`, `bpc`
3. `page.parent.extract_image(xref)` 解压原始数据
4. 保存为 PNG/JPEG，嵌入 PPTX
5. 使用 `slide.shapes.add_picture()` 插入

**模块化处理：**
- 图片与文字分离，作为独立 Shape
- 可通过 `shape.name` 标记，方便后续替换
- 建议存储 `original_ref` 字段用于溯源

### 3.3 图形/形状还原

**输入：** PDF 矢量图形（路径、矩形、圆形等）
**输出：** PPTX AutoShape

**技术路径：**
1. PyMuPDF `page.get_drawings()` 提取矢量路径
2. 分析路径类型：矩形/圆形/直线/曲线
3. python-pptx `slide.shapes.add_shape()` 重建
4. 填充色、边框色从路径属性获取

**支持的图形类型：**

| PDF 图形 | PPTX Shape | 参数 |
|---------|-----------|------|
| 矩形 | `MSO_SHAPE_TYPE.RECTANGLE` | left,top,width,height |
| 圆形/椭圆 | `MSO_SHAPE_TYPE.OVAL` | left,top,width,height |
| 直线 | `MSO_CONNECTOR_TYPE.STRAIGHT` | start/end point |
| 箭头 | `MSO_CONNECTOR_TYPE.STRAIGHT` + 箭头端 |
| 自由路径 | `freeform` shape | 顶点列表 |

### 3.4 色彩体系保留

**输入：** PDF 颜色信息
**输出：** PPTX 主题色 + 直接色

**技术路径：**
1. 提取页面背景色（PDF page.clip）
2. 提取所有文字颜色、图形填充色、边框色
3. 聚类分析主色调（k-means 或手动统计）
4. 应用为 PPTX 主题色或直接硬编码

**颜色格式转换：**

```python
# PDF 颜色（通常为 RGB 0-1 或 0-255）
r, g, b = 0.25, 0.5, 0.75  # PyMuPDF 格式

# 转换为 PPTX RGB
from pptx.dml.color import RGBColor
rgb = RGBColor(int(r*255), int(g*255), int(b*255))

# 转换为十六进制
hex_color = f"{rgb[0]:02X}{rgb[1]:02X}{rgb[2]:02X}"
```

### 3.5 表格/图表还原

**输入：** PDF 表格区域
**输出：** PPTX 表格

**技术路径：**
1. pdfplumber 精确提取表格结构（行、列、单元格）
2. `slide.shapes.add_table()` 创建 PPTX 表格
3. 单元格内容逐一填入

**表格还原等级：**

| 等级 | 说明 | 精度 |
|------|------|------|
| L1 | 整体作为图片 | 100% 视觉还原 |
| L2 | 表格结构 + 文字提取 | ~85% 结构还原 |
| L3 | 完整行列还原 | ~95%（复杂表仍有误差）|

### 3.6 字体还原

**输入：** PDF 字体信息
**输出：** PPTX 字体设置

**技术路径：**
1. PyMuPDF 提取字体名（`font.name`）
2. 常见字体映射（PDF 名 → Windows/macOS 系统字体）
3. 设置 `font.name` fallback 链

**字体映射表（简化）：**

| PDF 字体名关键词 | 映射到 |
|----------------|--------|
| SimHei, Heiti | Microsoft YaHei |
| SimSun, Songti | SimSun |
| Arial | Arial |
| Helvetica | Calibri |
| Times | Times New Roman |
| (其他) | 保持原名 + 警告 |

---

## 4. 技术选型

### 4.1 核心依赖

| 库 | 版本 | 用途 | 安装 |
|----|------|------|------|
| `python-pptx` | ≥0.6.21 | PPTX 编程 | `pip install python-pptx` |
| `PyMuPDF` | ≥1.23.0 | PDF 解析（文本+图片+图形） | `pip install PyMuPDF` |
| `pdfplumber` | ≥0.10.0 | 表格专项提取 | `pip install pdfplumber` |
| `pdf2image` | ≥1.16.0 | PDF 渲染为图片 | `pip install pdf2image` |
| `Pillow` | ≥10.0.0 | 图像处理 | `pip install Pillow` |
| `numpy` | ≥1.24.0 | 数值计算/颜色聚类 | `pip install numpy` |
| `scikit-learn` | ≥1.3.0 | k-means 颜色聚类 | `pip install scikit-learn` |

### 4.2 AI 视觉分析（MiniMax VL-01）

**用途：** 当 PDF 文字层损坏或需要高级布局理解时

**能力：**
- 布局区域分割（标题区/正文区/图表区/页眉页脚）
- 样式语义识别（这是标题/这是正文/这是引用）
- 色彩趋势分析（主色调是什么）
- 图片内容描述（用于 alt-text 或搜索索引）

**调用方式：**

```python
# 使用 MiniMax__understand_image 工具
# 将 PDF 页面渲染为图片后，调用视觉分析
result = MiniMax__understand_image(
    prompt="分析这张 PPT 截图的布局结构，返回每个内容区块的类别、位置坐标和样式特征（字体大小、颜色、是否加粗）",
    image_source="page_1.png"
)
```

### 4.3 OCR（备选）

**场景：** 扫描件 PDF（无文字层）

**选型：**
- `pytesseract` + Tesseract OCR（本地，免费）
- 云端 OCR（百度/腾讯/阿里）作为高精度备选

---

## 5. 模块详细设计

### 5.1 模块架构

```
pdf_to_pptx/
├── __init__.py
├── converter.py          # 主入口，对外 API
├── extractor/
│   ├── __init__.py
│   ├── pdf_extractor.py # PyMuPDF PDF 内容提取
│   ├── table_extractor.py # pdfplumber 表格提取
│   ├── image_extractor.py # PDF 内嵌图片提取
│   └── color_analyzer.py  # 色彩分析
├── analyzer/
│   ├── __init__.py
│   ├── layout_analyzer.py # 布局分析（AI 驱动）
│   └── font_mapper.py    # 字体映射
├── builder/
│   ├── __init__.py
│   ├── pptx_builder.py   # PPTX 文件构建
│   ├── text_builder.py   # 文本框构建
│   ├── shape_builder.py  # 图形/形状构建
│   ├── image_builder.py # 图片模块构建
│   └── table_builder.py  # 表格构建
└── utils/
    ├── __init__.py
    ├── coord.py          # 坐标系转换
    ├── color.py          # 颜色格式转换
    └── validators.py     # 质量校验
```

### 5.2 核心 API 设计

```python
# converter.py — 主入口
from pdf_to_pptx import PDFToPPTXConverter

converter = PDFToPPTXConverter(
    dpi=300,              # 渲染 DPI
    lang="zh-CN",         # OCR 语言
    vision_model=True,    # 启用 AI 布局分析
)

result = converter.convert(
    input_path="input.pdf",    # 或 "input.png"
    output_path="output.pptx",
    options={
        "preserve_colors": True,
        "preserve_images": True,
        "preserve_tables": True,
        "preserve_shapes": True,
    }
)

# result 结构
{
    "status": "success",       # 或 "partial_success"
    "slides": 15,
    "images_extracted": 23,
    "tables_extracted": 5,
    "issues": [...]            # 警告/问题列表
}
```

### 5.3 坐标系转换

PPT 使用 EMU（English Metric Units），1 PT = 12700 EMU

```python
# coord.py
PT_TO_EMU = 914400 / 72  # ≈ 12700
INCH_TO_EMU = 914400

def pdf_bbox_to_pptx(bbox, page_height, slide_width, slide_height):
    """
    将 PDF 坐标 (x0, y0, x1, y1) 转换为 PPTX 坐标 (left, top, width, height)
    PDF Y轴向下，PPTX Y轴也向下，origin 不同但方向一致
    """
    x0, y0, x1, y1 = bbox
    left = x0 * PT_TO_EMU
    top = (page_height - y1) * PT_TO_EMU  # PDF origin 在左下，PPTX 在左上
    width = (x1 - x0) * PT_TO_EMU
    height = (y1 - y0) * PT_TO_EMU
    return left, top, width, height
```

### 5.4 图片模块化策略

```python
# image_builder.py
class ImageBuilder:
    def __init__(self, slide, resource_dir="resources"):
        self.slide = slide
        self.resource_dir = resource_dir
        os.makedirs(resource_dir, exist_ok=True)

    def add_module_image(self, image_path, position, size):
        """
        添加模块化图片（可替换/可移除）
        shape.name 格式: "module_image_{uuid}"
        """
        import uuid
        pic = self.slide.shapes.add_picture(
            image_path,
            position.left, position.top,
            position.width, position.height
        )
        pic.name = f"module_image_{uuid.uuid4().hex[:8]}"
        return pic
```

---

## 6. 实现阶段计划

### 阶段一：PDF 文字提取 + PPTX 基础框架（第 1-2 周）

**目标：** 建立可运行的最小可用系统

**产出：**
- [x] 项目目录结构
- [ ] `pdf_extractor.py` — PyMuPDF 文本提取
- [ ] `pptx_builder.py` — 基础幻灯片创建
- [ ] `text_builder.py` — 文本框重建（仅文字内容）
- [ ] `coord.py` — 坐标系转换工具
- [ ] 单页 PDF → 单页 PPTX 可用

**验收标准：** 纯文字 PDF 转换后文字可编辑，位置误差 < 5%

---

### 阶段二：图片提取 + 模块化处理（第 3-4 周）

**目标：** 图片完整保留，模块化嵌入

**产出：**
- [ ] `image_extractor.py` — PDF 内嵌图片提取
- [ ] `image_builder.py` — PPTX 图片插入
- [ ] 图片独立存储 + PPTX 引用

**验收标准：** 80%+ 图片被正确提取并嵌入

---

### 阶段三：图形/形状还原（第 5-6 周）

**目标：** 矢量图形 1:1 还原

**产出：**
- [ ] `shape_builder.py` — 矩形/圆形/直线/箭头还原
- [ ] `page.get_drawings()` 解析

**验收标准：** 简单几何图形还原率 > 90%

---

### 阶段四：色彩/字体精准还原（第 7-8 周）

**目标：** 视觉风格高度一致

**产出：**
- [ ] `color_analyzer.py` — 主题色提取
- [ ] `font_mapper.py` — 字体名映射
- [ ] 颜色值精确还原

**验收标准：** 主色调一致，字体 fallback 合理

---

### 阶段五：表格/图表 + AI 布局分析（第 9-10 周）

**目标：** 复杂内容结构化还原

**产出：**
- [ ] `table_extractor.py` — pdfplumber 表格提取
- [ ] `table_builder.py` — PPTX 表格构建
- [ ] `layout_analyzer.py` — MiniMax VL-01 布局分析
- [ ] 扫描件 OCR 支持

**验收标准：** 表格还原率 > 85%，AI 布局识别准确率 > 80%

---

## 7. 关键技术难点与对策

### 难点 1：PDF 文字层损坏（扫描件）

**问题：** 无可提取文字，纯图片 PDF
**对策：**
1. `pdf2image` 渲染高清图片
2. `pytesseract` OCR 文字识别
3. MiniMax VL-01 辅助布局理解

### 难点 2：复杂表格还原

**问题：** 合并单元格、嵌套表格在 PPTX 中难还原
**对策：**
- 降级策略：表格整体作为图片嵌入（保留视觉，牺牲可编辑性）
- L3 精确还原：仅处理标准矩形表格

### 难点 3：字体缺失

**问题：** PDF 内嵌字体在系统不存在
**对策：**
- 构建字体 fallback 链
- 警告用户缺失字体，手动替换

### 难点 4：图形还原精度

**问题：** 自由曲线/贝塞尔曲线在 PPTX 中难以精确还原
**对策：**
- 简化路径为基本图形组合
- 复杂路径降级为图片占位

---

## 8. 依赖库清单

```txt
# 核心库
python-pptx>=0.6.21
PyMuPDF>=1.23.0
pdfplumber>=0.10.0
pdf2image>=1.16.0
Pillow>=10.0.0

# 数据处理
numpy>=1.24.0
scikit-learn>=1.3.0

# OCR（可选）
pytesseract>=0.3.10
```

### pip 安装命令

```bash
pip install python-pptx PyMuPDF pdfplumber pdf2image Pillow numpy scikit-learn
```

---

## 附录

### A. PyMuPDF 关键 API 速查

```python
import fitz  # PyMuPDF

doc = fitz.open("input.pdf")
page = doc[0]

# 文本提取（带坐标）
blocks = page.get_text("dict")["blocks"]

# 图片提取
images = page.get_images(full=True)

# 矢量图形
drawings = page.get_drawings()

# 页面尺寸
rect = page.rect  # fitz.Rect

doc.close()
```

### B. python-pptx 关键 API 速查

```python
from pptx import Presentation
from pptx.util import Pt, Emu
from pptx.dml.color import RGBColor

prs = Presentation()
slide = prs.slides.add_slide(prs.slide_layouts[6])  # 空白布局

# 文本框
left, top, width, height = Emu(100000), Emu(500000), Emu(2000000), Emu(500000)
txBox = slide.shapes.add_textbox(left, top, width, height)
tf = txBox.text_frame
p = tf.paragraphs[0]
p.text = "Hello"
p.font.size = Pt(18)
p.font.color.rgb = RGBColor(0, 0, 0)

# 图片
slide.shapes.add_picture("image.png", left, top, width, height)

# 表格
table = slide.shapes.add_table(rows, cols, left, top, width, height).table

prs.save("output.pptx")
```

---

*本文档为技术方案，待 coder 实现。*
*更新日期：2026-05-20*
