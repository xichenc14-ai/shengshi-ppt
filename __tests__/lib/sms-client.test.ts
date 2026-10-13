import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getStorableSMSCode, inspectSMSProviderReadiness, isSMSConnectionFailure, sendSMS, verifyStoredSMSCode } from '@/lib/sms-client';

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
  it.each(['Forbidden', 'InvalidAccessKeyId.NotFound', 'isv.UnknownError'])('does not call an unexpected provider result healthy: %s', async code => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ Code: code, Success: false }), { status: 200 })));
    expect((await inspectSMSProviderReadiness()).ready).toBe(false);
  });
  it('probes the same signed POST as sending without sending a message', async () => {
    const fetchMock = vi.fn(async () => new Response('{"Code":"OK","Success":true,"Model":{"VerifyResult":"FAIL"}}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await inspectSMSProviderReadiness()).ready).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://dypnsapi.aliyuncs.com/');
    expect(init.method).toBe('POST');
    const body = new URLSearchParams(String(init.body));
    expect(body.get('Action')).toBe('CheckSmsVerifyCode');
    expect(body.get('PhoneNumber')).toBe('00000000000');
    expect(body.has('TemplateParam')).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('classifies connection timeout as definitely not submitted and never retries', async () => {
    const error = new TypeError('fetch failed', { cause: Object.assign(new Error('connect timeout'), { code: 'UND_ERR_CONNECT_TIMEOUT' }) });
    const fetchMock = vi.fn().mockRejectedValue(error);
    vi.stubGlobal('fetch', fetchMock);
    expect(isSMSConnectionFailure(error)).toBe(true);
    expect(await sendSMS(phone, '123456')).toMatchObject({ success: false, errorCode: 'PROVIDER_CONNECTION_FAILED', retryAfter: 5 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('keeps an ambiguous connection reset uncertain without retransmitting', async () => {
    const error = new TypeError('fetch failed', { cause: Object.assign(new Error('reset'), { code: 'ECONNRESET' }) });
    const fetchMock = vi.fn().mockRejectedValue(error);
    vi.stubGlobal('fetch', fetchMock);
    expect(isSMSConnectionFailure(error)).toBe(false);
    expect(await sendSMS(phone, '123456')).toMatchObject({ success: false, errorCode: 'PROVIDER_TRANSPORT_ERROR' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
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
