import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/parse-file/route';

function mockFormData(fileName: string, content: string | Buffer, mimeType?: string) {
  const formData = new FormData();
  const file = new File([content], fileName, { type: mimeType || 'text/plain' });
  formData.append('file', file);
  return formData;
}

describe('POST /api/parse-file', () => {
  it('should return 400 when no file is provided', async () => {
    const formData = new FormData();
    const req = new Request('http://localhost/api/parse-file', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('未提供文件');
  });

  it('should return 400 when file exceeds 50MB', async () => {
    const formData = new FormData();
    const bigFile = new File([new ArrayBuffer(51 * 1024 * 1024)], 'big.txt');
    formData.append('file', bigFile);
    const req = new Request('http://localhost/api/parse-file', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('50MB');
  });

  it('should parse TXT files correctly', async () => {
    const content = '这是一个测试文件\n第二行内容\n第三行';
    const formData = mockFormData('test.txt', content);
    const req = new Request('http://localhost/api/parse-file', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req as any);
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
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.text).toContain('标题');
    expect(data.fileName).toBe('test.md');
  });

  it('should handle unsupported file types gracefully', async () => {
    const formData = mockFormData('test.xyz', 'some content', 'application/octet-stream');
    const req = new Request('http://localhost/api/parse-file', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req as any);
    // Unsupported types return a generic text extraction
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.text).toBeDefined();
  });

  it('should return file metadata', async () => {
    const content = '测试内容';
    const formData = mockFormData('report.txt', content);
    const req = new Request('http://localhost/api/parse-file', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req as any);
    const data = await res.json();
    expect(data.fileName).toBe('report.txt');
    expect(data.fileSize).toBeGreaterThan(0);
    expect(data.charCount).toBe(content.length);
  });
});
