# 省事PPT - AI一键生成专业PPT

输入一个主题，AI自动生成专业PPT内容，支持在线预览和一键导出PPTX。

## ✨ 功能特性

- 🤖 **AI智能生成** — 基于 GLM-5-turbo 大模型，内容专业准确
- 🎨 **多种模板** — 5种精美模板风格，适配各种场景
- 👁️ **在线预览** — 幻灯片实时预览，键盘左右键翻页
- 📥 **导出PPTX** — 一键导出，兼容 Office 和 WPS
- ⚡ **快速生成** — 30秒内完成PPT内容生成

## 🛠️ 技术栈

- **前端:** Next.js 16 + React 19 + TypeScript + Tailwind CSS v4
- **AI:** GLM-5-turbo (via mydamoxing)
- **导出:** pptxgenjs
- **部署:** Vercel

## 🚀 本地开发

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，填入 MYDAMOXING_API_KEY

# 启动开发服务器
npm run dev
```

打开 http://localhost:3000 即可使用。

## 📦 部署到 Vercel

### 方法一：通过 GitHub（推荐）

1. 将项目推到 GitHub
2. 登录 [Vercel](https://vercel.com)
3. 点击 "New Project" → 选择你的 GitHub 仓库
4. 添加环境变量：`MYDAMOXING_API_KEY`
5. 点击 Deploy

### 方法二：通过 Vercel CLI

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel --prod

# 设置环境变量
vercel env add MYDAMOXING_API_KEY
```

## ⚙️ 环境变量

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `MYDAMOXING_API_KEY` | GLM-5-turbo API Key | ✅ |

## 📁 项目结构

```
src/
├── app/
│   ├── page.tsx          # 首页（Landing Page）
│   ├── create/page.tsx   # 创建页（核心交互）
│   ├── api/
│   │   ├── generate/route.ts  # AI生成API
│   │   └── export/route.ts    # PPTX导出API
│   ├── layout.tsx        # 根布局
│   └── globals.css       # 全局样式
├── components/
│   ├── SlideRenderer.tsx     # 幻灯片渲染组件
│   └── TemplateSelector.tsx  # 模板选择器
└── lib/
    ├── types.ts          # TypeScript类型定义
    └── pptx-export.ts    # PPTX导出逻辑
```

## 📄 License

MIT
