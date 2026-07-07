// SMS Client - 短信验证码发送客户端
// 支持：阿里云短信认证（dypnsapi）/ Luosimao / 腾讯云
// 环境变量：
//   SMS_PROVIDER=aliyun_auth|luosimao|tencent（默认 aliyun_auth）
//   ALIYUN_ACCESS_KEY_ID=xxx  ALIYUN_ACCESS_KEY_SECRET=xxx
//   ALIYUN_SMS_SIGN_NAME=速通互联验证码  ALIYUN_SMS_TEMPLATE_CODE=100001

type SMSProvider = 'aliyun_auth' | 'luosimao' | 'tencent';

export const REMOTE_SMS_CODE_MARKER = '__REMOTE_SMS_PROVIDER_VERIFY__';

interface SMSSendResult {
  success: boolean;
  code?: string;       // 本地可校验验证码；DYPNS 可能不返回真实验证码
  remoteVerify?: boolean; // true 表示验证码需回源到服务商校验
  error?: string;
  errorCode?: string;
  retryAfter?: number;
  messageId?: string;
}

type OpenApiModule = {
  Config: new (config: Record<string, unknown>) => unknown;
};

type DypnsModule = {
  default?: {
    default?: new (config: unknown) => {
      sendSmsVerifyCode: (request: unknown) => Promise<{ body?: unknown }>;
      sendSmsVerifyCodeWithOptions?: (request: unknown, runtime: Record<string, unknown>) => Promise<{ body?: unknown }>;
      checkSmsVerifyCode: (request: unknown) => Promise<{ body?: unknown }>;
      checkSmsVerifyCodeWithOptions?: (request: unknown, runtime: Record<string, unknown>) => Promise<{ body?: unknown }>;
    };
  } | (new (config: unknown) => {
    sendSmsVerifyCode: (request: unknown) => Promise<{ body?: unknown }>;
    sendSmsVerifyCodeWithOptions?: (request: unknown, runtime: Record<string, unknown>) => Promise<{ body?: unknown }>;
    checkSmsVerifyCode: (request: unknown) => Promise<{ body?: unknown }>;
    checkSmsVerifyCodeWithOptions?: (request: unknown, runtime: Record<string, unknown>) => Promise<{ body?: unknown }>;
  });
  Client?: new (config: unknown) => {
    sendSmsVerifyCode: (request: unknown) => Promise<{ body?: unknown }>;
    sendSmsVerifyCodeWithOptions?: (request: unknown, runtime: Record<string, unknown>) => Promise<{ body?: unknown }>;
    checkSmsVerifyCode: (request: unknown) => Promise<{ body?: unknown }>;
    checkSmsVerifyCodeWithOptions?: (request: unknown, runtime: Record<string, unknown>) => Promise<{ body?: unknown }>;
  };
  SendSmsVerifyCodeRequest: new (payload: Record<string, unknown>) => unknown;
  CheckSmsVerifyCodeRequest: new (payload: Record<string, unknown>) => unknown;
};

type TencentModule = {
  sms: {
    v20210111: {
      Client: new (config: {
        credential: { secretId: string; secretKey: string };
        region: string;
      }) => {
        SendSms: (payload: Record<string, unknown>) => Promise<{
          SendStatusSet?: Array<{ Code?: string; SerialNo?: string; Message?: string }>;
        }>;
      };
    };
  };
};

function getProvider(): SMSProvider {
  return (String(process.env.SMS_PROVIDER || 'aliyun_auth').replace(/^['"]|['"]$/g, '') as SMSProvider);
}

function resolveDypnsClient(Dypnsapi: DypnsModule) {
  if (typeof Dypnsapi.default === 'function') return Dypnsapi.default;
  if (Dypnsapi.default && typeof Dypnsapi.default.default === 'function') return Dypnsapi.default.default;
  if (typeof Dypnsapi.Client === 'function') return Dypnsapi.Client;
  throw new Error('Dypnsapi Client constructor not found');
}

function maskPhone(phone: string): string {
  return phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}

export function normalizeSMSCode(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '').slice(0, 6);
}

export function getStorableSMSCode(result: SMSSendResult, fallbackCode: string): string {
  return result.remoteVerify === true
    ? REMOTE_SMS_CODE_MARKER
    : (normalizeSMSCode(result.code) || fallbackCode);
}

export async function verifyStoredSMSCode(
  phone: string,
  storedCode: string,
  inputCode: unknown,
): Promise<{ valid: boolean; error?: string }> {
  const normalizedCode = normalizeSMSCode(inputCode);
  if (normalizedCode.length !== 6) return { valid: false, error: '验证码错误或已过期' };
  if (storedCode === REMOTE_SMS_CODE_MARKER) {
    const remote = await verifyRemoteSMSCode(phone, normalizedCode);
    if (!remote.valid) return { valid: false, error: remote.error || '验证码错误或已过期' };
    return { valid: true };
  }
  return storedCode === normalizedCode
    ? { valid: true }
    : { valid: false, error: '验证码错误或已过期' };
}

function pickAliyunField(body: Record<string, unknown>, name: string): unknown {
  return body[name] ?? body[name.charAt(0).toLowerCase() + name.slice(1)];
}

function aliyunSuccess(body: Record<string, unknown>): boolean {
  const code = String(pickAliyunField(body, 'Code') ?? '').toUpperCase();
  return code === 'OK' || pickAliyunField(body, 'Success') === true;
}

function aliyunError(prefix: string, body: Record<string, unknown>): string {
  const code = String(pickAliyunField(body, 'Code') ?? 'UNKNOWN');
  const message = String(pickAliyunField(body, 'Message') ?? 'UNKNOWN');
  const requestId = String(pickAliyunField(body, 'RequestId') ?? '');
  return `${prefix}: code=${code}; message=${message}${requestId ? `; requestId=${requestId}` : ''}`;
}

function aliyunErrorCode(body: Record<string, unknown>): string {
  return String(pickAliyunField(body, 'Code') ?? 'UNKNOWN');
}

function aliyunRetryAfter(body: Record<string, unknown>): number | undefined {
  const code = aliyunErrorCode(body).toUpperCase();
  const message = String(pickAliyunField(body, 'Message') ?? '').toLowerCase();
  if (code.includes('FREQUENCY') || message.includes('frequency')) return 60;
  return undefined;
}

function logAliyunBody(label: string, body: Record<string, unknown>) {
  const modelObj = (body.Model ?? body.model ?? {}) as Record<string, unknown>;
  console.log(label, JSON.stringify({
    code: pickAliyunField(body, 'Code'),
    success: pickAliyunField(body, 'Success'),
    message: pickAliyunField(body, 'Message'),
    requestId: pickAliyunField(body, 'RequestId'),
    hasVerifyCode: Boolean(modelObj.VerifyCode ?? modelObj.verifyCode ?? body.VerifyCode ?? body.verifyCode),
  }));
}

function sanitizeAliyunErrorMessage(message: string, phone?: string): string {
  let safeMessage = message.replace(/PhoneNumber=\d+/g, 'PhoneNumber=***');
  if (phone) safeMessage = safeMessage.replaceAll(phone, maskPhone(phone));
  return safeMessage;
}

const ALIYUN_RUNTIME_OPTIONS = {
  autoretry: true,
  maxAttempts: 3,
  backoffPolicy: 'fixed',
  backoffPeriod: 800,
  connectTimeout: 8000,
  readTimeout: 12000,
  keepAlive: false,
};

function isRetryableAliyunError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /ConnectTimeout|ReadTimeout|Timeout|ETIMEDOUT|ECONNRESET|EAI_AGAIN|ENOTFOUND/i.test(message);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function callAliyunWithRetry<T>(label: string, call: () => Promise<T>): Promise<T> {
  const attempts = 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await call();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isRetryableAliyunError(error)) break;
      console.warn(`[SMS] Aliyun DYPNS ${label} transient failure, retrying (${attempt}/${attempts})`);
      await sleep(800);
    }
  }
  throw lastError;
}

async function createAliyunAuthClient() {
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;

  if (!accessKeyId || !accessKeySecret) {
    return { error: 'ALIYUN_ACCESS_KEY_ID / SECRET 未配置' };
  }

  const Dypnsapi = await import('@alicloud/dypnsapi20170525') as unknown as DypnsModule;
  const OpenApi = await import('@alicloud/openapi-client') as unknown as OpenApiModule;

  const config = new OpenApi.Config({
    accessKeyId,
    accessKeySecret,
    endpoint: 'dypnsapi.aliyuncs.com',
  });

  const DypnsClient = resolveDypnsClient(Dypnsapi);
  return { Dypnsapi, client: new DypnsClient(config) };
}

// ===== 阿里云短信认证（dypnsapi）=====
// 个人开发者友好：100次免费套餐包
// 使用系统赠送签名+模板，API自动生成验证码
async function sendViaAliyunAuth(phone: string): Promise<SMSSendResult> {
  const signName = process.env.ALIYUN_SMS_SIGN_NAME;
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE;

  if (!signName || !templateCode) {
    console.warn('[SMS] ALIYUN_SMS_SIGN_NAME 或 ALIYUN_SMS_TEMPLATE_CODE 未配置，降级为控制台打印');
    const fallbackCode = String(Math.floor(100000 + Math.random() * 900000));
    console.log(`[SMS-DEV] 验证码: ${fallbackCode}，手机号: ${maskPhone(phone)}`);
    return { success: true, code: fallbackCode, messageId: 'dev-mode' };
  }

  try {
    const aliyun = await createAliyunAuthClient();
    if ('error' in aliyun) return { success: false, error: aliyun.error };
    const { Dypnsapi, client } = aliyun;
    const request = new Dypnsapi.SendSmsVerifyCodeRequest({
      countryCode: '86',
      phoneNumber: phone,
      signName,
      templateCode,
      ...(process.env.ALIYUN_SMS_SCHEME_NAME ? { schemeName: process.env.ALIYUN_SMS_SCHEME_NAME } : {}),
      // 模板参数：##code## = 系统自动生成验证码，min = 有效时长(分钟)
      templateParam: JSON.stringify({ code: '##code##', min: '5' }),
      codeLength: 6,        // 6位验证码
      validTime: 300,       // 5分钟有效
      codeType: 1,          // 1=纯数字
      duplicatePolicy: 1,   // 同一场景保留最新验证码
      interval: 60,         // 服务商侧发送间隔
      returnVerifyCode: true, // 返回验证码，方便存储到数据库
    });
    const sendRes = await callAliyunWithRetry('send', () => (
      typeof client.sendSmsVerifyCodeWithOptions === 'function'
        ? client.sendSmsVerifyCodeWithOptions(request, ALIYUN_RUNTIME_OPTIONS)
        : client.sendSmsVerifyCode(request)
    ));

    const body = (sendRes.body ?? {}) as Record<string, unknown>;
    logAliyunBody('[SMS] Aliyun DYPNS send response:', body);
    // SDK 返回结构: body.Code='OK' 或 body.Success=true
    // 验证码在 body.Model.VerifyCode 或 body.model.verifyCode
    const bodyObj = body as Record<string, unknown>;
    if (aliyunSuccess(bodyObj)) {
      // 尝试多种路径提取验证码
      const modelObj = (bodyObj.Model ?? bodyObj.model ?? {}) as Record<string, unknown>;
      const returnedCode = String(
        modelObj.VerifyCode
        ?? modelObj.verifyCode
        ?? bodyObj.VerifyCode
        ?? bodyObj.verifyCode
        ?? ''
      );
      console.log('[SMS] Aliyun DYPNS returned verifyCode:', Boolean(returnedCode));
      if (!returnedCode) {
        console.warn('[SMS] API 未返回验证码，将使用服务商远端校验，避免本地验证码与短信内容不一致');
        return {
          success: true,
          code: REMOTE_SMS_CODE_MARKER,
          remoteVerify: true,
          messageId: String(bodyObj.RequestId ?? bodyObj.requestId ?? ''),
        };
      }
      return {
        success: true,
        code: returnedCode,
        messageId: String(bodyObj.RequestId ?? bodyObj.requestId ?? ''),
      };
    }
    return {
      success: false,
      error: aliyunError('阿里云短信认证失败', bodyObj),
      errorCode: aliyunErrorCode(bodyObj),
      retryAfter: aliyunRetryAfter(bodyObj),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    const safeMsg = sanitizeAliyunErrorMessage(msg, phone);
    console.error('[SMS] 阿里云短信认证异常:', safeMsg);
    if (msg.includes('Cannot find module') || msg.includes('MODULE_NOT_FOUND')) {
      console.warn('[SMS] dypnsapi SDK 未安装，降级为控制台打印');
      const fallbackCode = String(Math.floor(100000 + Math.random() * 900000));
      console.log(`[SMS-DEV] 验证码: ${fallbackCode}，手机号: ${maskPhone(phone)}`);
      return { success: true, code: fallbackCode, messageId: 'dev-mode' };
    }
    return { success: false, error: `阿里云短信异常: ${safeMsg}` };
  }
}

async function verifyViaAliyunAuth(phone: string, code: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const aliyun = await createAliyunAuthClient();
    if ('error' in aliyun) return { valid: false, error: aliyun.error };
    const { Dypnsapi, client } = aliyun;
    const request = new Dypnsapi.CheckSmsVerifyCodeRequest({
      phoneNumber: phone,
      verifyCode: code,
      countryCode: '86',
      caseAuthPolicy: 1,
      ...(process.env.ALIYUN_SMS_SCHEME_NAME ? { schemeName: process.env.ALIYUN_SMS_SCHEME_NAME } : {}),
    });
    const checkRes = await callAliyunWithRetry('verify', () => (
      typeof client.checkSmsVerifyCodeWithOptions === 'function'
        ? client.checkSmsVerifyCodeWithOptions(request, ALIYUN_RUNTIME_OPTIONS)
        : client.checkSmsVerifyCode(request)
    ));
    const body = (checkRes.body ?? {}) as Record<string, unknown>;
    const model = (body.Model ?? body.model ?? {}) as Record<string, unknown>;
    const verifyResult = String(model.VerifyResult ?? model.verifyResult ?? '').toUpperCase();
    if (aliyunSuccess(body) && verifyResult === 'PASS') {
      return { valid: true };
    }
    return { valid: false, error: '验证码错误或已过期' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    console.error('[SMS] 阿里云验证码远端校验异常:', sanitizeAliyunErrorMessage(msg, phone));
    return { valid: false, error: '验证码校验服务异常，请稍后重试' };
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
    if (data.error === 0) return { success: true, code, messageId: String(data.id) };
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
    const tencentcloud = await import('tencentcloud-sdk-nodejs-sms') as unknown as TencentModule;
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
    if (status?.Code === 'Ok') return { success: true, code, messageId: status.SerialNo };
    return { success: false, error: `腾讯云短信失败: ${status?.Message || '未知错误'}` };
  } catch (e) {
    return { success: false, error: `腾讯云短信异常: ${e instanceof Error ? e.message : 'unknown'}` };
  }
}

// ===== 统一接口 =====
// 阿里云：API自动生成验证码，返回 code
// 其他：需要传入 code 参数
export async function sendSMS(phone: string, code?: string): Promise<SMSSendResult> {
  const provider = getProvider();

  switch (provider) {
    case 'aliyun_auth':
      return sendViaAliyunAuth(phone);
    case 'luosimao':
      if (!code) return { success: false, error: 'Luosimao 需要传入验证码' };
      return sendViaLuosimao(phone, code);
    case 'tencent':
      if (!code) return { success: false, error: '腾讯云短信需要传入验证码' };
      return sendViaTencent(phone, code);
    default:
      return { success: false, error: `不支持的短信服务商: ${provider}` };
  }
}

export async function verifyRemoteSMSCode(phone: string, code: string): Promise<{ valid: boolean; error?: string }> {
  const provider = getProvider();

  switch (provider) {
    case 'aliyun_auth':
      return verifyViaAliyunAuth(phone, code);
    default:
      return { valid: false, error: '当前短信服务商不支持远端验证码校验' };
  }
}
