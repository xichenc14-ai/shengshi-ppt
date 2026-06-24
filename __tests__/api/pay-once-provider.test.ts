import { describe, expect, it } from 'vitest';
import type { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/pay-once/route';

function asNextRequest(request: Request): NextRequest {
  return request as unknown as NextRequest;
}

describe('/api/pay-once disabled contract', () => {
  it('returns 410 for GET requests', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(410);
    expect(data.error).toContain('单次付费下载通道已关闭');
  });

  it('returns 410 for POST requests', async () => {
    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(410);
    expect(data.error).toContain('统一按积分结算');
  });

  it('keeps the disabled contract independent of request payloads', async () => {
    const request = asNextRequest(new Request('http://localhost/api/pay-once', {
      method: 'POST',
      body: JSON.stringify({ generationId: 'legacy-generation' }),
    }));

    expect(request.method).toBe('POST');
    const response = await POST();
    expect(response.status).toBe(410);
  });
});
