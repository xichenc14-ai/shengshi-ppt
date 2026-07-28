import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const { storageDownload, storageRemove } = vi.hoisted(() => ({
  storageDownload: vi.fn(),
  storageRemove: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({ download: storageDownload, remove: storageRemove })),
    },
  })),
}));

vi.mock('@/lib/session', () => ({
  getSession: vi.fn().mockResolvedValue({
    isLoggedIn: true,
    user: { id: 'test-user', plan_type: 'shengxin' },
  }),
}));

import { POST } from '@/app/api/parse-file/route';
import { LIMITS } from '@/lib/input-validation';

function mockFormData(fileName: string, content: string | Buffer, mimeType?: string) {
  const formData = new FormData();
  const fileContent = typeof content === 'string'
    ? content
    : new Uint8Array(content).buffer;
  const file = new File([fileContent], fileName, { type: mimeType || 'text/plain' });
  formData.append('file', file);
  return formData;
}

function asNextRequest(request: Request): NextRequest {
  return request as unknown as NextRequest;
}

describe('POST /api/parse-file', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://database.example.com');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-test-key');
    storageDownload.mockReset();
    storageRemove.mockReset();
    storageRemove.mockResolvedValue({ error: null });
  });

  afterEach(() => vi.unstubAllEnvs());

  it('should return 400 when no file is provided', async () => {
    const formData = new FormData();
    const req = new Request('http://localhost/api/parse-file', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(asNextRequest(req));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('未提供文件');
  });

  it('should return 400 when file exceeds max size limit', async () => {
    const formData = new FormData();
    const maxMb = Math.floor(LIMITS.MAX_FILE_SIZE / 1024 / 1024);
    const bigFile = new File([new ArrayBuffer(LIMITS.MAX_FILE_SIZE + 1)], 'big.txt');
    formData.append('file', bigFile);
    const req = new Request('http://localhost/api/parse-file', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(asNextRequest(req));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain(`${maxMb}MB`);
  });

  it('should parse TXT files correctly', async () => {
    const content = '这是一个测试文件\n第二行内容\n第三行';
    const formData = mockFormData('test.txt', content);
    const req = new Request('http://localhost/api/parse-file', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(asNextRequest(req));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.text).toContain('这是一个测试文件');
    expect(data.fileName).toBe('test.txt');
    expect(data.charCount).toBeGreaterThan(0);
  });

  it('should parse MD files correctly', async () => {
    const content = '# 标题\n\n这是一段Markdown内容\n\n- 要点1\n- 要点2';
    const formData = mockFormData('test.md', content);
    const req = new Request('http://localhost/api/parse-file', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(asNextRequest(req));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.text).toContain('标题');
    expect(data.fileName).toBe('test.md');
  });

  it('should reject unsupported file types', async () => {
    const formData = mockFormData('test.xyz', 'some content', 'application/octet-stream');
    const req = new Request('http://localhost/api/parse-file', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(asNextRequest(req));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('格式不支持');
  });

  it('should return file metadata', async () => {
    const content = '测试内容';
    const formData = mockFormData('report.txt', content);
    const req = new Request('http://localhost/api/parse-file', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(asNextRequest(req));
    const data = await res.json();
    expect(data.fileName).toBe('report.txt');
    expect(data.fileSize).toBeGreaterThan(0);
    expect(data.charCount).toBe(content.length);
  });

  it('deletes a temporary uploaded object immediately after reading it', async () => {
    storageDownload.mockResolvedValue({ data: new Blob(['临时附件内容']), error: null });
    const req = new Request('http://localhost/api/parse-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: 'temporary.txt',
        fileSize: 18,
        storagePath: 'test-user/temporary.txt',
        mode: 'direct',
      }),
    });
    const res = await POST(asNextRequest(req));
    expect(res.status).toBe(200);
    expect(storageRemove).toHaveBeenCalledWith(['test-user/temporary.txt']);
  });

  it('still attempts deletion when reading the downloaded object fails', async () => {
    storageDownload.mockResolvedValue({
      data: { arrayBuffer: vi.fn().mockRejectedValue(new Error('read failed')) },
      error: null,
    });
    const req = new Request('http://localhost/api/parse-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: 'temporary.txt',
        fileSize: 18,
        storagePath: 'test-user/temporary.txt',
        mode: 'direct',
      }),
    });
    const res = await POST(asNextRequest(req));
    expect(res.status).toBe(200);
    expect((await res.json()).failed).toBe(true);
    expect(storageRemove).toHaveBeenCalledWith(['test-user/temporary.txt']);
  });
});
