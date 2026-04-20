# Gamma UI 功能分析报告

> 整理时间：2026-04-21 00:26 GMT+8
> 探索方式：浏览器自动化（OpenClaw Browser）

---

## 1. Gamma UI 编辑界面全貌

### 1.1 左侧工具栏（插入元素）

| 工具 | 功能 | 对应API参数 |
|------|------|------------|
| **Text** | 文本框 | - |
| **Image → AI Image** | AI生成图片 | `imageOptions.source=aiGenerated` |
| **Shape**（矩形/圆形/三角形等）| 基础图形 | - |
| **Line** | 线条 | - |
| **Chart**（柱状图/饼图等）| 数据图表 | cardOptions（不支持，通过API生成） |
| **Table** | 表格 | - |
| **Video** | 视频 | - |
| **Embed** | 嵌入 | - |
| **Web page** | 网页 | - |
| **Code** | 代码块 | - |

### 1.2 顶部菜单

- **Home**：首页操作
- **Insert**：插入卡片、页面
- **Arrange**：图层排列（bring forward/send backward）
- **Edit**：撤销/重做
- **View**：视图切换

### 1.3 右侧属性面板

**Properties（通用属性）：**
- Fill（填充色）
- Stroke（边框）
- Border radius（圆角）
- Shadow（阴影）
- Opacity（透明度）
- Corner（圆角）

**Card Style（卡片样式）：**
- Background（背景色/图片）
- Title（标题样式）
- Body（正文样式）

**Position & Size：**
- X / Y 坐标
- W（宽度）/ H（高度）
- Rotation（旋转角度）

**Cards：**
- Cover card（封面卡片）
- Add card（添加卡片）
- Reorder（拖拽排序）

**Style：**
- Font family（字体）
- Theme colors（主题色）
- Background（背景）

---

## 2. 模板系统

### 2.1 模板分类（从 gamma.app/templates 观察）

| 类别 | 示例 |
|------|------|
| 报告 | 团队回顾会、交易回顾、周报、季度业务回顾 |
| 战略 | SWOT分析、市场规模框架、战略规划、竞争情报卡 |
| 营销 | 营销计划、品牌重塑方案、社交媒体策略 |
| 融资 | 创业路演、融资进展更新、资助申请书 |
| 企业 | 公司演示模板（10+种颜色变体）、员工手册 |
| 产品 | 产品概述、客户提案、能力概览 |
| 项目 | 项目复盘、项目启动会议、项目里程碑 |
| 教育 | 讲义计划、培训概述、研究发现 |

### 2.2 模板 → from-template API

`POST /v1.0/generations/from-template` 需要：
- `gammaId`：模板的 Gamma ID
- `prompt`：替换内容
- 模板必须恰好有1个Page

**模板适用场景：**
- 固定版式的品牌PPT（公司介绍、产品手册）
- 结构化报告（周报/月报/季报）
- 需要批量生产的标准化文档

---

## 3. Gamma 支持的输出格式

| 格式 | 说明 | API `format`值 |
|------|------|---------------|
| Presentation | 演示文稿 | `presentation` |
| Document | 文档（类似Notion）| `document` |
| Webpage | 网页 | `webpage` |
| Social | 社交媒体帖子 | `social` |

---

## 4. 图片生成能力

### 4.1 图片来源（`imageOptions.source`）

| 来源 | 说明 | API枚举值 |
|------|------|-----------|
| AI生成 | Gamma AI生成 | `aiGenerated` |
| 网络图片 | 免费商用 | `webFreeToUseCommercially` |
| 网络图片 | 免费（商用未知）| `webAllImages` |
| 网络图片 | 仅免费个人用 | `webFreeToUse` |
| Pexels | 图库 | `pexels` |
| Giphy | GIF | `giphy` |
| 占位符 | 空白占位 | `placeholder` |
| 无图片 | 纯文字 | `noImages` |
| 主题色 | 纯色背景 | `themeAccent` |
| Pictographic | 图标风格 | `pictographic` |

### 4.2 AI图片模型（`imageOptions.model`，55+种）

| 级别 | 模型示例 | 说明 |
|------|---------|------|
| 高级 | `imagen-4-pro`, `flux-2-pro`, `dall-e-3` | 高质量，消耗更多credits |
| 中级 | `imagen-3-flash`, `flux-1-pro`, `ideogram-v2` | 平衡质量与速度 |
| 快速 | `imagen-4-fast`, `flux-1-schnell`, `gpt-image-1-mini` | 快速生成 |
| 专业 | `flux-kontext-max`, `recraft-v4` | 特殊用途 |

### 4.3 图片风格（`imageOptions.style`）
- 可自定义描述：0-500字符
- 示例：`"photorealistic"`, `"watercolor"`, `"minimalist corporate"`

---

## 5. 关键发现（与网站的映射）

### 5.1 Gamma 生成的内容结构

**每张Card包含：**
- 标题（Title）
- 正文（Body text）
- 可选图片（AI生成/网络/无）
- 可选图表/表格/视频

**这些元素通过API生成时由Gamma AI自动决定布局。**

### 5.2 当前网站缺失的可视化能力

| 能力 | Gamma支持 | 网站API实现 |
|------|----------|------------|
| 柱状图/饼图 | ✅ 支持（编辑时可插入） | ❌ API不直接支持生成图表 |
| 表格 | ✅ 支持（编辑时可插入） | ❌ API不直接支持生成表格 |
| 视频嵌入 | ✅ 支持 | ❌ API不直接支持 |
| 代码块 | ✅ 支持 | ❌ API不直接支持 |
| 地图/地理 | ⚠️ 需通过嵌入实现 | ❌ 不支持 |

### 5.3 从模板生成（from-template）的限制

- **模板必须恰好有1个Page**
- 模板 ID 需要从 Gamma UI 复制
- 生成后用户仍可在 Gamma UI 编辑
- **但：模板生成后不返回大纲供确认**

---

## 6. 实际观察的 Gamma PPT 示例

**测试生成：PPT-Gamma-API（3页）**

| 页码 | 标题 | 内容摘要 | 有无图片 |
|------|------|---------|---------|
| 1 | 这是测试：省心PPT系统Gamma API集成验证 | AI概念 + Gamma API介绍 | ✅ AI生成（机器人拿电池图）|
| 2 | Gamma API | API定义/功能介绍 | ❌ 无 |
| 3 | 总结 | 积分消耗说明 | ❌ 无 |

**观察：**
- 默认生成时有AI图片（由Gamma决定位置和样式）
- 文字量和布局由Gamma AI决定
- 用户无法在生成前预览/确认大纲

---

## 7. 结论

1. **Gamma编辑界面非常丰富**：支持10+种元素类型，可满足专业PPT需求
2. **模板系统完善**：60+模板覆盖主流场景，适合from-template批量生产
3. **但API生成是"盲盒"**：生成什么布局/图片由Gamma决定，用户无法预确认
4. **图表/表格**：编辑时可手动插入，但API无法程序化生成
5. **核心限制确认**：Gamma API不提供"生成前预览大纲"的功能
