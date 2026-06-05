import { afterEach, describe, expect, it } from 'vitest';
import { createProviderOrderIntent, inspectProviderReadiness } from '@/lib/payment/provider-adapter';

const ENV_KEYS = [
  'PAYMENT_WECHAT_URL_TEMPLATE',
  'PAYMENT_WECHAT_QRCODE_TEMPLATE',
  'PAYMENT_ALIPAY_URL_TEMPLATE',
  'PAYMENT_ALIPAY_QRCODE_TEMPLATE',
  'WECHAT_PAY_MCH_ID',
  'WECHAT_PAY_APP_ID',
  'WECHAT_PAY_API_V3_KEY',
  'ALIPAY_APP_ID',
  'ALIPAY_PRIVATE_KEY',
  'ALIPAY_PUBLIC_KEY',
] as const;

const backup: Record<string, string | undefined> = {};
for (const k of ENV_KEYS) backup[k] = process.env[k];

function restoreEnv() {
  for (const k of ENV_KEYS) {
    const v = backup[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

afterEach(() => {
  restoreEnv();
});

describe('payment provider adapter', () => {
  it('returns non-mock intent when template mode is configured', async () => {
    process.env.PAYMENT_WECHAT_URL_TEMPLATE = 'https://pay.example.com/wx?order={orderNo}&amount={amountFen}&uid={userId}';
    delete process.env.PAYMENT_WECHAT_QRCODE_TEMPLATE;

    const intent = await createProviderOrderIntent({
      provider: 'wechat',
      orderNo: 'ORD_123',
      amountFen: 1990,
      subject: '省心会员（月付）',
      userId: 'user-1',
      notifyUrl: 'https://api.example.com/payment/callback',
    });

    expect(intent.mock).toBe(false);
    expect(intent.payUrl).toContain('order=ORD_123');
    expect(intent.payUrl).toContain('amount=1990');
    expect(intent.providerOrderId).toBe('wechat_ORD_123');
  });

  it('reports missing mode when neither template nor SDK env is ready', () => {
    delete process.env.PAYMENT_ALIPAY_URL_TEMPLATE;
    delete process.env.PAYMENT_ALIPAY_QRCODE_TEMPLATE;
    delete process.env.ALIPAY_APP_ID;
    delete process.env.ALIPAY_PRIVATE_KEY;
    delete process.env.ALIPAY_PUBLIC_KEY;

    const readiness = inspectProviderReadiness('alipay');
    expect(readiness.ready).toBe(false);
    expect(readiness.mode).toBe('missing');
    expect(readiness.missing.length).toBeGreaterThan(0);
  });
});

