import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

describe('sms-client aliyun_auth verification contract', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it('uses remote verification marker when Aliyun sends a code but does not return it', async () => {
    const sendSmsVerifyCode = vi.fn(async (_request: { payload: Record<string, unknown> }) => ({
      body: {
        Code: 'OK',
        Success: true,
        RequestId: 'req_1',
        Model: {},
      },
    }));
    const checkSmsVerifyCode = vi.fn();

    vi.doMock('@alicloud/openapi-client', () => ({
      Config: class Config {
        constructor(public readonly options: Record<string, unknown>) {}
      },
    }));
    const dypnsMock = {
      Client: class Client {
        sendSmsVerifyCode = sendSmsVerifyCode;
        checkSmsVerifyCode = checkSmsVerifyCode;
      },
      SendSmsVerifyCodeRequest: class SendSmsVerifyCodeRequest {
        constructor(public readonly payload: Record<string, unknown>) {}
      },
      CheckSmsVerifyCodeRequest: class CheckSmsVerifyCodeRequest {
        constructor(public readonly payload: Record<string, unknown>) {}
      },
    };
    vi.doMock('@alicloud/dypnsapi20170525', () => ({
      ...dypnsMock,
      default: dypnsMock,
    }));

    process.env.SMS_PROVIDER = 'aliyun_auth';
    process.env.ALIYUN_ACCESS_KEY_ID = 'ak';
    process.env.ALIYUN_ACCESS_KEY_SECRET = 'sk';
    process.env.ALIYUN_SMS_SIGN_NAME = '速通互联验证码';
    process.env.ALIYUN_SMS_TEMPLATE_CODE = '100001';

    const { REMOTE_SMS_CODE_MARKER, sendSMS } = await import('@/lib/sms-client');
    const result = await sendSMS('13800138000', '123456');

    expect(result.success).toBe(true);
    expect(result.remoteVerify).toBe(true);
    expect(result.code).toBe(REMOTE_SMS_CODE_MARKER);
    expect(sendSmsVerifyCode).toHaveBeenCalledTimes(1);
    const request = sendSmsVerifyCode.mock.calls[0]?.[0] as { payload: Record<string, unknown> } | undefined;
    expect(request?.payload).toMatchObject({
      countryCode: '86',
      phoneNumber: '13800138000',
      signName: '速通互联验证码',
      templateCode: '100001',
    });
  });

  it('retries transient Aliyun connection timeouts with bounded runtime options', async () => {
    const sendSmsVerifyCodeWithOptions = vi
      .fn()
      .mockRejectedValueOnce(new Error('ConnectTimeout: Connect HTTPS://dypnsapi.aliyuncs.com failed.'))
      .mockResolvedValueOnce({
        body: {
          Code: 'OK',
          Success: true,
          RequestId: 'req_retry',
          Model: { VerifyCode: '654321' },
        },
      });

    vi.doMock('@alicloud/openapi-client', () => ({
      Config: class Config {
        constructor(public readonly options: Record<string, unknown>) {}
      },
    }));
    const dypnsMock = {
      Client: class Client {
        sendSmsVerifyCode = vi.fn();
        sendSmsVerifyCodeWithOptions = sendSmsVerifyCodeWithOptions;
        checkSmsVerifyCode = vi.fn();
      },
      SendSmsVerifyCodeRequest: class SendSmsVerifyCodeRequest {
        constructor(public readonly payload: Record<string, unknown>) {}
      },
      CheckSmsVerifyCodeRequest: class CheckSmsVerifyCodeRequest {
        constructor(public readonly payload: Record<string, unknown>) {}
      },
    };
    vi.doMock('@alicloud/dypnsapi20170525', () => ({
      ...dypnsMock,
      default: dypnsMock,
    }));

    process.env.SMS_PROVIDER = 'aliyun_auth';
    process.env.ALIYUN_ACCESS_KEY_ID = 'ak';
    process.env.ALIYUN_ACCESS_KEY_SECRET = 'sk';
    process.env.ALIYUN_SMS_SIGN_NAME = '速通互联验证码';
    process.env.ALIYUN_SMS_TEMPLATE_CODE = '100001';

    const { sendSMS } = await import('@/lib/sms-client');
    const result = await sendSMS('13800138000', '123456');

    expect(result.success).toBe(true);
    expect(result.code).toBe('654321');
    expect(sendSmsVerifyCodeWithOptions).toHaveBeenCalledTimes(2);
    expect(sendSmsVerifyCodeWithOptions.mock.calls[0]?.[1]).toMatchObject({
      connectTimeout: 3000,
      readTimeout: 8000,
      maxAttempts: 2,
    });
  });

  it('returns structured Aliyun body errors instead of collapsing them to unknown', async () => {
    const sendSmsVerifyCode = vi.fn(async () => ({
      body: {
        code: 'biz.FREQUENCY',
        message: 'check frequency failed',
        success: false,
        requestId: 'req_2',
      },
    }));

    vi.doMock('@alicloud/openapi-client', () => ({
      Config: class Config {
        constructor(public readonly options: Record<string, unknown>) {}
      },
    }));
    const dypnsMock = {
      Client: class Client {
        sendSmsVerifyCode = sendSmsVerifyCode;
        checkSmsVerifyCode = vi.fn();
      },
      SendSmsVerifyCodeRequest: class SendSmsVerifyCodeRequest {
        constructor(public readonly payload: Record<string, unknown>) {}
      },
      CheckSmsVerifyCodeRequest: class CheckSmsVerifyCodeRequest {
        constructor(public readonly payload: Record<string, unknown>) {}
      },
    };
    vi.doMock('@alicloud/dypnsapi20170525', () => ({
      ...dypnsMock,
      default: dypnsMock,
    }));

    process.env.SMS_PROVIDER = '"aliyun_auth"';
    process.env.ALIYUN_ACCESS_KEY_ID = 'ak';
    process.env.ALIYUN_ACCESS_KEY_SECRET = 'sk';
    process.env.ALIYUN_SMS_SIGN_NAME = '速通互联验证码';
    process.env.ALIYUN_SMS_TEMPLATE_CODE = '100001';

    const { sendSMS } = await import('@/lib/sms-client');
    const result = await sendSMS('13800138000', '123456');

    expect(result.success).toBe(false);
    expect(result.error).toContain('code=biz.FREQUENCY');
    expect(result.error).toContain('message=check frequency failed');
    expect(result.error).toContain('requestId=req_2');
    expect(result.errorCode).toBe('biz.FREQUENCY');
    expect(result.retryAfter).toBe(60);
  });

  it('accepts Aliyun remote verification PASS responses', async () => {
    const sendSmsVerifyCode = vi.fn();
    const checkSmsVerifyCode = vi.fn(async () => ({
      body: {
        Code: 'OK',
        Success: true,
        Model: { VerifyResult: 'PASS' },
      },
    }));

    vi.doMock('@alicloud/openapi-client', () => ({
      Config: class Config {
        constructor(public readonly options: Record<string, unknown>) {}
      },
    }));
    const dypnsMock = {
      Client: class Client {
        sendSmsVerifyCode = sendSmsVerifyCode;
        checkSmsVerifyCode = checkSmsVerifyCode;
      },
      SendSmsVerifyCodeRequest: class SendSmsVerifyCodeRequest {
        constructor(public readonly payload: Record<string, unknown>) {}
      },
      CheckSmsVerifyCodeRequest: class CheckSmsVerifyCodeRequest {
        constructor(public readonly payload: Record<string, unknown>) {}
      },
    };
    vi.doMock('@alicloud/dypnsapi20170525', () => ({
      ...dypnsMock,
      default: dypnsMock,
    }));

    process.env.SMS_PROVIDER = 'aliyun_auth';
    process.env.ALIYUN_ACCESS_KEY_ID = 'ak';
    process.env.ALIYUN_ACCESS_KEY_SECRET = 'sk';

    const { verifyRemoteSMSCode } = await import('@/lib/sms-client');
    const result = await verifyRemoteSMSCode('13800138000', '123456');

    expect(result).toEqual({ valid: true });
    expect(checkSmsVerifyCode).toHaveBeenCalledTimes(1);
  });
});
