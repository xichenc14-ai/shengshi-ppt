# Vercel 环境变量配置清单（必须配置）

> 最后更新：2026-04-12 14:35
> 生成时间：`date +"%Y%m%d_%H%M%S"`

## 🔴 必须配置（服务启动依赖）

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Supabase项目URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Supabase服务端Key |
| `SUPABASE_ANON_KEY` | `eyJ...` | Supabase匿名Key |
| `GAMMA_API_KEY` | `sk-gamma-...` | Gamma API Key（PPT生成） |
| `MINIMAX_API_KEY` | `sk-cp-...` | MiniMax API Key（AI备用） |
| `GLM_API_KEYS` | `sk-aYk...,sk-Qe...,sk-ME...` | GLM API Keys（逗号分隔，AI首选） |
| `GLM_API_BASE` | `https://mydamoxing.cn/v1/chat/completions` | GLM第三方中转Base URL |
| `SESSION_PASSWORD` | `CgUsMUGGwSNTaI5l...` | iron-session加密密码（32字符+） |

## 🟡 可选配置

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `KIMI_API_KEY` | 待配置 | Kimi Key（当前无效，GLM已替代为首选） |
| `KIMI_API_BASE` | `https://api.moonshot.ai/v1` | Kimi Base URL |
| `TEST_XICHEN_PWD` | `123456` | 测试账号密码 |
| `TEST_ADMIN_PWD` | `admin123` | 测试管理员密码 |
| `NEXT_PUBLIC_BAIDU_TONGJI_ID` | 待配置 | 百度统计ID |

## ⚠️ 重要说明

### GLM 是第三方中转
- Base URL: `https://mydamoxing.cn/v1/chat/completions`
- 多Key轮询：`GLM_API_KEYS=key1,key2,key3`（逗号分隔）
- 当前作为AI首选模型（稳定可靠）
- 如果中转服务不可用，MiniMax自动备用

### MiniMax 是第三方代理
- Base URL: `https://api.minimaxi.com/v1`
- 与OpenClaw共用同一个Key
- 当前作为AI备用模型

### Kimi 暂时跳过
- 当前KIMI_API_KEY无效（旧Key过期）
- GLM和MiniMax已覆盖所有场景
- 有效Key配好后可恢复Kimi为首选

### 支付回调（上线前配置）
- 需微信商户号后接入
