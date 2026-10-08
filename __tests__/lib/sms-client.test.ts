import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getStorableSMSCode, sendSMS, verifyStoredSMSCode } from '@/lib/sms-client';

const phone = '13800138000';

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('SMS_PROVIDER', 'aliyun_auth');
  vi.stubEnv('ALIYUN_ACCESS_KEY_ID', 'test-access-key');
  vi.stubEnv('ALIYUN_ACCESS_KEY_SECRET', 'test-access-secret');
  vi.stubEnv('ALIYUN_SMS_SIGN_NAME', '测试签名');
  vi.stubEnv('ALIYUN_SMS_TEMPLATE_CODE', '100001');
  vi.stubEnv('SMS_CODE_HASH_SECRET', 'test-code-secret');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('SMS challenge contract', () => {
  it('sends the application-generated code and stores only a phone-bound HMAC', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      Code: 'OK',
      Success: true,
      RequestId: 'provider-request-id',
      Model: { BizId: 'provider-message-id' },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const sent = await sendSMS(phone, '123456', { outId: 'request-id' });
    expect(sent).toMatchObject({ success: true, code: '123456', providerRequestId: 'provider-request-id' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://dypnsapi.aliyuncs.com/');
    expect(init.method).toBe('POST');
    const body = new URLSearchParams(String(init.body));
    expect(body.get('Action')).toBe('SendSmsVerifyCode');
    expect(JSON.parse(body.get('TemplateParam') || '{}')).toEqual({ code: '123456', min: '5' });
    expect(body.get('ReturnVerifyCode')).toBe('false');

    const storedCode = getStorableSMSCode(sent, '123456', phone);
    expect(storedCode).not.toContain('123456');
    expect(await verifyStoredSMSCode(phone, storedCode, '123456')).toEqual({ valid: true });
    expect(await verifyStoredSMSCode(phone, storedCode, '000000')).toMatchObject({ valid: false });
    expect(await verifyStoredSMSCode('13900139000', storedCode, '123456')).toMatchObject({ valid: false });
  });

  it('does not fall back to storing a plaintext code without a hash key', () => {
    vi.stubEnv('SMS_CODE_HASH_SECRET', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect(() => getStorableSMSCode({ success: true, code: '123456' }, '123456', phone))
      .toThrow('SMS_CODE_HASH_SECRET is unavailable');
  });
});
