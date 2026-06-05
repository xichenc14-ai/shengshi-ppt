/**
 * Payment security utilities
 *
 * PAYMENT_CALLBACK_POLICY=STRICT_DENY_IF_UNCONFIGURED
 *
 * DEPLOY_ENV_BLOCKER=YES_UNLESS_ALLOWED_CALLBACK_IPS_CONFIGURED
 *
 * 说明：
 * - 如果 ALLOWED_CALLBACK_IPS 未配置或为空，回调全部拒绝
 * - 这是安全优先策略，防止未授权的支付回调攻击
 * - 部署前 auditor 必须确认 ALLOWED_CALLBACK_IPS 已正确配置
 * - 如果 auditor 发现未配置，有权给出 FAIL 并阻断 deploy
 */

const ALLOWED_CALLBACK_IPS_ENV = 'ALLOWED_CALLBACK_IPS';

/**
 * 获取允许的回调IP列表
 * @returns IP 数组（未配置时返回空数组）
 */
function getAllowedCallbackIPs(): string[] {
  const env = process.env[ALLOWED_CALLBACK_IPS_ENV];
  if (!env || env.trim() === '') {
    return [];
  }
  return env.split(',').map(ip => ip.trim()).filter(ip => ip.length > 0);
}

/**
 * 检查客户端IP是否在允许列表中
 *
 * 策略：STRICT_DENY_IF_UNCONFIGURED
 * - 未配置白名单 → 拒绝所有回调（安全优先）
 * - 配置为空 → 拒绝所有回调
 * - 只有明确匹配的IP/段才允许
 *
 * @param clientIP 客户端IP（从 x-forwarded-for 或 x-real-ip 获取）
 * @returns true=允许, false=拒绝
 */
export function isCallbackIPAllowed(clientIP: string): boolean {
  const allowed = getAllowedCallbackIPs();

  if (allowed.length === 0) {
    // 未配置白名单，保守策略：拒绝
    // 日志仅记录检查结果，不输出环境变量内容
    console.warn(
      `[Payment] ALLOWED_CALLBACK_IPS 未配置，` +
      `回调IP ${clientIP} 被拒绝（STRICT_DENY_IF_UNCONFIGURED 策略）`
    );
    return false;
  }

  // 简单前缀匹配 + 精确匹配
  // 支持：
  // - 精确IP（如 1.2.3.4）
  // - 前缀匹配（如 1.2.3. 匹配 1.2.3.x）
  for (const allowedIP of allowed) {
    if (allowedIP.endsWith('.')) {
      if (clientIP.startsWith(allowedIP)) {
        return true;
      }
    } else if (clientIP === allowedIP) {
      return true;
    }
  }

  console.warn(
    `[Payment] 回调IP ${clientIP} 不在白名单，` +
    `允许 ${allowed.length} 个条目，策略：STRICT_DENY_IF_UNCONFIGURED`
  );
  return false;
}
