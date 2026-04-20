# PPT 测试存档

> 创建时间：2026-04-21 02:30 GMT+8
> 测试范围：Gamma API 核心功能

---

## 测试1：专业模式三种文本模式

### Test: generate 模式（扩充）
- generationId: V9l8J4a5GR5PHlSuGyHAH
- gammaUrl: https://gamma.app/docs/927nahsio4gl0jx
- credits: deducted=9, remaining=3206
- input: 产品介绍PPT（功能/用户管理/数据分析/报告生成）
- result: https://gamma.app/docs/927nahsio4gl0jx

### Test: condense 模式（缩减）
- generationId: owtK7bSyE6XnO0i9AmtKl
- gammaUrl: https://gamma.app/docs/yt8vttnaof5p56b
- credits: deducted=6, remaining=3200
- input: 年度总结（销售业绩详细描述，3个要点展开）
- result: https://gamma.app/docs/yt8vttnaof5p56b

### Test: preserve 模式（保持）
- generationId: 0M5KdEcovQohHSnFzGlJD
- gammaUrl: https://gamma.app/docs/shzxht4nnbqacrk
- credits: deducted=9, remaining=3191
- input: 公司介绍（深圳科技/2015年/清华背景）
- result: https://gamma.app/docs/shzxht4nnbqacrk

**结论**：三种文本模式均成功，condense消耗更少credits（6 vs 9）

---

## 测试2：Preview + Export 全流程

### Test: 完整流程测试
- generationId: （nFAASPRnchHg52WxXWv4v 或最新测试ID）
- gammaUrl: https://gamma.app/docs/rcjpuxaep46z95i
- credits: deducted=9, remaining=3206
- preview-pdf: 200 ready ✅
- export-watermarked: 200 PDF OK ✅

**流程**：
1. POST /api/gamma → generationId
2. GET /api/gamma?id=... → poll status until completed
3. GET /api/preview-pdf?generationId=... → { status:"ready", pdfUrl:"..." }
4. GET /api/export-watermarked?generationId=... → PDF with "ShengxinPPT" watermark

---

## 测试3：省心模式 Outline API

### Test: 基础outline生成
- Status: 200 ✅
- slides: 4页（正常返回）
- 60s超时限制：长内容（>3000字）可能超时

---

## 技术备注

### 水印限制
- 水印使用英文 "ShengxinPPT"（Helvetica Bold）
- 标准PDF字体不支持CJK（中文），需嵌入字体（需fontkit）
- 如需中文水印，需：npm install @pdf-lib/fontkit + 嵌入中文字体

### Credits消耗
- noImages模式：约6-9 credits/次
- 估算：10用户并发 = 90 credits/天 = 2700/月

### 已修复Bug
1. /generations/{id}/status → /generations/{id}
2. exportUrl从status返回，无需export API
3. X-API-KEY header（不是Bearer）
4. pdf-lib degrees类型 + Buffer转换
---

## 中文字体水印（未完成，待后续）

### 问题
- STHeiti Light.ttc（55MB）/ Songti.ttc（67MB）太大
- `@pdf-lib/fontkit` 注册后 `embedFont({ subset: true })` 报错：`_this.font.createSubset is not a function`
- 原因：Songti.ttc 是 TTC（TrueType Collection），需特殊处理

### 解决方案选项
1. 使用 tiny cn 字体（如 `npm i chinese-fonts`）
2. 用 Canvas API 前端加水印（绕过服务器）
3. 接受英文水印 "ShengxinPPT"（当前方案）
4. 用户确认后跳过预览直接看 Gamma 在线链接（fallback）

### 当前实现
英文水印 "ShengxinPPT"（Helvetica Bold）已可用，功能正常。
