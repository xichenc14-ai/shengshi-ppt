# 手机端 UI 验收记录模板（v10.80.2）

- 验收日期：
- 验收人：
- 版本号：v10.80.2
- 环境：`production-like / staging / local`

## 一、验收断点

1. `375x812`
2. `390x844`
3. `430x932`

## 二、关键页面/模块

1. 首页主题色卡（`src/components/ThemeSelector.tsx`）
- 结果：
- 是否存在“大卡片突兀占版”：
- 截图路径：

2. 生成参数主题选择器（`src/components/generate/ThemeSelector.tsx`）
- 结果：
- 分类区与主题区是否紧凑网格：
- 选中态是否清晰：
- 截图路径：

3. 主题参数弹窗（`src/components/ThemePickerModal.tsx`）
- 结果：
- 卡片密度是否合理：
- 截图路径：

4. 登录弹窗（`src/components/LoginModal.tsx`）
- 结果：
- 输入与按钮是否无遮挡可点击：
- 截图路径：

5. 支付弹窗（`src/components/PaymentModal.tsx`）
- 结果：
- 支付方式、二维码、CTA 是否完整可见：
- 截图路径：

## 三、交互检查

1. 横竖屏切换后布局是否稳定：
2. 滚动区域是否可正常触达底部 CTA：
3. 字体可读性是否达标：
4. 误触风险是否可接受：

## 四、结论

- 总体结论：`PASS / FAIL`
- 未通过项：
- 修复建议：
- 回归计划：
