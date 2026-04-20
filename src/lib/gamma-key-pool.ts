// Gamma API Key Pool Manager
// 实现：多key轮换 + 积分监控 + 智能分配
// 安全：所有 Key 从环境变量 GAMMA_API_KEYS 读取

interface KeyInfo {
  key: string;
  label: string;
  remaining: number;
  lastUsed: Date;
  successCount: number;
  failCount: number;
  // Rate limit tracking
  rateLimitRemaining?: number;   // X-RateLimit-Remaining header
  rateLimitReset?: number;       // X-RateLimit-Reset header (Unix timestamp)
  retryAfter?: number;           // Retry-After seconds from 429 response
  consecutiveFailures: number;   // 连续失败次数（触发429退避）
}

// ===== 安全检查：确保环境变量已配置 =====
function loadKeyPool(): KeyInfo[] {
  const keyString = process.env.GAMMA_API_KEYS;
  
  if (!keyString || keyString.trim() === '') {
    // 开发模式给出更友好的提示
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Gamma] GAMMA_API_KEYS environment variable is not set. Gamma API features will be disabled.');
      return [];
    }
    throw new Error('[FATAL] GAMMA_API_KEYS environment variable is required. Set it in your .env.local file with comma-separated keys.');
  }

  const keys = keyString.split(',').map(k => k.trim()).filter(k => k.length > 0);
  
  if (keys.length === 0) {
    throw new Error('[FATAL] GAMMA_API_KEYS is set but contains no valid keys. Format: key1,key2,key3');
  }

  // 为每个 key 分配标签
  const labels = ['主key', '备用1', '备用2', '备用3', '备用4', '备用5'];
  
  return keys.map((key, index) => ({
    key,
    label: labels[index] || `备用${index + 1}`,
    remaining: 0, // 初始为 0，第一次使用后会从 API 返回更新
    lastUsed: new Date(),
    successCount: 0,
    failCount: 0,
    consecutiveFailures: 0, // 初始为 0
  }));
}

// 延迟初始化 Key 池（避免启动时就抛错）
let KEY_POOL: KeyInfo[] | null = null;

function getKeyPool(): KeyInfo[] {
  if (KEY_POOL === null) {
    try {
      KEY_POOL = loadKeyPool();
    } catch (e) {
      console.error('[Gamma] Failed to load key pool:', e);
      KEY_POOL = [];
    }
  }
  return KEY_POOL;
}

// 积分阈值配置
const LOW_BALANCE_THRESHOLD = 500; // 低余额预警
const MIN_BALANCE_THRESHOLD = 100; // 最低可用余额

/**
 * 智能选择最优Key
 * 策略：余额优先 + 避免连续使用同一个
 */
export function selectBestKey(): KeyInfo {
  const pool = getKeyPool();
  
  if (pool.length === 0) {
    throw new Error('Gamma API Key 未配置。请设置 GAMMA_API_KEYS 环境变量。');
  }
  
  // 过滤可用key（余额>=最低阈值）
  const availableKeys = pool.filter(k => k.remaining >= MIN_BALANCE_THRESHOLD);
  
  if (availableKeys.length === 0) {
    // 如果所有 key 余额都未知或不足，尝试使用第一个 key
    // 第一次使用时 remaining 为 0，需要先调用才能知道余额
    return pool[0];
  }
  
  // 按余额降序排序
  availableKeys.sort((a, b) => b.remaining - a.remaining);
  
  // 选择余额最高的key
  const bestKey = availableKeys[0];
  
  return bestKey;
}

/**
 * 更新Key余额（从API返回）
 */
export function updateKeyBalance(key: string, deducted: number, remaining: number, rateLimitHeaders?: { remaining?: number; reset?: number }): void {
  const pool = getKeyPool();
  const keyInfo = pool.find(k => k.key === key);
  if (keyInfo) {
    keyInfo.remaining = remaining;
    keyInfo.lastUsed = new Date();
    keyInfo.successCount++;
    keyInfo.consecutiveFailures = 0;
    if (rateLimitHeaders) {
      if (rateLimitHeaders.remaining !== undefined) keyInfo.rateLimitRemaining = rateLimitHeaders.remaining;
      if (rateLimitHeaders.reset !== undefined) keyInfo.rateLimitReset = rateLimitHeaders.reset;
    }
    if (remaining < LOW_BALANCE_THRESHOLD) {
      console.warn(`[Gamma] ${keyInfo.label} 余额不足: ${remaining}`);
    }
  }
}

/**
 * 记录Key失败
 */
export function recordKeyFailure(key: string, retryAfterSeconds?: number): void {
  const pool = getKeyPool();
  const keyInfo = pool.find(k => k.key === key);
  if (keyInfo) {
    keyInfo.failCount++;
    keyInfo.consecutiveFailures++;
    keyInfo.lastUsed = new Date();
    if (retryAfterSeconds) {
      keyInfo.retryAfter = retryAfterSeconds;
      console.warn(`[Gamma] ${keyInfo.label} 触发429，Retry-After: ${retryAfterSeconds}s`);
    }
  }
}

/**
 * 获取Key池状态（用于监控/日志）
 */
export function getKeyPoolStatus(): {
  keys: KeyInfo[];
  totalRemaining: number;
  healthyCount: number;
  lowBalanceKeys: string[];
  configuredCount: number;
} {
  const pool = getKeyPool();
  const healthyKeys = pool.filter(k => k.remaining >= LOW_BALANCE_THRESHOLD);
  const lowKeys = pool.filter(k => k.remaining < LOW_BALANCE_THRESHOLD && k.remaining > 0);
  
  return {
    keys: pool.map(k => ({ ...k, key: `${k.key.substring(0, 10)}...` })), // 隐藏完整 key
    totalRemaining: pool.reduce((sum, k) => sum + k.remaining, 0),
    healthyCount: healthyKeys.length,
    lowBalanceKeys: lowKeys.map(k => `${k.label}: ${k.remaining}`),
    configuredCount: pool.length,
  };
}

/**
 * 获取所有Key（用于需要遍历的场景）
 */
export function getAllKeys(): KeyInfo[] {
  return getKeyPool();
}

/**
 * 积分换算：Gamma credits → 用户积分
 * 当前：1 Gamma credit = 1 用户积分
 * TODO: 根据产品定价调整换算比例
 */
export function convertCreditsToUserPoints(gammaCredits: number): number {
  return gammaCredits;
}

/**
 * 检查 Key 池是否已配置
 */
export function isKeyPoolConfigured(): boolean {
  return getKeyPool().length > 0;
}

// 导出Key信息类型
export type { KeyInfo };