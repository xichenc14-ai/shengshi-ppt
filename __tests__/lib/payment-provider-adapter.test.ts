import { afterEach, describe, expect, it } from 'vitest';
import { createProviderOrderIntent, inspectProviderReadiness } from '@/lib/payment/provider-adapter';
import { createXunhuHash, getXunhuEndpoint, isXunhuPaidResult, verifyXunhuHash } from '@/lib/payment/xunhu';

const ENV_KEYS = [
  'PAYMENT_SUPPORTED_METHODS',
  'NEXT_PUBLIC_PAYMENT_SUPPORTED_METHODS',
  'PAYMENT_WECHAT_URL_TEMPLATE',
  'PAYMENT_WECHAT_QRCODE_TEMPLATE',
  'PAYMENT_ALIPAY_URL_TEMPLATE',
  'PAYMENT_ALIPAY_QRCODE_TEMPLATE',
  'XUNHU_PAY_APPID',
  'XUNHU_PAY_SECRET',
  'XUNHU_PAY_GATEWAY',
  'PAYMENT_RETURN_URL',
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
    process.env.PAYMENT_SUPPORTED_METHODS = 'alipay';
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

  it('creates and verifies xunhu hashes using ASCII sorted non-empty fields', () => {
    const payload = {
      trade_order_id: 'ORD_123',
      appid: 'app_1',
      total_fee: '19.90',
      empty: '',
      hash: 'ignored',
      nonce_str: 'abc',
    };

    const hash = createXunhuHash(payload, 'secret_1');
    expect(hash).toMatch(/^[a-f0-9]{32}$/);
    expect(verifyXunhuHash({ ...payload, hash }, 'secret_1')).toBe(true);
    expect(verifyXunhuHash({ ...payload, hash }, 'bad_secret')).toBe(false);
  });

  it('normalizes xunhu gateway endpoints', () => {
    expect(getXunhuEndpoint('https://api.xunhupay.com', 'do')).toBe('https://api.xunhupay.com/payment/do.html');
    expect(getXunhuEndpoint('https://api.xunhupay.com/payment/do.html', 'query')).toBe('https://api.xunhupay.com/payment/query.html');
  });

  it('treats xunhu CD responses with transaction and paid date as paid', () => {
    expect(isXunhuPaidResult({
      status: 'CD',
      transactionId: '4500000219202606262746335492',
      paidDate: '2026-06-26 18:51:39',
    })).toBe(true);
    expect(isXunhuPaidResult({ status: 'CD' })).toBe(false);
  });

  it('returns non-mock xunhu intent for configured wechat provider', async () => {
    process.env.PAYMENT_SUPPORTED_METHODS = 'wechat';
    process.env.XUNHU_PAY_APPID = 'app_1';
    process.env.XUNHU_PAY_SECRET = 'secret_1';
    process.env.XUNHU_PAY_GATEWAY = 'https://api.xunhupay.com';
    process.env.PAYMENT_RETURN_URL = 'https://xinppt.cn/account';

    const responseBody: Record<string, string | number> = {
      openid: 'xh_open_1',
      url: 'https://api.xunhupay.com/pay/mobile',
      url_qrcode: 'https://api.xunhupay.com/qr/ORD_123',
      errcode: 0,
      errmsg: 'success!',
    };
    responseBody.hash = createXunhuHash(responseBody, 'secret_1');

    const originalFetch = global.fetch;
    global.fetch = (async () => new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;

    try {
      const intent = await createProviderOrderIntent({
        provider: 'wechat',
        orderNo: 'ORD_123',
        amountFen: 1990,
        subject: '省心会员（月付）',
        userId: 'user-1',
        notifyUrl: 'https://xinppt.cn/api/payment/xunhu/notify',
      });

      expect(intent.mock).toBe(false);
      expect(intent.providerOrderId).toBe('xh_open_1');
      expect(intent.qrCodeUrl).toBe(String(responseBody.url_qrcode));
      expect(intent.payUrl).toBe(String(responseBody.url));
    } finally {
      global.fetch = originalFetch;
    }
  });
});
