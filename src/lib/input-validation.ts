// 输入校验工具函数
// 作者：省心PPT · 2026-04-15

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// 允许的文件类型
const ALLOWED_EXTENSIONS = [
  '.txt', '.md', '.pdf', '.doc', '.docx',
  '.xls', '.xlsx', '.csv',
  '.png', '.jpg', '.jpeg', '.webp',
  '.ppt', '.pptx',
];

// 允许的 MIME 类型
const ALLOWED_MIME_PREFIXES = [
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
  MAX_FILE_SIZE: 50 * 1024 * 1024,     // 50MB 单文件
  MAX_IMAGE_SIZE: 20 * 1024 * 1024,    // 20MB 单张图片
  MAX_TOTAL_FILE_SIZE: 100 * 1024 * 1024, // 100MB 总文件
  MAX_FILE_COUNT: 9,                    // 最多9个文件
  MAX_TEXT_LENGTH: 10000,              // 10000字总文本
  MAX_TOPIC_LENGTH: 5000,              // 5000字纯文本输入
} as const;

/**
 * 验证单个文件
 */
export function validateFile(file: File): string | null {
  // 检查文件大小
  if (file.size > LIMITS.MAX_FILE_SIZE) {
    return `文件 "${file.name}" 超过50MB限制（${(file.size / 1024 / 1024).toFixed(1)}MB）`;
  }

  // 图片额外限制
  if (file.type.startsWith('image/') && file.size > LIMITS.MAX_IMAGE_SIZE) {
    return `图片 "${file.name}" 超过20MB限制（${(file.size / 1024 / 1024).toFixed(1)}MB）`;
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
    errors.push(`文件总大小超过100MB限制（${(totalSize / 1024 / 1024).toFixed(1)}MB）`);
  }

  // 警告：文件较大
  if (totalSize > 50 * 1024 * 1024 && totalSize <= LIMITS.MAX_TOTAL_FILE_SIZE) {
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
  if (totalLength > 8000 && totalLength <= LIMITS.MAX_TEXT_LENGTH) {
    warnings.push(`内容较多（${totalLength}字），AI处理可能较慢`);
  }

  if (topic.trim().length === 0 && fileContents.length === 0) {
    errors.push('请输入PPT主题或上传文件');
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
      fileErrors.push(`文件 "${file.name}" 超过50MB`);
    }
    if (file.type?.startsWith('image/') && file.size > LIMITS.MAX_IMAGE_SIZE) {
      fileErrors.push(`图片 "${file.name}" 超过20MB`);
    }
    totalSize += file.size;
  }

  if (totalSize > LIMITS.MAX_TOTAL_FILE_SIZE) {
    fileErrors.push(`文件总大小超过100MB`);
  }

  // 文本验证
  const fileContents = files.map(f => f.content || '').filter(Boolean);
  const totalTextLength = topic.length + fileContents.reduce((sum, c) => sum + c.length, 0);

  if (totalTextLength > LIMITS.MAX_TEXT_LENGTH) {
    fileErrors.push(`总内容超过${LIMITS.MAX_TEXT_LENGTH}字限制`);
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
