// SMS Client - 短信验证码发送客户端
// 支持：阿里云短信认证（dypnsapi）/ Luosimao / 腾讯云
// 环境变量：
//   SMS_PROVIDER=aliyun_auth|luosimao|tencent（默认 aliyun_auth）
//   ALIYUN_ACCESS_KEY_ID=xxx  ALIYUN_ACCESS_KEY_SECRET=xxx
//   ALIYUN_SMS_SIGN_NAME=速通互联验证码  ALIYUN_SMS_TEMPLATE_CODE=100001

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

type SMSProvider = 'aliyun_auth' | 'luosimao' | 'tencent';

export const REMOTE_SMS_CODE_MARKER = '__REMOTE_SMS_PROVIDER_VERIFY__';
const LOCAL_SMS_CODE_HASH_PREFIX = '__LOCAL_SMS_CODE_HMAC_V1__:';

export interface SMSSendResult {
  success: boolean;
  code?: string;       // 本地可校验验证码；DYPNS 可能不返回真实验证码
  remoteVerify?: boolean; // true 表示验证码需回源到服务商校验
  error?: string;
  errorCode?: string;
  retryAfter?: number;
  messageId?: string;
  providerRequestId?: string;
}

export type SMSSendOptions = { outId?: string };

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

function maskPhone(phone: string): string {
  return phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}

export function normalizeSMSCode(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '').slice(0, 6);
}

function getLocalCodeHashSecret(): string {
  // 独立密钥优先；使用 service role 作为兼容兜底，避免生产环境没有新变量时退回明文。
  return process.env.SMS_CODE_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

function localCodeDigest(phone: string, code: string): string | null {
  const secret = getLocalCodeHashSecret();
  if (!secret) return null;
  return createHmac('sha256', secret)
    .update(`sms-code:v1:${phone}:${code}`, 'utf8')
    .digest('hex');
}

export function getStorableSMSCode(result: SMSSendResult, fallbackCode: string, phone?: string): string {
  if (result.remoteVerify === true) return REMOTE_SMS_CODE_MARKER;
  const code = normalizeSMSCode(result.code) || normalizeSMSCode(fallbackCode);
  if (!phone) return code;
  const digest = localCodeDigest(phone, code);
  return digest ? `${LOCAL_SMS_CODE_HASH_PREFIX}${digest}` : code;
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
  if (storedCode.startsWith(LOCAL_SMS_CODE_HASH_PREFIX)) {
    const expected = localCodeDigest(phone, normalizedCode);
    const actual = storedCode.slice(LOCAL_SMS_CODE_HASH_PREFIX.length);
    if (!expected || actual.length !== expected.length) {
      return { valid: false, error: '验证码错误或已过期' };
    }
    return timingSafeEqual(Buffer.from(actual, 'utf8'), Buffer.from(expected, 'utf8'))
      ? { valid: true }
      : { valid: false, error: '验证码错误或已过期' };
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

type AliyunRPCValue = string | number | boolean;

function aliyunPercentEncode(value: AliyunRPCValue): string {
  return encodeURIComponent(String(value)).replace(/[!'()*]/g, (character) => (
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  ));
}

function getAliyunTimeoutMs(): number {
  const configured = Number(process.env.ALIYUN_SMS_TIMEOUT_MS || 20_000);
  return Number.isFinite(configured) ? Math.min(25_000, Math.max(5_000, Math.floor(configured))) : 20_000;
}

function getAliyunEndpoint(): string {
  const configured = String(process.env.ALIYUN_DYPNS_ENDPOINT || 'dypnsapi.aliyuncs.com')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '');
  if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(configured)) {
    throw new Error('ALIYUN_DYPNS_ENDPOINT 配置无效');
  }
  return configured;
}

export async function inspectSMSProviderReadiness(): Promise<{ ready: boolean; detail: string }> {
  const provider = getProvider();
  if (provider === 'aliyun_auth') {
    const configured = Boolean(
      process.env.ALIYUN_ACCESS_KEY_ID
      && process.env.ALIYUN_ACCESS_KEY_SECRET
      && process.env.ALIYUN_SMS_SIGN_NAME
      && process.env.ALIYUN_SMS_TEMPLATE_CODE,
    );
    if (!configured) return { ready: false, detail: 'aliyun_auth_configuration_incomplete' };

    try {
      // HEAD 只能证明 CDN 入口可达，不能证明签名 RPC 请求能完成。使用不会发送短信的
      // 验证接口同时检查 DNS/TLS、RPC 请求链路、签名、AccessKey 和产品权限。
      const body = await callAliyunRPC('CheckSmsVerifyCode', {
        CountryCode: '86',
        PhoneNumber: '13800138000',
        VerifyCode: '000000',
        CaseAuthPolicy: 1,
      });
      const code = aliyunErrorCode(body);
      if (!code || code === 'UNKNOWN') return { ready: false, detail: 'aliyun_auth_rpc_malformed_response' };
      const normalizedCode = code.toUpperCase();
      const accessFailure = [
        'INVALIDACCESSKEYID',
        'SIGNATUREDOESNOTMATCH',
        'FORBIDDEN',
        'FUNCTION_NOT_OPENED',
        'UNAUTHORIZED',
      ].some((marker) => normalizedCode.includes(marker));
      return accessFailure
        ? { ready: false, detail: `aliyun_auth_rpc_${code}` }
        : { ready: true, detail: `aliyun_auth_rpc_${code}` };
    } catch {
      return { ready: false, detail: 'aliyun_auth_rpc_transport_error' };
    }
  }
  if (provider === 'luosimao') {
    return process.env.LUOSIMAO_API_KEY
      ? { ready: true, detail: 'luosimao_configured' }
      : { ready: false, detail: 'luosimao_configuration_incomplete' };
  }
  if (provider === 'tencent') {
    const configured = Boolean(
      process.env.TENCENT_SECRET_ID
      && process.env.TENCENT_SECRET_KEY
      && process.env.TENCENT_SMS_APP_ID
      && process.env.TENCENT_SMS_SIGN
      && process.env.TENCENT_SMS_TEMPLATE_ID,
    );
    return configured
      ? { ready: true, detail: 'tencent_configured' }
      : { ready: false, detail: 'tencent_configuration_incomplete' };
  }
  return { ready: false, detail: 'unsupported_sms_provider' };
}

/**
 * 使用平台原生 fetch 调用阿里云 RPC API。
 *
 * 阿里云官方 SDK 的旧 httpx 传输层在 Vercel 香港冷启动后持续出现 ConnectTimeout。
 * 这里仍使用阿里云公开的 RPC HMAC-SHA1 签名协议，但绕过不稳定的传输层。请求不做
 * 自动重试，避免“服务端已接收、客户端超时”时重复发送验证码。使用官方 RPC
 * 支持的 GET 签名请求；实测同一出口下 GET 明显快于空 body POST，且不会触发
 * Vercel 到 DYPNS 的 POST 长连接黑洞。
 */
async function callAliyunRPC(
  action: 'SendSmsVerifyCode' | 'CheckSmsVerifyCode',
  actionParameters: Record<string, AliyunRPCValue>,
): Promise<Record<string, unknown>> {
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
  if (!accessKeyId || !accessKeySecret) {
    throw new Error('ALIYUN_ACCESS_KEY_ID / SECRET 未配置');
  }

  const parameters: Record<string, AliyunRPCValue> = {
    AccessKeyId: accessKeyId,
    Action: action,
    Format: 'JSON',
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: randomUUID(),
    SignatureVersion: '1.0',
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    Version: '2017-05-25',
    ...actionParameters,
  };
  // 必须按 ASCII 字节序排序；localeCompare 会把 SignName 错排到 SignatureVersion 后面。
  const canonicalQuery = Object.keys(parameters)
    .sort()
    .map((key) => `${aliyunPercentEncode(key)}=${aliyunPercentEncode(parameters[key])}`)
    .join('&');
  const httpMethod = 'GET';
  const stringToSign = `${httpMethod}&${aliyunPercentEncode('/')}&${aliyunPercentEncode(canonicalQuery)}`;
  const signature = createHmac('sha1', `${accessKeySecret}&`)
    .update(stringToSign, 'utf8')
    .digest('base64');
  const endpoint = getAliyunEndpoint();
  const response = await fetch(
    `https://${endpoint}/?${canonicalQuery}&Signature=${aliyunPercentEncode(signature)}`,
    {
      method: httpMethod,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(getAliyunTimeoutMs()),
    },
  );
  const responseText = await response.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(responseText) as Record<string, unknown>;
  } catch {
    throw new Error(`阿里云短信返回非 JSON 响应（HTTP ${response.status}）`);
  }
  if (!response.ok && !pickAliyunField(body, 'Code')) {
    throw new Error(`阿里云短信网络响应异常（HTTP ${response.status}）`);
  }
  return body;
}

// ===== 阿里云短信认证（dypnsapi）=====
// 个人开发者友好：100次免费套餐包
// 使用系统赠送签名+模板，API自动生成验证码
async function sendViaAliyunAuth(phone: string, suppliedCode?: string, options: SMSSendOptions = {}): Promise<SMSSendResult> {
  const signName = process.env.ALIYUN_SMS_SIGN_NAME;
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE;

  if (!signName || !templateCode) {
    console.warn('[SMS] ALIYUN_SMS_SIGN_NAME 或 ALIYUN_SMS_TEMPLATE_CODE 未配置，降级为控制台打印');
    const fallbackCode = String(Math.floor(100000 + Math.random() * 900000));
    console.log(`[SMS-DEV] 验证码: ${fallbackCode}，手机号: ${maskPhone(phone)}`);
    return { success: true, code: fallbackCode, messageId: 'dev-mode' };
  }

  const code = normalizeSMSCode(suppliedCode);
  if (code.length !== 6) return { success: false, error: '验证码生成失败', errorCode: 'INVALID_LOCAL_CODE' };

  try {
    const body = await callAliyunRPC('SendSmsVerifyCode', {
      CountryCode: '86',
      PhoneNumber: phone,
      SignName: signName,
      TemplateCode: templateCode,
      ...(process.env.ALIYUN_SMS_SCHEME_NAME ? { SchemeName: process.env.ALIYUN_SMS_SCHEME_NAME } : {}),
      // 使用应用生成的固定验证码：新验证码可在本地验证，避免收到短信后再次
      // 依赖 Vercel → 阿里云 CheckSmsVerifyCode 链路而误判失败。
      TemplateParam: JSON.stringify({ code, min: '5' }),
      CodeLength: 6,
      ValidTime: 300,
      CodeType: 1,
      DuplicatePolicy: 1,
      Interval: 60,
      ReturnVerifyCode: false,
      ...(options.outId ? { OutId: options.outId } : {}),
    });
    logAliyunBody('[SMS] Aliyun DYPNS send response:', body);
    const bodyObj = body;
    if (aliyunSuccess(bodyObj)) {
      const modelObj = (bodyObj.Model ?? bodyObj.model ?? {}) as Record<string, unknown>;
      return {
        success: true,
        code,
        // BizId 才能与阿里云送达回执关联；RequestId 仅用于接口请求排障。
        messageId: String(modelObj.BizId ?? modelObj.bizId ?? ''),
        providerRequestId: String(pickAliyunField(bodyObj, 'RequestId') ?? ''),
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
    return { success: false, error: `阿里云短信异常: ${safeMsg}`, errorCode: 'PROVIDER_TRANSPORT_ERROR' };
  }
}

async function verifyViaAliyunAuth(phone: string, code: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const body = await callAliyunRPC('CheckSmsVerifyCode', {
      PhoneNumber: phone,
      VerifyCode: code,
      CountryCode: '86',
      CaseAuthPolicy: 1,
      ...(process.env.ALIYUN_SMS_SCHEME_NAME ? { SchemeName: process.env.ALIYUN_SMS_SCHEME_NAME } : {}),
    });
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
// 所有服务商均接收应用生成的固定验证码；旧的远端标记仅用于兼容历史记录。
export async function sendSMS(phone: string, code?: string, options?: SMSSendOptions): Promise<SMSSendResult> {
  const provider = getProvider();

  switch (provider) {
    case 'aliyun_auth':
      if (!code) return { success: false, error: '阿里云短信需要传入验证码' };
      return sendViaAliyunAuth(phone, code, options);
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
