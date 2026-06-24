export type AttachmentMode = 'direct' | 'smart';

export type AttachmentPolicy = {
  key: 'free-direct' | 'member';
  maxFiles: number;
  maxDocumentBytes: number;
  maxImageBytes: number;
  maxTotalBytes: number;
  maxExtractedCharsPerFile: number;
  maxAttachmentChars: number;
  maxCombinedChars: number;
  allowedExtensions: readonly string[];
};

const MB = 1024 * 1024;

const FREE_DIRECT_POLICY: AttachmentPolicy = {
  key: 'free-direct',
  maxFiles: 1,
  maxDocumentBytes: 10 * MB,
  maxImageBytes: 0,
  maxTotalBytes: 10 * MB,
  maxExtractedCharsPerFile: 6_000,
  maxAttachmentChars: 12_000,
  maxCombinedChars: 16_000,
  allowedExtensions: ['.pdf', '.docx', '.txt'],
};

const MEMBER_POLICY: AttachmentPolicy = {
  key: 'member',
  maxFiles: 5,
  maxDocumentBytes: 30 * MB,
  maxImageBytes: Math.floor(2.5 * MB),
  maxTotalBytes: 100 * MB,
  maxExtractedCharsPerFile: 12_000,
  maxAttachmentChars: 30_000,
  maxCombinedChars: 36_000,
  allowedExtensions: [
    '.txt', '.md', '.pdf', '.docx',
    '.csv', '.xlsx', '.pptx',
    '.png', '.jpg', '.jpeg', '.webp',
  ],
};

export function isPaidPlan(planType?: string | null): boolean {
  return Boolean(planType && planType !== 'free');
}

export function getAttachmentPolicy(planType?: string | null, mode: AttachmentMode = 'direct'): AttachmentPolicy {
  return mode === 'smart' || isPaidPlan(planType) ? MEMBER_POLICY : FREE_DIRECT_POLICY;
}

export function getFileExtension(fileName: string): string {
  const index = fileName.lastIndexOf('.');
  return index >= 0 ? fileName.slice(index).toLowerCase() : '';
}

export function isImageExtension(extension: string): boolean {
  return ['.png', '.jpg', '.jpeg', '.webp'].includes(extension);
}

export function formatMb(bytes: number): string {
  return `${Math.round((bytes / MB) * 10) / 10}MB`;
}

export function validateAttachmentMeta(
  file: { name: string; size: number },
  policy: AttachmentPolicy,
): string | null {
  const extension = getFileExtension(file.name);
  if (!policy.allowedExtensions.includes(extension)) {
    return policy.key === 'free-direct'
      ? `免费用户仅支持 PDF、DOCX、TXT，${file.name} 属于会员附件能力`
      : `文件“${file.name}”格式不支持`;
  }

  const limit = isImageExtension(extension) ? policy.maxImageBytes : policy.maxDocumentBytes;
  if (limit <= 0) return `当前套餐不支持图片附件`;
  if (file.size > limit) {
    return `文件“${file.name}”超过${formatMb(limit)}限制`;
  }
  return null;
}

export function attachmentPolicySummary(policy: AttachmentPolicy): string {
  if (policy.key === 'free-direct') {
    return `最多${policy.maxFiles}个，单个文档10MB，总计10MB；支持 PDF、DOCX、TXT`;
  }
  return `最多${policy.maxFiles}个，单个文档30MB、单张图片2.5MB，总计100MB；支持 PDF、DOCX、PPTX、XLSX、JPG 等`;
}
