import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

describe('sms-client aliyun_auth verification contract', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it('uses remote verification marker when Aliyun sends a code but does not return it', async () => {
    const sendSmsVerifyCode = vi.fn(async () => ({
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
    process.env.ALIYUN_SMS_SIGN_NAME = '省心PPT';
    process.env.ALIYUN_SMS_TEMPLATE_CODE = '100001';

    const { REMOTE_SMS_CODE_MARKER, sendSMS } = await import('@/lib/sms-client');
    const result = await sendSMS('13800138000', '123456');

    expect(result.success).toBe(true);
    expect(result.remoteVerify).toBe(true);
    expect(result.code).toBe(REMOTE_SMS_CODE_MARKER);
    expect(sendSmsVerifyCode).toHaveBeenCalledTimes(1);
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
