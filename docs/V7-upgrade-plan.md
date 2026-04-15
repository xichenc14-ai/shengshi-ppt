# 省心PPT V7 重大升级方案

> 日期：2026-04-15
> 状态：方案确认，执行中
> 优先级：P0 技术优先（商业化暂缓）

---

## 一、需求来源（兮晨哥哥原话）

### 需求1：全模式大纲可编辑
> "无论什么模式，都要展现大纲，并且可编辑，减少用户抽盲盒的感觉"

### 需求2：在线预览 + 重做/下载
> "PPT返回后，直接给用户预览。不满意可以重做，满意就下载"

### 需求3：付费制度（商业化暂缓，但架构先搭好）
> "非会员按次按页数收费，1页2毛（免费图），每月3次免费下载（带水印PDF），每月1次体验原生PPT"
> "生成即扣积分（Gamma回调），付费用户有积分就不另付，免费用户下载需结算"

### 需求4：输入校验
> "单文件≤50MB，最多9个文件，总字数限制，防止超大量数据"

---

## 二、技术方案

### 2.1 全模式大纲可编辑 ✅

**现状**：
- 专业模式（direct）：有 `generateDirect()` 直接调用 gamma-direct，跳过大纲
- 省心模式（smart）：有 `generateOutline()` → 大纲编辑 → `confirmAndGenerate()`

**改造方案**：
- **废弃 `generateDirect()` 直通流程**
- 所有模式统一走：输入 → AI生成大纲 → 大纲编辑页 → 确认生成 → 结果
- 专业模式的"扩充/缩减/保持"选项保留，作为 outline API 的 textMode 参数
- 大纲编辑页支持：编辑标题、编辑内容、拖拽排序、添加/删除页、重做

**用户流程**：
```
输入需求 + 选择参数 → AI生成大纲 → 大纲编辑页（可编辑）→ 确认生成 → 预览结果 → 下载/重做
```

### 2.2 在线预览（Gamma iframe 嵌入） ✅

**技术分析**：

Gamma API 生成完成后返回：
- `gammaUrl`: `https://gamma.app/docs/xxx` — Gamma 托管的在线预览页
- `exportUrl`: `https://assets.api.gamma.app/export/pptx/xxx/file.pptx` — 下载链接

**方案**：
1. Gamma 生成完成后，获取 `gammaUrl`
2. 通过 `/api/preview?url=xxx` 代理嵌入 iframe（已有此 API）
3. 结果页改为：iframe 预览 + 操作按钮（下载/重做）

**并发/性能考虑**：
- Gamma 预览由 Gamma CDN 托管，**不消耗我们的服务器资源**
- iframe 嵌入是纯客户端渲染，**零内存压力**
- 不需要存储 PPT 文件，Gamma 负责托管
- 并发限制由 Gamma 自身处理，我们只做请求限流

**注意事项**：
- Gamma 可能有 X-Frame-Options 限制 → 代理方案兜底
- 预览链接有效期：Gamma 托管链接通常长期有效
- 降级方案：如果 iframe 被拦截，显示截图预览 + 直接下载按钮

### 2.3 付费制度架构（先搭框架，暂不启用支付）

**双层积分体系**：

```
┌─────────────────────────────────────────────┐
│              积分系统（已有）                  │
│  生成PPT时扣积分（Gamma credits换算）         │
│  付费会员 = 月费包含积分                      │
│  免费用户 = 注册送50积分                      │
└─────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│           下载付费体系（新增）                 │
│                                             │
│  付费会员：积分足够 → 直接下载（免费）         │
│  免费用户：                                  │
│    - 每月3次免费下载（带水印PDF）              │
│    - 每月1次体验原生PPT                       │
│    - 超出后：按次/页数付费（¥0.2/页）          │
│                                             │
│  ⚠️ 生成即扣积分（不可退）                    │
│  ⚠️ 下载付费与积分独立                        │
└─────────────────────────────────────────────┘
```

**数据库字段（新增）**：
```sql
-- users 表新增字段
ALTER TABLE users ADD COLUMN monthly_free_downloads INTEGER DEFAULT 3;
ALTER TABLE users ADD COLUMN monthly_ppt_trials INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN download_count_month INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN ppt_trial_count_month INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN download_reset_month VARCHAR(7); -- '2026-04'
```

**下载权限检查逻辑**：
```typescript
function checkDownloadPermission(user, pages, format) {
  // 1. 付费会员 → 检查积分
  if (user.plan_type !== 'free') return { allowed: true, cost: 0 };
  
  // 2. 免费用户 → 检查月度配额
  const month = getCurrentMonth(); // '2026-04'
  if (user.download_reset_month !== month) {
    // 月度重置
    return { allowed: true, cost: 0, isFreeDownload: true };
  }
  
  // 3. 还有免费PDF下载次数
  if (user.download_count_month < 3 && format === 'pdf') {
    return { allowed: true, cost: 0, watermarked: true };
  }
  
  // 4. 还有原生PPT体验次数
  if (user.ppt_trial_count_month < 1 && format === 'pptx') {
    return { allowed: true, cost: 0, isTrial: true };
  }
  
  // 5. 需要付费
  const cost = pages * 0.2; // ¥0.2/页
  return { allowed: true, needPayment: true, cost };
}
```

### 2.4 输入校验

**限制规则**：

| 限制项 | 值 | 说明 |
|--------|-----|------|
| 单文件大小 | ≤ 50MB | 防止超大文件 |
| 文件数量 | ≤ 9个 | 最多9个附件 |
| 总文件大小 | ≤ 100MB | 总计不超过100MB |
| 文本字数 | ≤ 10,000字 | topic + 文件内容总计 |
| 文件类型 | 白名单 | .txt/.md/.pdf/.doc/.docx/.xls/.xlsx/.csv/.png/.jpg/.jpeg/.webp/.ppt/.pptx |
| 图片文件 | ≤ 20MB/张 | 图片单独限制 |

**实现位置**：前端 fileProcess + 后端 outline API 双重校验

---

## 三、实施计划

### Phase 1：全模式大纲可编辑（本次实施）
1. 废弃 `generateDirect()`，所有模式走 outline → 编辑 → 生成
2. 专业模式参数（扩充/缩减/保持）传入 outline API
3. 生成按钮统一调用 `generateOutline()`
4. Build 验证

### Phase 2：在线预览（本次实施）
1. Gamma 生成完成后获取 `gammaUrl`
2. 结果页嵌入 iframe 预览
3. 添加"重做"按钮（返回大纲编辑页）
4. 代理 API 增强（处理 X-Frame-Options）

### Phase 3：输入校验（本次实施）
1. 前端：文件上传前校验大小/数量/类型
2. 前端：文本字数实时计数 + 超限提示
3. 后端：outline API 增加输入校验

### Phase 4：付费架构（框架搭建，暂不启用支付）
1. 数据库字段添加（Supabase migration）
2. 下载权限检查函数
3. 下载计数 API
4. 带水印 PDF 生成（预留）

---

## 四、关键代码变更

### page.tsx 主要变更
- 移除 `generateDirect()` 函数
- 生成按钮统一调用 `generateOutline()`
- `generateOutline()` 根据模式设置 textMode
- 结果页改为 iframe 预览 + 操作按钮
- 添加输入校验逻辑

### API 变更
- `/api/outline`：增加输入校验（字数/文件大小限制）
- `/api/gamma` GET：确保返回 gammaUrl
- `/api/preview`：增强代理（处理 CORS/X-Frame）
- `/api/user` POST：新增 download 相关 action

### 新增文件
- `src/lib/input-validation.ts`：输入校验工具函数

---

## 五、风险点

| 风险 | 影响 | 缓解方案 |
|------|------|---------|
| Gamma iframe 被拦截 | 无法在线预览 | 代理 + 降级为下载按钮 |
| Gamma gammaUrl 过期 | 预览失效 | 轮询保存 exportUrl 兜底 |
| 大文件上传内存溢出 | 服务崩溃 | 前端限制 + 后端 body size limit |
| 并发生成过多 | Gamma 限流 | API rate limit 已有 |

---

_方案作者：省心PPT · 2026-04-15_
_兮晨哥哥指令确认，商业化暂缓，技术优先_
