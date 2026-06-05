# 编码规范 - Image to PPTX

## Python 代码规范

### 命名规范
- 函数名：`snake_case`（如 `generate_pptx`）
- 类名：`PascalCase`（如 `ContentAnalyzer`）
- 常量：`UPPER_SNAKE_CASE`（如 `DEFAULT_WIDTH`）

### 导入规范
- 使用绝对导入
- 标准库 → 第三方库 → 本地包的顺序
- 示例：`from image_to_pptx.content_analyzer import ContentAnalyzer`

### 异常处理
- 捕获具体异常，不使用裸 `except`
- 所有 API 调用必须有异常处理
- 记录日志而非打印

### 文档
- 所有公共函数必须有 docstring
- 包含 Args、Returns、Raises 说明
