# 省心PPT 项目接力包（v10.80.1）

更新时间：2026-05-27  
线上域名：https://shengxinppt.lol

## 1) 项目当前状态（给新窗口先读）

- 当前线上基线：`v10.80`（历史已上线基线）
- 当前代码版本：`v10.80.1`（本地代码标记）
- 已锁定模块：主题色系（首页高级选项）
- 锁定文档：
  - `/Users/macmini/shengshi-ppt/docs/user/UI-STYLE-LOCK-v10.80.md`
  - `/Users/macmini/shengshi-ppt/docs/user/UI-STYLE-LOCK-v10.73.md`

## 2) 主题色系硬规则（不可破坏）

1. 页面文案必须用“主题色系”，禁止“主题风格”
2. 推荐色系保持现状（逻辑、排序、内容都不改）
3. 正式色系必须固定映射，禁止自动猜测
4. 色系顺序固定：
   - 蓝色系
   - 橙棕色系
   - 米黄色系
   - 绿色系
   - 白灰色系
   - 黑色系
   - 紫粉色系
5. 每个主题只能在一个色系中出现一次
6. 每个色系最多 10 个主题（每行最多 5 个，最多 2 行）
7. 禁止临时分裂命名（如“橙红色·2”）

## 3) 关键文件（优先检查）

- 主题数据源：`/Users/macmini/shengshi-ppt/src/lib/theme-database.ts`
- 主题选择器：`/Users/macmini/shengshi-ppt/src/components/ThemeSelector.tsx`
- 主题弹窗：`/Users/macmini/shengshi-ppt/src/components/ThemePickerModal.tsx`
- 版本：`/Users/macmini/shengshi-ppt/src/lib/version.ts`
- 包版本：`/Users/macmini/shengshi-ppt/package.json`

## 4) 待验证重点（业务备注，必须保留）

后续我会实际的调用，以验证是否生成结果对齐选择的色系。  
参数和主题是否真实对应生成ppt出来的结果，需验证。

## 5) 新窗口启动指令（直接复制粘贴）

```text
先不要改代码。先阅读并复述以下文件，再开始执行：
1) /Users/macmini/shengshi-ppt/docs/user/SESSION-HANDOFF-v10.80.1.md
2) /Users/macmini/shengshi-ppt/docs/user/UI-STYLE-LOCK-v10.80.md
3) /Users/macmini/shengshi-ppt/src/lib/theme-database.ts

执行要求：
- 不允许破坏已锁定UI风格和主题色系规则
- 推荐色系不可改
- 正式色系必须固定映射，不能自动猜测
- 不允许出现“主题风格”“橙红色·2”
- 修改后先给我：变更文件清单 + 自检结果 + 风险点，再部署
- 禁止提交 .env.production.local
- 禁止 git add -A 全量发布（必须最小范围发布）
```

## 6) 发布前自检清单（必须逐条回报）

- [ ] 页面不再出现“主题风格”
- [ ] 不再出现“橙红色·2”
- [ ] `unmatchedThemes` 为空
- [ ] 每个主题只出现一次
- [ ] 每个色系不超过 10 个主题
- [ ] 推荐色系未改动
- [ ] 本次发布仅包含目标修复文件
- [ ] `.env.production.local` 未纳入提交
