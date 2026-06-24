import { describe, expect, it } from 'vitest';
import {
  attachmentPolicySummary,
  getAttachmentPolicy,
  validateAttachmentMeta,
} from '@/lib/attachment-policy';

describe('attachment policy', () => {
  it('limits free professional users to one basic document', () => {
    const policy = getAttachmentPolicy('free', 'direct');
    expect(policy.maxFiles).toBe(1);
    expect(policy.maxTotalBytes).toBe(10 * 1024 * 1024);
    expect(policy.allowedExtensions).toEqual(['.pdf', '.docx', '.txt']);
    expect(validateAttachmentMeta({ name: 'data.xlsx', size: 1024 }, policy)).toContain('会员附件能力');
  });

  it('gives paid and smart mode the member attachment policy', () => {
    const policy = getAttachmentPolicy('shengxin', 'direct');
    expect(policy.maxFiles).toBe(5);
    expect(policy.maxDocumentBytes).toBe(30 * 1024 * 1024);
    expect(policy.maxTotalBytes).toBe(100 * 1024 * 1024);
    expect(getAttachmentPolicy('free', 'smart').allowedExtensions).toContain('.pptx');
  });

  it('uses concise representative formats in the member summary', () => {
    const summary = attachmentPolicySummary(getAttachmentPolicy('advanced', 'direct'));
    expect(summary).toContain('JPG 等');
    expect(summary).toContain('单个文档30MB');
    expect(summary).toContain('总计100MB');
  });
});
