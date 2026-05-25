# 图片转可编辑PPT - 技术方案

**版本：** v1.0
**日期：** 2026-05-20
**作者：** tech-lead
**状态：** 已完成方案设计

---

## 一、需求分析

### 用户明确需求
| 优先级 | 功能 | 说明 |
|--------|------|------|
| P1 必须 | 文字 OCR + 校对 + 修正 | 确保内容/大小/样式与原图一致 |
| P2 附加 | 图片/形状/图表可单独替换 | 不要求可编辑 |

### 输入素材
5张测试图片（路径已知）：
- `/Users/macmini/Downloads/ChatGPT Image 2026年5月20日 01_55_59 (1).png`
- `/Users/macmini/Downloads/ChatGPT Image 2026年5月20日 01_55_59 (2).png`
- `/Users/macmini/Downloads/ChatGPT Image 2026年5月20日 01_56_00 (3).png`
- `/Users/macmini/Downloads/ChatGPT Image 2026年5月20日 01_56_00 (5).png`
- `/Users/macmini/Downloads/ChatGPT Image 2026年5月20日 01_56_01 (4).png`

---

## 二、技术方案

### 2.1 整体架构

```
输入图片 → OCR提取 → GPT校验 → 样式识别 → PPTX生成
   ↓         ↓          ↓          ↓           ↓
 原图    文字+位置    内容修正   字体/颜色   可编辑PPT
       +元素分割    → 输出PPTX
```

### 2.2 核心技术选型

| 模块 | 方案 | 原因 |
|------|------|------|
| **OCR引擎** | PaddleOCR (中文加强版) | 中文识别率最高，支持版面分析 |
| **文字校验** | GPT-4o | 上下文理解，修正OCR误差 |
| **样式提取** | OpenCV + 图像分析 | 字体大小/颜色/粗细推断 |
| **元素分割** | 传统图像处理 + 颜色分析 | 分离图片/形状/图表 |
| **PPTX生成** | python-pptx | 成熟库，支持完整样式控制 |

### 2.3 文字提取流程（核心P1）

#### 步骤1：OCR提取
```python
# 使用 PaddleOCR 进行文字检测+识别
from paddleocr import PaddleOCR

ocr = PaddleOCR(use_angle_cls=True, lang='chinese')
result = ocr.ocr(image_path)

# 输出结构化数据：
# {
#   "text": "文字内容",
#   "bbox": [x1,y1,x2,y2],
#   "confidence": 0.95,
#   "font_size": 14,
#   "font_color": "#333333",
#   "font_bold": False
# }
```

#### 步骤2：文字校验（GPT-4o）
```python
# 将OCR结果发送给GPT-4o校验
prompt = f"""
请校验以下OCR提取的文字内容，修正错误：
图片中提取的文字：
{extracted_text}

请返回：
1. 修正后的文字（如有错误）
2. 每段文字的语义标签（标题/正文/标注）
3. 建议的字体样式（标题/正文）
"""
```

#### 步骤3：样式还原
- **字体大小**：根据文字区域高度 + 原图DPI换算
- **字体颜色**：OCR时同步提取（或通过图像分析）
- **粗体/斜体**：通过文字区域笔画密度判断
- **段落样式**：根据位置关系（居中/左对齐/右对齐）

### 2.4 元素分离流程（P2）

#### 图片区域检测
```python
# 使用颜色/边缘检测分离图片和背景
import cv2

# 方法1：颜色阈值分离（适合纯色背景）
# 方法2：边缘检测 + 轮廓分析（适合复杂背景）
# 方法3：深度学习分割（Unet/Removebg）如需高精度
```

#### 图表/形状处理
```
分离策略：
1. 矢量元素（PPT中绘制）→ 还原为PPT形状
2. 位图元素 → 导出为图片，嵌入PPT作为图片占位符
```

### 2.5 PPTX生成规格

```python
from pptx import Presentation
from pptx.util import Pt, Inches
from pptx.dml.color import RGBColor

prs = Presentation()
prs.slide_width = Inches(13.333)  # 16:9
prs.slide_height = Inches(7.5)

# 文字样式规范
TEXT_STYLES = {
    "title": {"font_size": 44, "bold": True, "color": "#1a1a1a"},
    "heading": {"font_size": 32, "bold": True, "color": "#333333"},
    "body": {"font_size": 18, "bold": False, "color": "#4a4a4a"},
    "caption": {"font_size": 14, "bold": False, "color": "#666666"}
}
```

---

## 三、校对机制（核心流程）

### 四轮校对流程

```
[第1轮] OCR提取
    ↓
[第2轮] GPT-4o 校验内容准确性
    ↓
[第3轮] 用户确认/修正 ← 关键环节
    ↓
[第4轮] 生成最终PPTX
```

### 详细说明

| 轮次 | 执行者 | 输入 | 输出 | 等待 |
|------|--------|------|------|------|
| 第1轮 | coder | 图片 | OCR结果JSON | 否 |
| 第2轮 | coder | OCR结果 | GPT校验+修正 | 否 |
| 第3轮 | 用户 | 中间预览 | 确认/修正指令 | **是（阻塞）** |
| 第4轮 | coder | 用户确认 | 最终PPTX | 否 |

---

## 四、输出格式

### 目录结构
```
projects/shengxin-ppt/
├── test-output/              # 测试输出目录
│   ├── img2pptx-01.pptx      # 第1张图片的PPTX
│   ├── img2pptx-02.pptx      # 第2张图片的PPTX
│   └── ...
├── solutions/                # 方案目录
│   └── 2026-05-20-img2pptx-solution.md  # 本方案
└── img2pptx/                 # 功能代码目录
    ├── ocr_engine.py
    ├── gpt_validator.py
    ├── style_extractor.py
    ├── element_separator.py
    └── pptx_generator.py
```

### PPTX 内部结构
```
幻灯片内容：
├── 文字层（可编辑）
│   ├── 标题文字（独立文本框）
│   ├── 正文字符（独立文本框）
│   └── 标注文字（独立文本框）
├── 图片占位层
│   └── [图片区域] - 可右键替换
├── 形状/图表层
│   └── [独立形状] - 可编辑颜色/大小
└── 背景样式
    └── 颜色/渐变/纹理（如需）
```

---

## 五、实现步骤

### coder 执行清单

| 步骤 | 内容 | 优先级 |
|------|------|--------|
| 1 | 安装依赖：paddleocr, python-pptx, opencv-python | 必须 |
| 2 | 编写 ocr_engine.py - OCR提取模块 | 必须 |
| 3 | 编写 gpt_validator.py - GPT校验模块 | 必须 |
| 4 | 编写 pptx_generator.py - PPTX生成模块 | 必须 |
| 5 | 对5张测试图运行第1-2轮（OCR+GPT） | 必须 |
| 6 | 提交中间结果给用户确认（第3轮） | 阻塞 |
| 7 | 根据用户反馈生成最终PPTX | 必须 |
| 8 | 输出到 test-output/ 目录 | 必须 |

---

## 六、风险与备选

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| OCR中文识别率低 | 中 | 高 | 使用PaddleOCR中文模型，备选Tesseract |
| 样式还原不准确 | 中 | 中 | 用户第3轮确认时可修正 |
| 图片元素误识别 | 低 | 低 | P2功能，可延后处理 |
| GPT校验耗时过长 | 低 | 低 | 并行处理，timeout 30s |

---

## 七、验收标准

### P1 必须通过
- [ ] 5张测试图的文字正确提取（准确率 > 95%）
- [ ] 文字内容与原图一致（用户确认）
- [ ] 字体大小/样式基本还原
- [ ] 导出PPTX可正常打开编辑

### P2 附加验收
- [ ] 图片区域可识别并替换
- [ ] 形状/图表可分离处理

---

## 八、交付物

1. **方案文档**：已保存至 `solutions/2026-05-20-img2pptx-solution.md`
2. **代码模块**：需 coder 执行后生成
3. **测试输出**：需 coder 执行后生成

---

**下一步行动**：coder 执行步骤 1-5，向 main 汇报第1-2轮结果，等待用户确认第3轮。

---
*tech-lead 汇报完毕*