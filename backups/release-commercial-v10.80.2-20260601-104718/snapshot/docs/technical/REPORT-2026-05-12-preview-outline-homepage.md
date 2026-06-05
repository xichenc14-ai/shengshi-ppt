# 省心PPT 修复复盘报告（2026-05-12）

## 1) 背景与目标

本轮修复聚焦两条主线：

1. 核心可用性：大纲生成稳定、预览稳定、下载稳定。  
2. 核心体验：首页即编辑、结果页自动预览，降低用户等待与跳转成本。

适用版本基线：`main @ 3d7360c`  
关联线上域名：`https://shengxinppt.lol`

---

## 2) 主要问题（修复前）

1. 在线预览偶发报错：`gamma.app 拒绝了我们的连接请求`。  
2. PPTX 预览链路可用但卡顿明显（Office embed 首屏慢、渲染重）。  
3. PDF 预览不稳定（部分路由混用非官方导出接口）。  
4. 首页进入流程偏“二级路径”（先落地页再进编辑），输入效率低。  
5. 下载与预览逻辑耦合，异常提示不一致。

---

## 3) 根因分析

### 3.1 预览拒绝连接根因

- `gamma.app` 页面受到 iframe 策略限制，不能作为站内通用嵌入源。  
- 直接 iframe Gamma 链接会触发浏览器安全策略，导致“拒绝连接”。

### 3.2 多格式导出误区

- Gamma API 的 `exportAs` 是**单次请求单格式**（PDF/PPTX/PNG 三选一）。  
- 不能在同一个 generation 里同时获得可用 `pdf` 与 `pptx` 导出文件。

### 3.3 体验卡顿根因

- PPTX 在线预览依赖外部文档渲染服务，加载与解析成本高于 PDF。  
- 预览在弹窗二级层触发，用户需要额外点击，等待感更强。

---

## 4) 最终设计方案（已落地）

## 4.1 预览策略

- **站内预览优先 PDF**：结果页自动加载 PDF。  
- 不再依赖 Gamma 页面嵌入。  
- 通过后端代理文件流：`/api/preview/file`。

## 4.2 下载策略

- 用户下载目标保留 `PPTX`。  
- 当当前 generation 为 PDF 时，下载动作自动补跑一条 `PPTX` generation，再下载（用户侧一键完成）。

## 4.3 页面交互策略

- 首页默认直接进入输入编辑态（不再默认落地页）。  
- 专业模式高级参数默认折叠（“展开高级选项”后显示）。  
- 结果页预览改为一级页面内联，不再使用二级弹窗。

---

## 5) 代码落点

## 5.1 预览后端

- [src/app/api/preview/file/route.ts](/Users/macmini/shengshi-ppt/src/app/api/preview/file/route.ts)  
  - 严格使用官方状态接口返回的 `exportUrl` 下载文件。  
  - 增加“导出格式不匹配”的明确错误信息。  
  - 返回标准 `Content-Type` 与 `Content-Disposition`，供前端直接预览/下载。

## 5.2 前端主流程

- [src/app/page.tsx](/Users/macmini/shengshi-ppt/src/app/page.tsx)  
  - `phase` 默认改为 `input`（首页即编辑）。  
  - 结果页自动执行 `loadInlinePreview()`，直接加载 PDF 预览。  
  - 移除二级预览弹窗逻辑，改为内联预览面板。  
  - 引入 `pptxSeedBody / pptxSeedEndpoint / ensurePptxGenerationId`，实现“PDF主任务 + PPTX按需补跑下载”。

---

## 6) 验证结果（已实测）

## 6.1 API 端到端实测

- PDF 生成完成后，`/api/preview/file?format=pdf` 返回 `200` + `application/pdf`。  
- PPTX 生成完成后，`/api/export-pptx` 返回 `200` + `application/vnd.openxmlformats-officedocument.presentationml.presentation`。  
- 文件签名校验：PPTX 为 `PK`，符合 Office OpenXML 文件头。

## 6.2 浏览器实测

- 首页打开即出现输入编辑区域与文本框。  
- “展开高级选项”可见，默认收起。  
- 预览不再走 Gamma iframe 路径，避免“拒绝连接”问题复现路径。

---

## 7) 本轮关键提交（便于团队回看）

- `52e01dc` `fix(preview): use official gamma exportUrl flow for file preview`  
- `3d7360c` `feat(ui): inline auto PDF preview and homepage direct edit flow`

可结合以下历史提交查看演进链：

- `2611b4a` `39602e2` `9cb59b4` `22beac0` `6197f80`

---

## 8) 经验与规范沉淀

1. 对第三方内容站点，优先“后端拉取+自有域代理”而不是直接 iframe。  
2. 对异步生成 API，先确认“格式能力边界”（单格式/多格式）再设计 UI。  
3. 预览与下载应解耦：预览优先响应速度，下载优先目标格式。  
4. 结果页应自动展示核心产物，减少“点击后等待”的感知延迟。

---

## 9) 后续建议（下一阶段）

1. 为“补跑 PPTX 下载”加可视化进度（避免用户误判卡住）。  
2. 缓存已补跑的 `pptxGenerationId` 到历史记录，减少重复生成。  
3. 增加结果页预览失败的自动重试退避机制（例如 2 次短重试）。  
4. 建立“预览/下载/大纲”三条链路的监控指标（成功率、P95、失败码分布）。

---

## 10) 备注

- 本报告为“可转发给 Agent 团队学习”的执行版文档。  
- 若需要，我可以基于本报告再产出一版“新人 onboarding 任务清单（带逐步演练）”。
