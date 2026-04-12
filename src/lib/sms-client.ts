// SMS Client - 短信验证码发送客户端
// 支持：阿里云短信服务（dysmsapi）/ Luosimao / 腾讯云
// 环境变量：
//   SMS_PROVIDER=aliyun_sms|luosimao|tencent（默认 aliyun_sms）
//   ALIYUN_ACCESS_KEY_ID=xxx  ALIYUN_ACCESS_KEY_SECRET=xxx
//   ALIYUN_SMS_SIGN_NAME=xxx  ALIYUN_SMS_TEMPLATE_CODE=xxx

type SMSProvider = 'aliyun_auth' | 'luosimao' | 'tencent';

interface SMSSendResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

function getProvider(): SMSProvider {
  return (process.env.SMS_PROVIDER as SMSProvider) || 'aliyun_auth';
}

// ===== 阿里云短信认证（dypnsapi）=====
// 个人开发者友好：100次免费套餐包
// 需要：签名名称 + 模板CODE
async function sendViaAliyunAuth(phone: string, code: string): Promise<SMSSendResult> {
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
  const signName = process.env.ALIYUN_SMS_SIGN_NAME;
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE;

  if (!accessKeyId || !accessKeySecret) {
    return { success: false, error: 'ALIYUN_ACCESS_KEY_ID / SECRET 未配置' };
  }

  if (!signName || !templateCode) {
    console.warn('[SMS] ALIYUN_SMS_SIGN_NAME 或 ALIYUN_SMS_TEMPLATE_CODE 未配置，降级为控制台打印');
    console.log(`[SMS-DEV] 验证码: ${code}，手机号: ${phone}`);
    return { success: true, messageId: 'dev-mode' };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Dypnsapi: any = await import('@alicloud/dypnsapi20170525');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const OpenApi: any = await import('@alicloud/openapi-client');

    const config = new OpenApi.Config({
      accessKeyId,
      accessKeySecret,
      endpoint: 'dypnsapi.aliyuncs.com',
    });

    const client = new Dypnsapi.default(config);
    const sendRes = await client.sendSmsVerifyCode(new Dypnsapi.SendSmsVerifyCodeRequest({
      phoneNumber: phone,
      code,
      signName,
      templateCode,
      verifyCodeLength: 6,
      expireTime: 5, // 5分钟
    }));

    const body = sendRes.body as Record<string, any>;
    if (body?.Code === 'OK') {
      return { success: true, messageId: body?.RequestId };
    }
    return { success: false, error: `阿里云短信认证失败: ${body?.Message || body?.Code || '未知错误'}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    console.error('[SMS] 阿里云短信认证异常:', msg);
    if (msg.includes('Cannot find module') || msg.includes('MODULE_NOT_FOUND')) {
      console.warn('[SMS] dypnsapi SDK 未安装，降级为控制台打印');
      console.log(`[SMS-DEV] 验证码: ${code}，手机号: ${phone}`);
      return { success: true, messageId: 'dev-mode' };
    }
    return { success: false, error: `阿里云短信异常: ${msg}` };
  }
}

// ===== Luosimao =====
async function sendViaLuosimao(phone: string, code: string): Promise<SMSSendResult> {
  const apiKey = process.env.LUOSIMAO_API_KEY;
  if (!apiKey) return { success: false, error: 'LUOSIMAO_API_KEY 未配置' };

  try {
    const res = await fetch('https://sms-api.luosimao.com/v1/send.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`api:key-${apiKey}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        mobile: phone,
        message: `验证码：${code}（5分钟内有效）。如非本人操作，请忽略。【省心PPT】`,
      }).toString(),
    });

    const data = await res.json();
    if (data.error === 0) {
      return { success: true, messageId: String(data.id) };
    }
    return { success: false, error: `Luosimao错误: ${data.msg || data.error}` };
  } catch (e) {
    return { success: false, error: `Luosimao请求失败: ${e instanceof Error ? e.message : 'unknown'}` };
  }
}

// ===== 腾讯云短信 =====
async function sendViaTencent(phone: string, code: string): Promise<SMSSendResult> {
  const secretId = process.env.TENCENT_SECRET_ID;
  const secretKey = process.env.TENCENT_SECRET_KEY;
  const appId = process.env.TENCENT_SMS_APP_ID;
  const sign = process.env.TENCENT_SMS_SIGN;
  const templateId = process.env.TENCENT_SMS_TEMPLATE_ID;

  if (!secretId || !secretKey || !appId || !sign || !templateId) {
    return { success: false, error: '腾讯云短信环境变量未配齐' };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tencentcloud: any = await import('tencentcloud-sdk-nodejs-sms');
    const SmsClient = tencentcloud.sms.v20210111.Client;
    const client = new SmsClient({ credential: { secretId, secretKey }, region: 'ap-guangzhou' });

    const sendRes = await client.SendSms({
      SmsSdkAppId: appId,
      SignName: sign,
      TemplateId: templateId,
      TemplateParamSet: [code, '5'],
      PhoneNumberSet: [`+86${phone}`],
    });

    const status = sendRes.SendStatusSet?.[0];
    if (status?.Code === 'Ok') {
      return { success: true, messageId: status.SerialNo };
    }
    return { success: false, error: `腾讯云短信失败: ${status?.Message || '未知错误'}` };
  } catch (e) {
    return { success: false, error: `腾讯云短信异常: ${e instanceof Error ? e.message : 'unknown'}` };
  }
}

// ===== 统一接口 =====
export async function sendSMS(phone: string, code: string): Promise<SMSSendResult> {
  const provider = getProvider();

  switch (provider) {
    case 'aliyun_auth':
      return sendViaAliyunAuth(phone, code);
    case 'luosimao':
      return sendViaLuosimao(phone, code);
    case 'tencent':
      return sendViaTencent(phone, code);
    default:
      return { success: false, error: `不支持的短信服务商: ${provider}` };
  }
}
