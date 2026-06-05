import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/payment', () => ({
  isCallbackIPAllowed: vi.fn(() => true),
}));

vi.mock('@/lib/payment/wechat-verify', () => ({
  verifyWechatPayCallback: vi.fn(async () => ({ valid: true })),
}));

vi.mock('@/lib/payment/alipay-verify', () => ({
  verifyAlipayCallback: vi.fn(() => ({ valid: true })),
  normalizeAlipayPublicKey: vi.fn((v: string) => v),
}));

import { createClient } from '@supabase/supabase-js';
import { POST } from '@/app/api/payment/route';

function asNextRequest(request: Request): NextRequest {
  return request as unknown as NextRequest;
}

function mockPost(body: Record<string, unknown>) {
  return asNextRequest(new Request('http://localhost/api/payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '127.0.0.1',
      'wechatpay-signature': 'sig',
      'wechatpay-timestamp': String(Math.floor(Date.now() / 1000)),
      'wechatpay-nonce': 'nonce',
    },
    body: JSON.stringify(body),
  }));
}

describe('/api/payment callback download_once', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.WECHAT_PAY_API_KEY = 'wx_api_key';
  });

  it('marks download_once order completed and returns success', async () => {
    const updates: Array<Record<string, unknown>> = [];

    (createClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      from: (table: string) => {
        if (table !== 'orders') throw new Error(`unexpected table: ${table}`);
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  order_no: 'once_123',
                  user_id: 'u-1',
                  status: 'pending',
                  amount: 200,
                  product_type: 'download_once',
                  pay_method: 'wechat',
                  metadata: { generationId: 'gen_1', pageCount: 10, filename: 'demo.pptx' },
                  expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
                },
                error: null,
              }),
            }),
          }),
          update: (payload: Record<string, unknown>) => ({
            eq: async () => {
              updates.push(payload);
              return { error: null };
            },
          }),
        };
      },
    });

    const res = await POST(mockPost({
      action: 'callback',
      order_no: 'once_123',
      status: 'SUCCESS',
      pay_method: 'wechat',
      total_fee: 200,
      trade_no: 'wx_trade_001',
    }));

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(String(data.message)).toContain('单次下载订单已生效');

    expect(updates.length).toBe(1);
    expect(updates[0].status).toBe('completed');
    expect((updates[0].metadata as Record<string, unknown>).fulfilled).toBe(false);
  });
});
