/**
 * src/lib/payment/alipay-verify.ts
 *
 * 支付宝回调签名验证（RSA2）
 *
 * 生成时间: 2026-05-10
 * 版本: v10.44
 */

import { createPublicKey, createVerify } from 'crypto';

/**
 * 验证支付宝回调签名
 *
 * 支付宝 RSA2 签名验证流程：
 * 1. 从回调参数中提取 sign（签名）和 sign_type（RSA2）
 * 2. 移除 sign 和 sign_type 字段
 * 3. 将剩余参数按键名排序，拼接成 `key=value&key=value` 格式
 * 4. 使用支付宝公钥验证签名
 *
 * @param params 支付宝回调参数（Record）
 * @param alipayPublicKey 支付宝公钥（PEM 格式）
 * @returns 签名是否通过验证
 */
export function verifyAlipaySignature(
  params: Record<string, unknown>,
  alipayPublicKey: string
): boolean {
  try {
    if (!params || typeof params !== 'object') {
      console.warn('[AlipayVerify] 参数无效');
      return false;
    }

    if (!alipayPublicKey) {
      console.warn('[AlipayVerify] 支付宝公钥未配置');
      return false;
    }

    // 1. 提取签名和签名类型
    const sign = params.sign as string | undefined;
    const signType = (params.sign_type as string | undefined) || 'RSA2';

    if (!sign) {
      console.warn('[AlipayVerify] 缺少签名参数');
      return false;
    }

    // 2. 移除 sign 和 sign_type，计算待签名字符串
    const unsignedParams = { ...params };
    delete unsignedParams.sign;
    delete unsignedParams.sign_type;

    // 3. 过滤空值并按键名排序
    const sortedParams = Object.keys(unsignedParams)
      .filter(key => {
        const val = unsignedParams[key];
        return val !== undefined && val !== null && val !== '';
      })
      .sort()
      .map(key => {
        const val = unsignedParams[key];
        // 如果是对象或数组，JSON.stringify
        const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
        return `${key}=${strVal}`;
      })
      .join('&');

    if (!sortedParams) {
      console.warn('[AlipayVerify] 待签名参数为空');
      return false;
    }

    // 4. 使用公钥验证签名
    const publicKey = createPublicKey(alipayPublicKey);
    const verifier = createVerify(signType === 'RSA2' ? 'RSA-SHA256' : 'RSA-SHA1');

    if (!verifier.update(sortedParams)) {
      console.warn('[AlipayVerify] 签名验证器更新失败');
      return false;
    }

    return verifier.verify(publicKey, sign, 'base64');
  } catch (e) {
    console.error('[AlipayVerify] 签名验证异常:', e);
    return false;
  }
}

/**
 * 从支付宝回调参数中提取签名
 *
 * @param params 支付宝回调参数
 * @returns 签名值或 null
 */
export function extractAlipaySign(params: Record<string, unknown>): string | null {
  return (params.sign as string) || null;
}

/**
 * 完整的支付宝回调验证流程
 *
 * @param params 支付宝回调参数（Record）
 * @param alipayPublicKey 支付宝公钥（PEM 格式）
 * @returns 验证结果
 */
export function verifyAlipayCallback(
  params: Record<string, unknown>,
  alipayPublicKey: string
): { valid: boolean; reason?: string } {
  if (!alipayPublicKey) {
    return { valid: false, reason: '支付宝公钥未配置' };
  }

  const valid = verifyAlipaySignature(params, alipayPublicKey);

  if (!valid) {
    return { valid: false, reason: '支付宝签名验证失败' };
  }

  return { valid: true };
}

/**
 * 将支付宝公钥字符串转换为 PEM 格式（如果需要）
 *
 * 支付宝公钥有多种格式，此函数处理常见的两种：
 * 1. 已经是完整 PEM 格式（以 -----BEGIN PUBLIC KEY----- 开头）
 * 2. 仅包含 BASE64 编码内容（需要包装为 PEM）
 *
 * @param rawKey 原始公钥字符串
 * @returns PEM 格式公钥
 */
export function normalizeAlipayPublicKey(rawKey: string): string {
  const trimmed = rawKey.trim();

  if (trimmed.includes('-----BEGIN PUBLIC KEY-----')) {
    return trimmed;
  }

  // 支付宝公钥格式：MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ...
  // 需要包装为 PEM 格式
  const lines: string[] = ['-----BEGIN PUBLIC KEY-----'];
  for (let i = 0; i < trimmed.length; i += 64) {
    lines.push(trimmed.substring(i, i + 64));
  }
  lines.push('-----END PUBLIC KEY-----');

  return lines.join('\n');
}
