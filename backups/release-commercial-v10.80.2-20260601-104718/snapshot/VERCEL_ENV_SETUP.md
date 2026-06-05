# Vercel 环境变量配置清单（必须配置）

> 最后更新：2026-04-12 14:40
> ⚠️ GLM/Kimi均为第三方代理，Base URL必须正确

## 🔴 必须配置（服务启动依赖）

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Supabase项目URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Supabase服务端Key |
| `SUPABASE_ANON_KEY` | `eyJ...` | Supabase匿名Key |
| `GAMMA_API_KEY` | `sk-gamma-mzwi...` | Gamma PPT生成 |
| `MINIMAX_API_KEY` | `sk-cp-kcRw0...` | MiniMax（备用模型） |
| `GLM_API_KEYS` | `sk-KMlAXUTq...` | GLM（兜底模型，mydamoxing代理） |
| `GLM_API_BASE` | `https://mydamoxing.cn/v1/chat/completions` | ⚠️ 第三方代理，非官方 |
| `KIMI_API_KEY` | `sk-qLv9UQS...` | Kimi（首选模型） |
| `KIMI_API_BASE` | `https://ai.1seey.com/v1` | ⚠️ 第三方代理，非moonshot官方 |
| `SESSION_PASSWORD` | `CgUsMUGGwS...` | iron-session加密密码 |

## ⚠️ 重要：AI模型全部是第三方代理

| 模型 | 代理Base URL | 官方？ | 成本 |
|------|-------------|--------|------|
| **GLM** | `mydamoxing.cn` | ❌ 第三方 | ¥2.1/M输入+¥8.4/M输出 |
| **Kimi** | `ai.1seey.com` | ❌ 第三方 | 免费 |
| **MiniMax** | `api.minimaxi.com` | ✅ 接近官方 | ¥4/M输入+¥16/M输出 |
| **Gamma** | `public-api.gamma.app` | ✅ 官方 | credits计费 |

### Fallback链：Kimi → MiniMax → GLM
1. Kimi K2.5（免费，首选）
2. MiniMax M2.7（备用，最贵）
3. GLM-5（兜底，稳定）

## 🟡 可选配置

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `TEST_XICHEN_PWD` | `123456` | 测试账号密码 |
| `TEST_ADMIN_PWD` | `admin123` | 测试管理员密码 |
