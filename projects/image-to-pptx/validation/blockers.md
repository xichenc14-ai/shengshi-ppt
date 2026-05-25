# Image to PPTX - 阻塞问题报告

**项目路径：** `/Users/macmini/shengshi-ppt/projects/image-to-pptx/`
**报告日期：** 2026-05-23
**问题级别：** 🔴 阻塞 (Blocker)

---

## 阻塞问题列表

### 1. requirements.txt 文件缺失

**严重程度：** 🔴 阻塞
**影响范围：** 整个项目
**问题描述：** 项目的依赖管理文件 `requirements.txt` 不存在，导致无法通过 pip 安装项目依赖。

**当前状态：**
- 项目代码中导入了以下依赖：
  - `python-pptx` (pptx_builder.py, main.py)
  - `Pillow` (asset_extractor.py, pptx_builder.py, image_generator.py)
  - `rembg` (asset_extractor.py)
- 但没有统一的依赖管理文件

**修复要求：** 创建 `requirements.txt`，内容应包括：
```
python-pptx>=0.6.21
pillow>=10.0.0
rembg>=2.0.50
```

---

### 2. norms 规范目录不存在

**严重程度：** 🔴 阻塞
**影响范围：** 项目执行规范
**问题描述：** `solutions/norms/` 目录不存在，违反项目执行规范。根据 IDENTITY.md，执行前必须读取 `projects/[id]/solutions/norms/` 目录下的规范文件。

**项目规范要求：**
> ### 执行前（必须）
> ```
> 1. 读取 projects/[id]/solutions/norms/     # 项目规范（必须）
> 2. 读取 projects/[id]/solutions/YYYY-MM-DD-*.md  # 技术方案
> 3. 读取 projects/[id]/code/               # Tech-Dept 输出
> ```

**修复要求：** 创建以下文件：
- `solutions/norms/tech-norms.md` - 技术规范
- `solutions/YYYY-MM-DD-tech-design.md` - 技术方案

---

## 当前项目状态

**config/project.json status 字段：** `planning`
**建议更新为：** `quality_checked`（问题修复后）

---

*阻塞问题报告生成时间：2026-05-23 02:03 GMT+8*
*校验者：validator (质量门禁部门)*
