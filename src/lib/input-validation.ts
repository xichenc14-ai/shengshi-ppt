// 输入校验工具函数
// 作者：省心PPT · 2026-04-15

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// 允许的文件类型
export const ALLOWED_EXTENSIONS = [
  '.txt', '.md', '.pdf', '.docx',
  '.xlsx', '.csv',
  '.png', '.jpg', '.jpeg', '.webp',
  '.pptx',
];

// 允许的 MIME 类型
export const ALLOWED_MIME_PREFIXES = [
  'text/',           // .txt, .md, .csv
  'image/png',       // .png
  'image/jpeg',      // .jpg, .jpeg
  'image/webp',      // .webp
  'application/pdf', // .pdf
  'application/msword',                           // .doc
  'application/vnd.openxmlformats-officedocument', // .docx, .xlsx, .pptx
  'application/vnd.ms-excel',                     // .xls
];

// 限制常量
export const LIMITS = {
  // 基于当前 200k context（MiniMax）做保守预算：
  // - 预留系统提示词 / 规则 / 输出 / 安全缓冲
  // - 用户可用文本预算约 10 万字（中英混排场景）
  MAX_FILE_SIZE: 30 * 1024 * 1024,       // 30MB 会员单文档
  MAX_IMAGE_SIZE: Math.floor(2.5 * 1024 * 1024), // 2.5MB 单张图片
  MAX_TOTAL_FILE_SIZE: 100 * 1024 * 1024, // 100MB 会员总文件
  MAX_FILE_COUNT: 5,                       // 会员最多5个文件
  MAX_TEXT_LENGTH: 36000,                 // 会员总文本预算（用户输入 + 附件提取）
  MAX_TOPIC_LENGTH: 40000,                // 纯文本输入预算
  MAX_EXTRACTED_CHARS_PER_FILE: 12000,    // 单文件最多保留 1.2 万字符
} as const;

export const LIMITS_HUMAN_READABLE = {
  SUPPORTED_TYPES: '.txt, .md, .pdf, .docx, .xlsx, .csv, .png, .jpg, .jpeg, .webp, .pptx',
  MAX_FILE_SIZE_LABEL: '30MB',
  MAX_IMAGE_SIZE_LABEL: '2.5MB',
  MAX_TOTAL_FILE_SIZE_LABEL: '100MB',
  MAX_FILE_COUNT_LABEL: '5个',
  MAX_TEXT_LENGTH_LABEL: '3.6万字',
  MAX_TOPIC_LENGTH_LABEL: '4万字',
} as const;

/**
 * 验证单个文件
 */
export function validateFile(file: File): string | null {
  // 检查文件大小
  if (file.size > LIMITS.MAX_FILE_SIZE) {
    return `文件 "${file.name}" 超过${LIMITS_HUMAN_READABLE.MAX_FILE_SIZE_LABEL}限制（${(file.size / 1024 / 1024).toFixed(1)}MB）`;
  }

  // 图片额外限制
  if (file.type.startsWith('image/') && file.size > LIMITS.MAX_IMAGE_SIZE) {
    return `图片 "${file.name}" 超过${LIMITS_HUMAN_READABLE.MAX_IMAGE_SIZE_LABEL}限制（${(file.size / 1024 / 1024).toFixed(1)}MB）`;
  }

  // 检查文件扩展名
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
    return `文件 "${file.name}" 格式不支持，支持：${ALLOWED_EXTENSIONS.join(', ')}`;
  }

  return null;
}

/**
 * 验证文件列表
 */
export function validateFiles(files: File[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 检查文件数量
  if (files.length > LIMITS.MAX_FILE_COUNT) {
    errors.push(`最多上传${LIMITS.MAX_FILE_COUNT}个文件，当前${files.length}个`);
    return { valid: false, errors, warnings };
  }

  let totalSize = 0;
  for (const file of files) {
    const fileError = validateFile(file);
    if (fileError) {
      errors.push(fileError);
    }
    totalSize += file.size;
  }

  // 检查总大小
  if (totalSize > LIMITS.MAX_TOTAL_FILE_SIZE) {
    errors.push(`文件总大小超过${LIMITS_HUMAN_READABLE.MAX_TOTAL_FILE_SIZE_LABEL}限制（${(totalSize / 1024 / 1024).toFixed(1)}MB）`);
  }

  // 警告：文件较大
  if (totalSize > 70 * 1024 * 1024 && totalSize <= LIMITS.MAX_TOTAL_FILE_SIZE) {
    warnings.push(`文件较大（${(totalSize / 1024 / 1024).toFixed(1)}MB），处理可能较慢`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 验证文本输入
 */
export function validateText(topic: string, fileContents: string[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const totalLength = topic.length + fileContents.reduce((sum, c) => sum + c.length, 0);

  if (totalLength > LIMITS.MAX_TEXT_LENGTH) {
    errors.push(`总内容超过${LIMITS.MAX_TEXT_LENGTH}字限制（当前${totalLength}字），请精简内容`);
  }

  if (topic.length > LIMITS.MAX_TOPIC_LENGTH) {
    errors.push(`文本输入超过${LIMITS.MAX_TOPIC_LENGTH}字限制（当前${topic.length}字）`);
  }

  // 警告
  if (totalLength > 50000 && totalLength <= LIMITS.MAX_TEXT_LENGTH) {
    warnings.push(`内容较多（${totalLength}字），AI处理可能较慢`);
  }

  if (topic.trim().length === 0 && fileContents.length === 0) {
    errors.push('请输入PPT主题或上传文件，AI将自动为你生成精美PPT');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 综合验证（文件 + 文本）
 */
export function validateInput(topic: string, files: { size: number; name: string; type: string; content?: string }[]): ValidationResult {
  const fileErrors: string[] = [];
  const warnings: string[] = [];

  // 文件验证
  if (files.length > LIMITS.MAX_FILE_COUNT) {
    fileErrors.push(`最多上传${LIMITS.MAX_FILE_COUNT}个文件`);
  }

  let totalSize = 0;
  for (const file of files) {
    if (file.size > LIMITS.MAX_FILE_SIZE) {
      fileErrors.push(`文件 "${file.name}" 超过${LIMITS_HUMAN_READABLE.MAX_FILE_SIZE_LABEL}`);
    }
    if (file.type?.startsWith('image/') && file.size > LIMITS.MAX_IMAGE_SIZE) {
      fileErrors.push(`图片 "${file.name}" 超过${LIMITS_HUMAN_READABLE.MAX_IMAGE_SIZE_LABEL}`);
    }
    totalSize += file.size;
  }

  if (totalSize > LIMITS.MAX_TOTAL_FILE_SIZE) {
    fileErrors.push(`文件总大小超过${LIMITS_HUMAN_READABLE.MAX_TOTAL_FILE_SIZE_LABEL}`);
  }

  // 文本验证
  const fileContents = files.map(f => f.content || '').filter(Boolean);
  const totalTextLength = topic.length + fileContents.reduce((sum, c) => sum + c.length, 0);

  if (totalTextLength > LIMITS.MAX_TEXT_LENGTH) {
    fileErrors.push(`总内容超过${LIMITS.MAX_TEXT_LENGTH}字限制`);
  }
  if (topic.length > LIMITS.MAX_TOPIC_LENGTH) {
    fileErrors.push(`文本输入超过${LIMITS.MAX_TOPIC_LENGTH}字限制`);
  }

  if (topic.trim().length === 0 && files.length === 0) {
    fileErrors.push('请输入PPT主题或上传文件');
  }

  return {
    valid: fileErrors.length === 0,
    errors: fileErrors,
    warnings,
  };
}
