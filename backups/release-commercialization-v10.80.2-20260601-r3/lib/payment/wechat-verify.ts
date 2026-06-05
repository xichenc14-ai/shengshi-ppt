/**
 * src/lib/payment/wechat-verify.ts
 *
 * 微信支付 V3 回调签名验证
 *
 * 生成时间: 2026-05-10
 * 版本: v10.44
 */

import { createHmac, randomBytes } from 'crypto';

/**
 * 验证微信支付 V3 回调签名
 *
 * 微信 V3 签名算法：
 * 1. 从 HTTP 头提取 Wechatpay-Signature, Wechatpay-Timestamp, Wechatpay-Nonce
 * 2. 构造签名串: `${timestamp}\n{nonce}\n{body_hash}\n`
 * 3. 使用 APIv3 密钥计算 HMAC-SHA256
 * 4. 对比计算的签名与 HTTP 头中的签名
 *
 * @param body 回调请求体（字符串）
 * @param signature HTTP 头 Wechatpay-Signature（Base64 编码）
 * @param timestamp HTTP 头 Wechatpay-Timestamp
 * @param nonce HTTP 头 Wechatpay-Nonce
 * @param apiKey APIv3 密钥
 * @returns 签名是否通过验证
 */
export async function verifyWechatPaySignature(
  body: string,
  signature: string,
  timestamp: string,
  nonce: string,
  apiKey: string
): Promise<boolean> {
  try {
    if (!body || !signature || !timestamp || !nonce || !apiKey) {
      console.warn('[WechatVerify] 参数不完整，无法验证签名');
      return false;
    }

    // 1. 计算请求体的 SHA-256 Hash
    const bodyHash = createHmac('sha256', apiKey)
      .update(body)
      .digest('hex');

    // 2. 构造签名串
    // 格式: `${timestamp}\n{nonce}\n{body_hash}\n`
    const signStr = `${timestamp}\n${nonce}\n${bodyHash}\n`;

    // 3. 使用 APIv3 密钥计算 HMAC-SHA256
    const computedSignature = createHmac('sha256', apiKey)
      .update(signStr)
      .digest('base64');

    // 4. 对比签名（使用恒定时间比较防止时序攻击）
    return timingSafeEqual(signature, computedSignature);
  } catch (e) {
    console.error('[WechatVerify] 签名验证过程异常:', e);
    return false;
  }
}

/**
 * 恒定时间字符串比较（防止时序攻击）
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}

/**
 * 从请求头提取微信签名参数
 *
 * @param headers Next.js Headers 对象或标准 Headers
 * @returns 签名验证所需的 HTTP 头参数
 */
export function extractWechatHeaders(headers: Headers | Record<string, string | string[] | undefined>): {
  signature: string | null;
  timestamp: string | null;
  nonce: string | null;
  serial: string | null;
} {
  // 支持 Headers 对象和普通 Record
  const getHeader = (name: string): string | null => {
    if (headers instanceof Headers) {
      return headers.get(name);
    }
    const val = headers[name];
    if (Array.isArray(val)) return val[0] || null;
    return (val as string) || null;
  };

  return {
    // Wechatpay-Signature 或 X-Wechatpay-Signature（兼容不同代理）
    signature: getHeader('wechatpay-signature') || getHeader('x-wechatpay-signature') || null,
    timestamp: getHeader('wechatpay-timestamp') || getHeader('x-wechatpay-timestamp') || null,
    nonce: getHeader('wechatpay-nonce') || getHeader('x-wechatpay-nonce') || null,
    serial: getHeader('wechatpay-serial') || getHeader('x-wechatpay-serial') || null,
  };
}

/**
 * 生成随机字符串（用于构造签名时的 nonce）
 */
export function generateNonce(): string {
  return randomBytes(16).toString('hex');
}

/**
 * 完整的微信支付回调验证流程
 *
 * @param body 回调请求体（对象或字符串）
 * @param headers HTTP 请求头
 * @param apiKey APIv3 密钥
 * @returns 验证是否通过
 */
export async function verifyWechatPayCallback(
  body: string | Record<string, unknown>,
  headers: Headers | Record<string, string | string[] | undefined>,
  apiKey: string
): Promise<{ valid: boolean; reason?: string }> {
  const { signature, timestamp, nonce, serial } = extractWechatHeaders(headers);

  if (!signature) {
    return { valid: false, reason: '缺少微信支付签名' };
  }

  if (!timestamp) {
    return { valid: false, reason: '缺少微信支付时间戳' };
  }

  if (!nonce) {
    return { valid: false, reason: '缺少微信支付随机数' };
  }

  // body 已经是字符串则直接使用，否则 JSON.stringify
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);

  const valid = await verifyWechatPaySignature(bodyStr, signature, timestamp, nonce, apiKey);

  if (!valid) {
    return { valid: false, reason: '微信支付签名验证失败' };
  }

  return { valid: true };
}
