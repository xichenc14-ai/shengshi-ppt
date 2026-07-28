import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSignedUploadTokenExpiry, getTemporaryAttachmentTtlMs, isTemporaryAttachmentExpired } from '@/lib/temporary-attachments';

afterEach(() => vi.unstubAllEnvs());

describe('temporary attachment expiry policy', () => {
  it('defaults to one hour and expires older objects', () => {
    const now = new Date('2026-07-13T10:00:00.000Z').getTime();
    expect(getTemporaryAttachmentTtlMs()).toBe(60 * 60 * 1000);
    expect(isTemporaryAttachmentExpired('2026-07-13T08:59:59.000Z', now)).toBe(true);
    expect(isTemporaryAttachmentExpired('2026-07-13T09:30:00.000Z', now)).toBe(false);
  });

  it('bounds configuration between 15 minutes and 24 hours', () => {
    vi.stubEnv('TEMPORARY_ATTACHMENT_TTL_MINUTES', '1');
    expect(getTemporaryAttachmentTtlMs()).toBe(15 * 60 * 1000);
    vi.stubEnv('TEMPORARY_ATTACHMENT_TTL_MINUTES', '99999');
    expect(getTemporaryAttachmentTtlMs()).toBe(24 * 60 * 60 * 1000);
  });

  it('derives the actual signed upload token expiry with a safe fallback', () => {
    const now = new Date('2026-07-13T10:00:00.000Z').getTime();
    const payload = Buffer.from(JSON.stringify({ exp: Math.floor(now / 1000) + 7200 })).toString('base64url');
    expect(getSignedUploadTokenExpiry(`header.${payload}.signature`, now)).toBe(now + 7200 * 1000);
    expect(getSignedUploadTokenExpiry('invalid', now)).toBe(now + 7200 * 1000);
  });
});
