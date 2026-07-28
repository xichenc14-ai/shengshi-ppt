import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const { cleanupExpiredTemporaryAttachments, registerTemporaryAttachment, createSignedUploadUrl } = vi.hoisted(() => ({
  cleanupExpiredTemporaryAttachments: vi.fn(),
  registerTemporaryAttachment: vi.fn(),
  createSignedUploadUrl: vi.fn(),
}));

vi.mock('@/lib/session', () => ({
  getSession: vi.fn().mockResolvedValue({
    isLoggedIn: true,
    user: { id: 'user-upload', plan_type: 'pro' },
  }),
}));
vi.mock('@/lib/rate-limit', () => ({
  getClientIP: vi.fn(() => '127.0.0.1'),
  distributedRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));
vi.mock('@/lib/temporary-attachments', () => ({
  TEMPORARY_ATTACHMENT_BUCKET: 'temporary-attachments',
  cleanupExpiredTemporaryAttachments,
  registerTemporaryAttachment,
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    storage: {
      getBucket: vi.fn().mockResolvedValue({ data: { id: 'temporary-attachments' } }),
      createBucket: vi.fn(),
      from: vi.fn(() => ({ createSignedUploadUrl })),
    },
  })),
}));

import { POST } from '@/app/api/attachments/upload-token/route';

function request() {
  return new Request('http://localhost/api/attachments/upload-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'direct',
      name: 'brief.txt',
      size: 1024,
      batchCount: 0,
      batchBytes: 0,
    }),
  }) as unknown as NextRequest;
}

describe('POST /api/attachments/upload-token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://database.example.com');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-test-key');
    createSignedUploadUrl.mockResolvedValue({
      data: { token: 'signed-token', signedUrl: 'https://storage.example.com/upload' },
      error: null,
    });
    registerTemporaryAttachment.mockResolvedValue(undefined);
    cleanupExpiredTemporaryAttachments.mockResolvedValue(0);
  });

  afterEach(() => vi.unstubAllEnvs());

  it('registers an expiry lease before returning the upload token', async () => {
    const response = await POST(request());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(registerTemporaryAttachment).toHaveBeenCalledWith(
      'user-upload',
      expect.stringMatching(/^user-upload\//),
      'signed-token',
    );
    expect(body.bucket).toBe('temporary-attachments');
    expect(cleanupExpiredTemporaryAttachments).toHaveBeenCalledTimes(1);
  });

  it('does not return a usable token when lease registration fails', async () => {
    registerTemporaryAttachment.mockRejectedValue(new Error('lease unavailable'));
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect((await response.json()).error).toContain('lease unavailable');
  });
});
