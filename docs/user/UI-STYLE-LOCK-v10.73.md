# 省心PPT UI 锁版记录（v10.73）

日期：2026-05-22  
环境：Production  
线上域名：https://shengxinppt.lol  
部署ID：dpl_GR5oU9R4RcPJ2ZqA4mSHsGsW82PU

## 锁定范围

本次锁定主要针对「首页高级选项中的主题风格面板」及相关色系数据：

1. 主题卡展示结构：背景大色块 + 强调小色块 + 文字（省心PPT）
2. 卡片横向尺寸压缩（更紧凑）
3. 桌面端主题卡每行 4 个
4. 推荐色系位于首位，保持同栏同逻辑
5. 主题归类基于已校对分类，避免异常膨胀
6. `finesse`（优雅米绿）定稿为米黄底 + 绿色强调 + 深色文字

## 锁定文件

- `src/components/ThemeSelector.tsx`
- `src/components/ThemePickerModal.tsx`
- `src/lib/theme-database.ts`
- `src/lib/version.ts`
- `package.json`

## 说明

后续仅允许在“参数功能/数据准确性/BUG修复”范围内做小改。  
如需变更本版式，先新增一条“解锁记录”并注明原因。

