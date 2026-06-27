import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import { POST } from '@/app/api/payment/xunhu/notify/route';
import { createXunhuHash } from '@/lib/payment/xunhu';

function asNextRequest(request: Request): NextRequest {
  return request as unknown as NextRequest;
}

function mockFormPost(payload: Record<string, string>) {
  const body = new URLSearchParams(payload);
  return asNextRequest(new Request('http://localhost/api/payment/xunhu/notify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'x-forwarded-for': '127.0.0.1',
    },
    body,
  }));
}

describe('/api/payment/xunhu/notify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.XUNHU_PAY_APPID = 'app_1';
    process.env.XUNHU_PAY_SECRET = 'secret_1';
  });

  it('verifies xunhu callback and activates subscription idempotently', async () => {
    const orderUpdates: Array<Record<string, unknown>> = [];
    const userUpdates: Array<Record<string, unknown>> = [];
    const creditTransactions: Array<Record<string, unknown>> = [];

    (createClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      from: (table: string) => {
        if (table === 'orders') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    order_no: 'ORD_123',
                    user_id: 'user-1',
                    status: 'pending',
                    amount: 1990,
                    product_type: 'subscription',
                    pay_method: 'wechat',
                    metadata: { planId: 'shengxin', billing: 'monthly' },
                  },
                  error: null,
                }),
              }),
            }),
            update: (payload: Record<string, unknown>) => ({
              eq: async () => {
                orderUpdates.push(payload);
                return { error: null };
              },
            }),
          };
        }

        if (table === 'users') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: { credits: 100 },
                  error: null,
                }),
              }),
            }),
            update: (payload: Record<string, unknown>) => ({
              eq: async () => {
                userUpdates.push(payload);
                return { error: null };
              },
            }),
          };
        }

        if (table === 'credit_transactions') {
          return {
            insert: async (payload: Record<string, unknown>) => {
              creditTransactions.push(payload);
              return { error: null };
            },
          };
        }

        throw new Error(`unexpected table: ${table}`);
      },
    });

    const payload = {
      appid: 'app_1',
      trade_order_id: 'ORD_123',
      total_fee: '19.90',
      transaction_id: 'wx_tx_1',
      open_order_id: 'xh_order_1',
      order_title: '省心会员（月付）',
      status: 'OD',
      time: String(Math.floor(Date.now() / 1000)),
      nonce_str: 'nonce_1',
    };
    const signedPayload = {
      ...payload,
      hash: createXunhuHash(payload, 'secret_1'),
    };

    const res = await POST(mockFormPost(signedPayload));
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(text).toBe('success');
    const membershipUpdate = userUpdates.find((item) => item.plan_type === 'basic');
    expect(membershipUpdate?.plan_type).toBe('basic');
    expect(membershipUpdate?.credits).toBe(600);
    expect(creditTransactions[0].amount).toBe(500);
    expect(orderUpdates.at(-1)?.status).toBe('paid');
    expect(orderUpdates.at(-1)?.trade_no).toBe('wx_tx_1');
  });
});
