# 省心PPT 商业化上线前备份记录

- 日期: 2026-06-01
- 版本: v10.80.2
- 目标: 商业化部署冲刺前，先完成可回滚备份与关键状态标记。

## 备份位置
- `backups/release-preprod-v10.80.2-20260601/`

## 备份内容
- 代码目录: `src/`
- 数据库目录: `supabase/`, `supabase-migrations/`
- 关键配置: `package.json`, `package-lock.json`, `next.config.ts`, `.gitignore`, `.env.example`, `vercel.json`
- 校验: `BACKUP-CHECKSUMS.sha256`
- 元数据: `BACKUP-METADATA.md`

## 启动状态标记
- 当前版本处于“商业化上线冲刺阶段（Pre-Commercial Hardening）”。
- 本阶段优先级:
  1. 支付与安全基线
  2. 数据权限与审计
  3. 质量门禁与回归验证
  4. 移动端UI适配（含主题色卡）
