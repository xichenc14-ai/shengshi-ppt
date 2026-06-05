import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/payment/provider-adapter', () => ({
  inspectProviderReadiness: vi.fn(),
  createProviderOrderIntent: vi.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import { createProviderOrderIntent, inspectProviderReadiness } from '@/lib/payment/provider-adapter';
import { GET, POST } from '@/app/api/pay-once/route';

function asNextRequest(request: Request): NextRequest {
  return request as unknown as NextRequest;
}

function mockPost(body: Record<string, unknown>) {
  return asNextRequest(new Request('http://localhost/api/pay-once', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

function mockGet(query: string) {
  return asNextRequest(new Request(`http://localhost/api/pay-once?${query}`));
}

type SupabaseMockOptions = {
  user?: { credits: number; plan_type: string } | null;
  order?: Record<string, unknown> | null;
};

function setupSupabaseMock(opts: SupabaseMockOptions) {
  const insertedOrders: Array<Record<string, unknown>> = [];
  const updatedOrders: Array<Record<string, unknown>> = [];

  (createClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    from: (table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: opts.user, error: null }),
            }),
          }),
        };
      }

      if (table === 'orders') {
        return {
          insert: async (payload: Record<string, unknown>) => {
            insertedOrders.push(payload);
            return { error: null };
          },
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({ data: opts.order, error: null }),
              }),
            }),
          }),
          update: (payload: Record<string, unknown>) => ({
            eq: async () => {
              updatedOrders.push(payload);
              return { error: null };
            },
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  });

  return { insertedOrders, updatedOrders };
}

describe('/api/pay-once provider flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.PAYMENT_NOTIFY_URL = 'https://api.example.com/payment/callback';
    process.env.PAYMENT_FEATURE_ENABLED = 'true';
  });

  it('creates provider order intent and persists download_once order', async () => {
    const { insertedOrders } = setupSupabaseMock({
      user: { credits: 50, plan_type: 'free' },
      order: null,
    });

    (inspectProviderReadiness as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ready: true,
      missing: [],
    });
    (createProviderOrderIntent as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      provider: 'wechat',
      providerOrderId: 'wx_001',
      payUrl: 'https://pay.example.com/wx',
      qrCodeUrl: 'https://pay.example.com/wx-qr',
      mock: false,
      raw: {},
    });

    const res = await POST(mockPost({
      userId: 'u-1',
      generationId: 'g-1',
      pageCount: 8,
      filename: 'test.pptx',
      payMode: 'provider',
      payMethod: 'wechat',
    }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.mode).toBe('provider');
    expect(typeof data.orderNo).toBe('string');
    expect(insertedOrders.length).toBe(1);
    expect(insertedOrders[0].product_type).toBe('download_once');
    expect(insertedOrders[0].status).toBe('pending');
  });

  it('returns pending status when provider order is not paid yet', async () => {
    setupSupabaseMock({
      user: { credits: 50, plan_type: 'free' },
      order: {
        order_no: 'once_1',
        user_id: 'u-1',
        product_type: 'download_once',
        status: 'pending',
      },
    });

    const res = await GET(mockGet('orderNo=once_1&userId=u-1'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.paid).toBe(false);
    expect(data.status).toBe('pending');
  });

  it('returns downloadUrl when provider order is completed and marks fulfilled', async () => {
    const { updatedOrders } = setupSupabaseMock({
      user: { credits: 50, plan_type: 'free' },
      order: {
        order_no: 'once_2',
        user_id: 'u-2',
        product_type: 'download_once',
        status: 'completed',
        metadata: {
          generationId: 'gen_2',
          filename: 'demo.pptx',
          fulfilled: false,
        },
      },
    });

    const res = await GET(mockGet('orderNo=once_2&userId=u-2'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.paid).toBe(true);
    expect(data.status).toBe('completed');
    expect(String(data.downloadUrl)).toContain('/api/export-pptx?generationId=gen_2');
    expect(updatedOrders.length).toBe(1);
    expect((updatedOrders[0].metadata as Record<string, unknown>).fulfilled).toBe(true);
  });
});
