# 技术架构方案 - Image to PPTX

**项目:** Image to PPTX  
**版本:** v0.1.0  
**日期:** 2026-05-22  
**状态:** 规划中

---

## 1. 系统概述

### 1.1 核心思路

将 AI 图像生成作为"PPT 素材中心"：
1. 用户提供 PPT 需求和内容
2. AI 生成一张"PPT 设计图"（整体布局、配色、风格）
3. 从设计图提取素材（PNG/矢量图/无背景元素）
4. 用 Python + python-pptx 根据设计图和素材生成真实 PPTX

### 1.2 流程图

```
用户需求 → Content Analyzer → Prompt Engineer → Image Generator → Asset Extractor → PPTX Builder → 产出PPTX
```

---

## 2. 模块拆解

### 2.1 Content Analyzer（内容分析器）

**职责：** 理解用户需求，提取关键信息

**输入：** 用户的自然语言需求描述

**输出：**
- PPT 主题
- 内容结构（章节/幻灯片数量）
- 关键信息点
- 目标受众
- 使用场景

**技术方案：** 使用 LLM 做意图分析和信息提取

---

### 2.2 Prompt Engineer（提示词工程师）

**职责：** 生成高质量的 AI 生图提示词

**输入：** Content Analyzer 的输出 + 设计要求

**输出：** 结构化的设计图生成提示词

**设计图提示词结构：**
```
[构图] 16:9比例的PPT整体设计图，展示X张幻灯片的完整布局
[风格] 现代简约/商务正式/创意活泼
[配色] 主色:#XXXXXX 次色:#XXXXXX 背景:#XXXXXX
[布局] 标题区域、内容区域、图表区域、页脚区域
[字体] 标题字体、 正文字体
[元素] 具体视觉元素描述
```

---

### 2.3 Image Generator（图像生成器）

**职责：** 调用 AI 生图 API 生成 PPT 设计图

**支持模型：**
- MiniMax image-01（当前默认）
- 预留接口以便替换其他模型（OpenAI DALL-E、Stable Diffusion 等）

**API 调用方式：**
```python
# MiniMax image-01 示例
response = minimax.images.generate(
    model="image-01",
    prompt=design_prompt,
    aspect_ratio="16:9",
    resolution="2K"
)
```

**设计图要求：**
- 比例：16:9（1920x1080 或等比）
- 清晰展示每页布局
- 配色和字体清晰可辨
- 包含可提取的视觉元素

---

### 2.4 Asset Extractor（素材提取器）

**职责：** 从设计图中提取可用的视觉素材

**技术路线对比：**

| 方案 | 描述 | 优点 | 缺点 |
|------|------|------|------|
| 方案A | AI视觉模型分析 + 生成素材 | 灵活、可控 | 步骤多、成本高 |
| 方案B | 图像裁剪/去背景 | 简单直接 | 依赖设计图质量 |
| 方案C | img2img 参考设计图生成 | 风格统一 | 可能失真 |

**推荐方案：** 混合方案
1. 用 AI 视觉模型分析设计图，识别各元素
2. 对可裁剪元素（图标、背景装饰）直接裁剪去背景
3. 对需要生成的元素（插图、特殊图形）用 img2img 方式生成

**工具选型：**
- `pillow`：图像基本处理、裁剪
- `rembg`：去背景
- MiniMax/ChatGPT 视觉模型：分析设计图

---

### 2.5 PPTX Builder（PPTX 构建器）

**职责：** 使用 python-pptx 生成真实 PPTX 文件

**核心逻辑：**
```python
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RgbColor
from pptx.enum.text import PP_ALIGN

# 创建演示文稿（16:9）
prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

# 添加幻灯片
slide = prs.slides.add_slide(prs.slide_layouts[6])  # 空白布局

# 添加文本框
title_box = slide.shapes.add_textbox(Inches(0.5), Inches(0.5), Inches(12), Inches(1))
title_frame = title_box.text_frame
title_frame.text = "标题"
title_frame.font.size = Pt(44)
title_frame.font.bold = True
title_frame.font.color.rgb = RgbColor(0xXX, 0xXX, 0xXX)

# 添加图片
slide.shapes.add_picture("asset.png", Inches(1), Inches(2), width=Inches(4))
```

**布局解析：** 将设计图的布局信息（位置、尺寸）转换为 python-pptx 坐标

**配色应用：** 将设计图的配色方案应用到 PPT 的背景、文本、形状

---

## 3. 技术栈

### 3.1 核心依赖

| 库/工具 | 版本 | 用途 |
|---------|------|------|
| Python | >=3.10 | 运行环境 |
| python-pptx | >=0.6.21 | PPTX 文件生成 |
| Pillow | >=10.0.0 | 图像处理 |
| rembg | >=2.0.50 | 图像去背景 |
| openai/minimax SDK | 最新 | AI API 调用 |

### 3.2 项目结构

```
image-to-pptx/
├── config/
│   └── project.json          # 项目配置
├── solutions/                 # tech-lead 输出
│   ├── PRD.md               # 产品需求文档
│   ├── ARCHITECTURE.md      # 技术架构方案（本文件）
│   └── norms/              # 执行规范
├── assets/                  # 能力资产
│   ├── prompts/            # 提示词模板
│   │   ├── design_prompt_template.txt
│   │   └── content_analysis_prompt.txt
│   ├── templates/          # 模板库
│   └── golden-samples/     # 效果标准样本
├── code/                   # Tech-Dept 输出
│   ├── __init__.py
│   ├── content_analyzer.py
│   ├── prompt_engineer.py
│   ├── image_generator.py
│   ├── asset_extractor.py
│   └── pptx_builder.py
├── validation/             # validator 校验报告
└── test-reports/           # tester 测试报告
```

---

## 4. API 设计（预留）

### 4.1 主入口

```python
def generate_pptx(
    user_requirement: str,
    output_path: str = "./output.pptx",
    style: str = "modern",
    model: str = "minimax"
) -> str:
    """
    生成 PPTX 文件
    
    Args:
        user_requirement: 用户需求描述
        output_path: 输出文件路径
        style: 设计风格
        model: 图像生成模型
    
    Returns:
        生成的文件路径
    """
    pass
```

---

## 5. 风险与挑战

1. **设计图质量依赖**：生成的设计图质量直接影响最终 PPT 效果
2. **素材提取精度**：自动裁剪和去背景可能需要人工干预
3. **布局还原度**：设计图布局转换为 python-pptx 坐标可能存在偏差
4. **字体兼容性**：中文字体在不同系统上的兼容性
5. **AI 生成不确定性**：每次生成的设计图可能有差异

---

## 6. 未来扩展

- 支持更多 AI 生图模型（Midjourney、Stable Diffusion）
- 支持更多 PPT 模板风格
- 支持交互式设计预览和调整
- 支持批量生成和自动化工作流
- 封装为 OpenClaw Skill

---

**下次更新内容：** 
- 详细的 prompt 模板设计
- 素材提取的具体算法
- python-pptx 布局映射表