# 质量标准 — PDF/图片 转 PPTX 模块

> **项目：** 省心PPT (shengxin-ppt)
> **模块：** pdf_to_pptx
> **版本：** v1.0
> **日期：** 2026-05-20

---

## 1. 质量等级定义

### 综合质量等级

| 等级 | 总分要求 | 文字还原率 | 视觉还原率 | 可编辑率 |
|------|---------|-----------|-----------|---------|
| **A** | ≥ 90% | ≥ 95% | ≥ 90% | ≥ 90% |
| **B** | ≥ 75% | ≥ 85% | ≥ 75% | ≥ 80% |
| **C** | ≥ 60% | ≥ 70% | ≥ 65% | ≥ 70% |
| **D** | < 60% | - | - | - |

**综合分数计算：**
```
总分 = 文字还原率×0.35 + 视觉还原率×0.30 + 可编辑率×0.20 + 布局准确率×0.15
```

---

## 2. 精准还原率 — 衡量指标

### 2.1 文字还原率 (Text Fidelity)

**定义：** 提取并正确重建的文字内容占原文的比例

**计算公式：**

```
文字还原率 = (正确字数 / 总字数) × 100%

正确字数的判定：
✓ 文字内容完全一致
✓ 文字内容一致但字体/颜色略有差异（允许）
✗ 文字丢失（未提取）
✗ 文字内容错误（OCR误识）
✗ 文字顺序错乱
```

**分级标准：**

| 等级 | 还原率 | 说明 |
|------|--------|------|
| 优 | ≥ 98% | 仅极少量标点或生僻字有误 |
| 良 | 90% - 97% | 少量文字偏差，可接受 |
| 中 | 75% - 89% | 部分文字丢失或误识 |
| 差 | < 75% | 大面积文字问题 |

**测量方法：**
```python
# 伪代码
original_text = extract_text_from_pdf(pdf_path)
rebuilt_text = extract_text_from_pptx(pptx_path)

# 使用 difflib 计算相似度
from difflib import SequenceMatcher
ratio = SequenceMatcher(None, original_text, rebuilt_text).ratio()
```

---

### 2.2 视觉还原率 (Visual Fidelity)

**定义：** PPTX 视觉呈现与原始 PDF/图片的相似程度

**评估维度：**

| 维度 | 权重 | 评估方法 |
|------|------|---------|
| 页面布局 | 30% | 对比元素位置坐标偏差 |
| 色彩一致 | 25% | 主色调色差 ΔE < 10 |
| 图片保留 | 20% | 图片数量 + 尺寸匹配 |
| 图形还原 | 15% | 基本图形 vs 原始路径 |
| 整体风格 | 10% | 人工打分（1-10） |

**色彩一致性测量（ΔE 色差）：**

```python
# ΔE 2000 色差公式（简化版）
import numpy as np

def color_delta_e(c1_rgb, c2_rgb):
    """计算两个 RGB 颜色的色差"""
    # 转换到 Lab 色彩空间（简化）
    r1, g1, b1 = np.array(c1_rgb) / 255
    r2, g2, b2 = np.array(c2_rgb) / 255

    # 简化欧氏距离（实际应使用 CIEDE2000）
    delta = np.sqrt((r1-r2)**2 + (g1-g2)**2 + (b1-b2)**2)
    return delta * 100  # 归一化到 0-100

# ΔE < 5: 几乎无差异
# ΔE 5-10: 有细微差异
# ΔE 10-20: 可察觉差异
# ΔE > 20: 明显差异
```

---

### 2.3 可编辑率 (Editability Rate)

**定义：** PPTX 中内容可以被编辑的比例

**评估项：**

```
可编辑率 = (可编辑项目数 / 总项目数) × 100%

可编辑判定：
✓ 文字文本框 → 可编辑
✓ 表格单元格 → 可编辑
✗ 图片占位 → 不可直接编辑文字
✗ 图形组合 → 部分可编辑
✗ 扫描件（无文字层）→ 全部为图片，不可编辑
```

**分级标准：**

| 等级 | 可编辑率 |
|------|---------|
| 完全可编辑 | ≥ 95% |
| 基本可编辑 | 70% - 94% |
| 部分可编辑 | 40% - 69% |
| 不可编辑 | < 40% |

---

### 2.4 布局准确率 (Layout Accuracy)

**定义：** 元素位置与原始 PDF 的匹配程度

**测量方法：**

```python
def layout_accuracy(pdf_elements, pptx_elements):
    """
    计算布局准确率
    基于 IoU（Intersection over Union）匹配
    """
    ious = []
    for pdf_elem in pdf_elements:
        best_iou = 0
        for pptx_elem in pptx_elements:
            iou = compute_iou(pdf_elem.bbox, pptx_elem.bbox)
            best_iou = max(best_iou, iou)
        ious.append(best_iou)

    # IoU ≥ 0.7 视为匹配
    matched = sum(1 for iou in ious if iou >= 0.7)
    return matched / len(ious) if ious else 0

def compute_iou(bbox1, bbox2):
    """计算两个 bbox 的 IoU"""
    x1 = max(bbox1[0], bbox2[0])
    y1 = max(bbox1[1], bbox2[1])
    x2 = min(bbox1[2], bbox2[2])
    y2 = min(bbox1[3], bbox2[3])

    inter = max(0, x2-x1) * max(0, y2-y1)
    area1 = (bbox1[2]-bbox1[0]) * (bbox1[3]-bbox1[1])
    area2 = (bbox2[2]-bbox2[0]) * (bbox2[3]-bbox2[1])
    union = area1 + area2 - inter

    return inter / union if union > 0 else 0
```

---

## 3. 内容类型质量标准

### 3.1 纯文字 PDF

| 指标 | 最低要求 | 目标值 |
|------|---------|--------|
| 文字还原率 | 95% | 99% |
| 字体还原 | 字体族正确 | 字体完全匹配 |
| 字号还原 | 误差 ≤ 2 PT | 完全匹配 |
| 位置准确 | IoU ≥ 0.7 | IoU ≥ 0.85 |

### 3.2 图文混排 PDF

| 指标 | 最低要求 | 目标值 |
|------|---------|--------|
| 文字还原率 | 90% | 97% |
| 图片提取率 | 80% | 98% |
| 图片位置 | IoU ≥ 0.6 | IoU ≥ 0.8 |
| 排版还原 | 主体结构保留 | 细节一致 |

### 3.3 含表格 PDF

| 指标 | 最低要求 | 目标值 |
|------|---------|--------|
| 表格结构还原 | 行/列数正确 | 100% 精确 |
| 单元格内容 | 95% 文字正确 | 99% |
| 合并单元格 | 识别 80% | 95% |
| 降级处理 | 表格→图片可接受 | 不降级 |

### 3.4 扫描件/图片输入

| 指标 | 最低要求 | 目标值 |
|------|---------|--------|
| OCR 识别率 | 85% | 95% |
| 文字可搜索 | 是 | 是 |
| 布局推断 | 基本正确 | 细节还原 |
| 转换时间 | < 30s/页 | < 10s/页 |

---

## 4. 性能标准

| 指标 | 要求 | 说明 |
|------|------|------|
| **转换速度** | ≤ 5s/页（纯文字） | 普通 PDF |
| **转换速度** | ≤ 15s/页（图文混排） | 含大量图片 |
| **转换速度** | ≤ 30s/页（扫描件+OCR） | 扫描件 |
| **内存占用** | ≤ 500MB/进程 | 单次转换 |
| **最大支持页数** | 1000 页 | 无限制，但性能可能下降 |

---

## 5. 错误容忍标准

### 5.1 单页失败处理

```python
# 规则：单页失败不影响其他页面
# 失败页面以图片形式降级嵌入
# 记录到 issues[]

result = {
    "status": "partial_success",  # 只要有 ≥ 1 页成功，即 partial_success
    "failed_pages": [3, 7],      # 记录失败页码
    "issues": [
        "Page 3: 图片提取失败，降级为占位符",
        "Page 7: 表格解析异常，使用图片替代"
    ]
}
```

### 5.2 失败场景与降级策略

| 失败场景 | 降级策略 | 用户提示 |
|---------|---------|---------|
| 字体缺失 | 使用 fallback 字体 | 警告：某字体已替换 |
| 图片过大（> 10MB） | 压缩为 JPEG 85% | 自动压缩 |
| 图片损坏 | 跳过该图，记录警告 | 某图片无法提取 |
| 表格复杂无法解析 | 转为图片占位 | 表格还原受限 |
| PDF 加密 | 提示需要密码 | 无法处理加密 PDF |
| OCR 失败 | 仍保留图片形式 | OCR 识别失败 |

---

## 6. 质量验收测试

### 6.1 测试用例集

| 测试用例 | 类型 | 预期等级 |
|---------|------|---------|
| `simple_text.pdf` | 纯文字 | A |
| `with_images.pdf` | 图文混排 | B |
| `with_table.pdf` | 含表格 | B |
| `scanned.pdf` | 扫描件 | C |
| `mixed_layout.pdf` | 复杂排版 | B |
| `color_theme.pdf` | 多色系 | B |
| `charts.pdf` | 图表 | C（图表→图片） |

### 6.2 自动化验收脚本

```python
# test_quality.py（伪代码）
def test_fidelity(input_pdf, golden_pptx, output_pptx):
    results = {
        "text_fidelity": compute_text_fidelity(output_pptx),
        "visual_fidelity": compute_visual_fidelity(input_pdf, output_pptx),
        "editability_rate": compute_editability(output_pptx),
        "layout_accuracy": compute_layout_accuracy(input_pdf, output_pptx),
    }
    results["total_score"] = (
        results["text_fidelity"] * 0.35 +
        results["visual_fidelity"] * 0.30 +
        results["editability_rate"] * 0.20 +
        results["layout_accuracy"] * 0.15
    )
    return results
```

### 6.3 质量报告格式

```json
{
  "file": "test_sample.pdf",
  "date": "2026-05-20",
  "overall_grade": "B",
  "total_score": 78.5,
  "breakdown": {
    "text_fidelity": 92.3,
    "visual_fidelity": 75.0,
    "editability_rate": 80.0,
    "layout_accuracy": 70.0
  },
  "issues": [
    "Page 2: 1张图片提取失败",
    "Page 5: 表格降级为图片占位"
  ],
  "passed": true,
  "threshold": 75
}
```

---

## 7. 用户可见质量指标

转换完成后，向用户展示：

```
✅ 转换完成
📄 共 12 页
✏️ 文字 1,234 字（还原率 96%）
🖼️ 图片 8 张（提取率 100%）
📊 表格 2 个（还原率 90%）
⚠️ 3 个问题（已记录）
```

---

*更新日期：2026-05-20*
