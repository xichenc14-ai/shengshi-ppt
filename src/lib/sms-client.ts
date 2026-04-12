// SMS Client - 短信验证码发送客户端
// 支持：Luosimao / 腾讯云 / 阿里云（通过环境变量切换）
// 环境变量：
//   SMS_PROVIDER=luosimao|tencent|aliyun（默认 luosimao）
//   LUOSIMAO_API_KEY=xxx
//   TENCENT_SECRET_ID=xxx  TENCENT_SECRET_KEY=xxx  TENCENT_SMS_APP_ID=xxx  TENCENT_SMS_SIGN=xxx  TENCENT_SMS_TEMPLATE_ID=xxx
//   ALIYUN_ACCESS_KEY_ID=xxx  ALIYUN_ACCESS_KEY_SECRET=xxx  ALIYUN_SMS_SIGN=xxx  ALIYUN_SMS_TEMPLATE_CODE=xxx

type SMSProvider = 'luosimao' | 'tencent' | 'aliyun';

interface SMSSendResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

function getProvider(): SMSProvider {
  return (process.env.SMS_PROVIDER as SMSProvider) || 'luosimao';
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

// ===== 阿里云短信 =====
async function sendViaAliyun(phone: string, code: string): Promise<SMSSendResult> {
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
  const sign = process.env.ALIYUN_SMS_SIGN;
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE;

  if (!accessKeyId || !accessKeySecret || !sign || !templateCode) {
    return { success: false, error: '阿里云短信环境变量未配齐' };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Dysmsapi: any = await import('@alicloud/dysmsapi20170525');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const OpenApi: any = await import('@alicloud/openapi-client');

    const config = new OpenApi.Config({
      accessKeyId,
      accessKeySecret,
      endpoint: 'dysmsapi.aliyuncs.com',
    });

    const client = new Dysmsapi.default(config);
    const sendRes = await client.sendSms(new Dysmsapi.SendSmsRequest({
      phoneNumbers: phone,
      signName: sign,
      templateCode,
      templateParam: JSON.stringify({ code, expire: '5' }),
    }));

    if (sendRes.body?.code === 'OK') {
      return { success: true, messageId: sendRes.body.bizId };
    }
    return { success: false, error: `阿里云短信失败: ${sendRes.body?.message || '未知错误'}` };
  } catch (e) {
    return { success: false, error: `阿里云短信异常: ${e instanceof Error ? e.message : 'unknown'}` };
  }
}

// ===== 统一接口 =====
export async function sendSMS(phone: string, code: string): Promise<SMSSendResult> {
  const provider = getProvider();

  switch (provider) {
    case 'luosimao':
      return sendViaLuosimao(phone, code);
    case 'tencent':
      return sendViaTencent(phone, code);
    case 'aliyun':
      return sendViaAliyun(phone, code);
    default:
      return { success: false, error: `不支持的短信服务商: ${provider}` };
  }
}
