# xinppt skill

**Version 1.0.0** · 用本机 Agent 准备内容、智能匹配主题，并通过用户自己的 Gamma API 生成和检查 PowerPoint。无需省心 PPT 网站账号、服务器或付费系统；不会调用 GPT 生图。

## 安装

本目录遵循 [Agent Skills](https://agentskills.io/) 的 `SKILL.md` 结构。支持该结构的平台可以直接安装 GitHub 仓库中的 `skills/xinppt` 目录。例如：

```bash
npx skills add xichenc14-ai/shengshi-ppt --skill xinppt
```

命令会让你选择可用的 Agent 平台；需要全局安装时可加 `-g`。Codex 也可以让内置的 `$skill-installer` 安装以下目录：

```text
https://github.com/xichenc14-ai/shengshi-ppt/tree/main/skills/xinppt
```

需要固定第一版时，使用 Git 标签 `xinppt-v1.0.0` 对应的目录。手动安装也可将**整个** `skills/xinppt` 文件夹复制到目标平台的 skills 目录；不要只复制 `SKILL.md`。

## 运行条件

- macOS 或 Linux；Node.js 20+、Python 3、`curl`（支持 HTTP/2）。
- 自己的 Gamma API key。可设置环境变量 `GAMMA_API_KEY`，或将 `{"gammaApiKey":"你的密钥"}` 存入 `~/.config/xinppt/config.json`，并把文件权限设为 `600`。密钥不应放进仓库或生成目录。
- 逐页视觉检查需要 LibreOffice 和 Poppler（`pdftoppm`）；请按 `SKILL.md` 提供的方式渲染并检查交付文件。

安装后在 Agent 中调用 `$xinppt`，说明主题、用途和页数即可。Agent 会按 [SKILL.md](SKILL.md) 的流程准备逐页大纲、选择主题、提交 Gamma、下载 PPTX 并检查结果。命令中的 `scripts/`、`assets/`、`references/` 都相对于技能目录，而不是当前项目目录。

生成任务及导出的 PPTX 存在本机选定的输出目录。Gamma API 的调用可能产生费用，取决于你自己的 Gamma 账户与套餐。

## 版本

`1.0.0` 是首个可安装版本，对应 Git 标签 `xinppt-v1.0.0`。后续更新可继续从 `main` 安装；固定版本请从该标签安装。
