# 省心PPT 文档管理体系

> **版本**: v1.0  
> **建立日期**: 2026-05-10  
> **最后更新**: 2026-05-10

---

## 文档分类

### 1. 用户文档 (User Docs)
**位置**: `/docs/user/`

| 文档名称 | 内容 | 负责人 |
|---------|------|--------|
| `README.md` | 产品介绍、快速上手 | 运营 |
| `FAQ.md` | 常见问题解答 | 运营 |
| `pricing.md` | 套餐说明、价格 | 运营 |
| `changelog.md` | 版本更新日志 | 开发 |
| `feedback-*.md` | 用户反馈记录 | 运营 |

**格式规范**：
- 使用中文
- 面向普通用户，语言简洁易懂
- 包含截图/示例

---

### 2. 技术实现文档 (Technical Docs)
**位置**: `/docs/technical/`

| 文档名称 | 内容 | 负责人 |
|---------|------|--------|
| `ARCHITECTURE.md` | 系统架构设计 | tech-lead |
| `API_REFERENCE.md` | 内部 API 接口文档 | 后端 |
| `DATABASE_SCHEMA.md` | 数据库结构 | 后端 |
| `DEPLOYMENT.md` | 部署指南 | DevOps |
| `SECURITY.md` | 安全策略 | 安全 |
| `PERFORMANCE.md` | 性能优化记录 | 后端 |
| `BUG_FIXES.md` | Bug 修复记录 | 开发 |

**格式规范**：
- 使用中文/英文混合（技术术语用英文）
- 代码片段必须可执行
- 包含版本号和日期

---

### 3. 官方 API 文档 (API Docs)
**位置**: `/docs/api/`

| 文档名称 | 内容 | 负责人 |
|---------|------|--------|
| `gamma-api.md` | Gamma API 官方文档备份 | 开发 |
| `minimax-api.md` | MiniMax API 官方文档备份 | 开发 |
| `supabase-api.md` | Supabase API 文档 | 后端 |
| `third-party.md` | 其他第三方 API | 开发 |

**格式规范**：
- 包含官方原文链接
- 标注版本号
- 记录调用限制和注意事项

---

### 4. 需求与设计 (Requirements)
**位置**: `/docs/requirements/`

| 文档名称 | 内容 | 负责人 |
|---------|------|--------|
| `user-needs-*.md` | 用户需求记录 | 产品 |
| `design-decisions.md` | 技术设计决策 | tech-lead |
| `meeting-notes.md` | 会议纪要 | 产品 |

---

## 文档命名规范

```
{文档类型}-{日期或版本}-{简短描述}.md

示例：
user-FAQ-2026-05.md
technical-API_REFERENCE-v10.44.md
api-gamma-2026-05.md
requirements-user-needs-chat-2026-05-10.md
```

---

## 文档更新规则

| 文档类型 | 更新时机 | 负责人 |
|---------|---------|--------|
| 用户文档 | 新功能上线、用户反馈热点问题 | 运营 |
| 技术文档 | 代码变更影响架构/接口 | 开发 |
| API 文档 | 第三方 API 升级/变更 | 开发 |
| 需求文档 | 收到新需求或反馈 | 产品 |

---

## 文档审查流程

1. **创建/更新** → 开发者/运营编写
2. **审查** → tech-lead 或产品审核
3. **发布** → 合并到主分支
4. **通知** → 在群聊/文档更新记录

---

## 文档存储位置

所有文档统一存放在项目根目录的 `/docs/` 文件夹下：

```
shengshi-ppt/
├── docs/
│   ├── user/           # 用户文档
│   ├── technical/      # 技术文档
│   ├── api/            # API 文档
│   └── requirements/   # 需求文档
├── README.md           # 项目主文档
└── ...
```

---

## 版本控制

- 文档使用 Git 管理
- 每季度审查一次文档有效性
- 过期文档移动到 `/docs/archive/` 
