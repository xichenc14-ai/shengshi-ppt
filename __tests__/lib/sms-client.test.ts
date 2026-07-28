import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function rfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => (
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  ));
}

describe('sms-client aliyun_auth native RPC transport', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.SMS_PROVIDER = 'aliyun_auth';
    process.env.ALIYUN_ACCESS_KEY_ID = 'test-access-key';
    process.env.ALIYUN_ACCESS_KEY_SECRET = 'test-access-secret';
    process.env.ALIYUN_SMS_SIGN_NAME = '速通互联验证码';
    process.env.ALIYUN_SMS_TEMPLATE_CODE = '100001';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it('signs SendSmsVerifyCode as a form POST and sends the application-generated code', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse({
      Code: 'OK',
      Success: true,
      RequestId: 'req_1',
      Model: {},
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { sendSMS } = await import('@/lib/sms-client');
    const result = await sendSMS('13800138000', '123456', { outId: 'f3b0cb3e-4f7a-4900-9a14-1fc27505230e' });

    expect(result).toMatchObject({
      success: true,
      code: '123456',
      providerRequestId: 'req_1',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const requestBody = new URLSearchParams(String(requestInit.body));
    expect(requestUrl.origin).toBe('https://dypnsapi.aliyuncs.com');
    expect(requestBody.get('Action')).toBe('SendSmsVerifyCode');
    expect(requestBody.get('PhoneNumber')).toBe('13800138000');
    expect(requestBody.get('SignName')).toBe('速通互联验证码');
    expect(requestBody.get('OutId')).toBe('f3b0cb3e-4f7a-4900-9a14-1fc27505230e');
    expect(JSON.parse(String(requestBody.get('TemplateParam')))).toMatchObject({ code: '123456', min: '5' });

    const signature = requestBody.get('Signature');
    requestBody.delete('Signature');
    const parameters = [...requestBody.entries()]
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, value]) => `${rfc3986(key)}=${rfc3986(value)}`)
      .join('&');
    const expectedSignature = createHmac('sha1', 'test-access-secret&')
      .update(`POST&${rfc3986('/')}&${rfc3986(parameters)}`)
      .digest('base64');
    expect(signature).toBe(expectedSignature);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' });
  });

  it('uses a signed RPC verification call for readiness instead of a HEAD probe', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse({
      Code: 'isv.ValidateFail',
      Success: false,
      Message: 'verification failed',
    }, 400));
    vi.stubGlobal('fetch', fetchMock);

    const { inspectSMSProviderReadiness } = await import('@/lib/sms-client');
    const result = await inspectSMSProviderReadiness();

    expect(result).toEqual({ ready: true, detail: 'aliyun_auth_rpc_isv.ValidateFail' });
    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestUrl.searchParams.get('Action')).toBe('CheckSmsVerifyCode');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'GET' });
  });

  it('fails readiness when signed RPC authentication is rejected', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      Code: 'SignatureDoesNotMatch',
      Success: false,
      Message: 'signature mismatch',
    }, 400)));

    const { inspectSMSProviderReadiness } = await import('@/lib/sms-client');
    await expect(inspectSMSProviderReadiness()).resolves.toEqual({
      ready: false,
      detail: 'aliyun_auth_rpc_SignatureDoesNotMatch',
    });
  });

  it('does not automatically retry an ambiguous provider transport timeout', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    });
    vi.stubGlobal('fetch', fetchMock);

    const { sendSMS } = await import('@/lib/sms-client');
    const result = await sendSMS('13800138000', '123456');

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('PROVIDER_TRANSPORT_ERROR');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns structured provider frequency errors with retryAfter', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse({
      code: 'biz.FREQUENCY',
      message: 'check frequency failed',
      success: false,
      requestId: 'req_2',
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { sendSMS } = await import('@/lib/sms-client');
    const result = await sendSMS('13800138000', '123456');

    expect(result.success).toBe(false);
    expect(result.error).toContain('code=biz.FREQUENCY');
    expect(result.error).toContain('message=check frequency failed');
    expect(result.errorCode).toBe('biz.FREQUENCY');
    expect(result.retryAfter).toBe(60);
  });

  it('accepts Aliyun remote verification PASS responses', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse({
      Code: 'OK',
      Success: true,
      Model: { VerifyResult: 'PASS' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { verifyRemoteSMSCode } = await import('@/lib/sms-client');
    const result = await verifyRemoteSMSCode('13800138000', '123456');

    expect(result).toEqual({ valid: true });
    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestUrl.searchParams.get('Action')).toBe('CheckSmsVerifyCode');
    expect(requestUrl.searchParams.get('VerifyCode')).toBe('123456');
  });
});
