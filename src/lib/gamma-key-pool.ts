// Gamma API Key Pool Manager
// 实现：多key轮换 + 积分监控 + 智能分配
//
// 🔐 SECURITY: 所有Key从环境变量读取，禁止硬编码！

interface KeyInfo {
  key: string;
  label: string;
  remaining: number;
  lastUsed: Date;
  successCount: number;
  failCount: number;
}

// 积分阈值配置
const LOW_BALANCE_THRESHOLD = 500; // 低余额预警（仅用于日志提示，不影响选择）
const MIN_BALANCE_THRESHOLD = 100; // 最低可用余额

/**
 * 从环境变量加载 Gamma API Keys
 * 格式: GAMMA_API_KEYS=key1,key2,key3
 * 每个Key格式: keyLabel:remaining:key
 * 例如: 主key:3976:sk-gamma-xxx,备用1:3967:sk-gamma-yyy
 */
function loadKeyPool(): KeyInfo[] {
  const envValue = process.env.GAMMA_API_KEYS;

  if (!envValue || envValue.trim() === '') {
    throw new Error(
      '[Gamma] GAMMA_API_KEYS 环境变量未设置。请在 .env 或 .env.local 中设置 GAMMA_API_KEYS。\n' +
      '格式: GAMMA_API_KEYS=主key:3976:sk-gamma-xxx,备用1:3967:sk-gamma-yyy\n' +
      '格式说明: label:remainingCredits:apiKey'
    );
  }

  const keys: KeyInfo[] = [];
  const entries = envValue.split(',');

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i].trim();
    if (!entry) continue;

    // 支持两种格式:
    // 1. label:remaining:key (完整格式)
    // 2. key (仅Key，需要手动设置remaining)
    const colonCount = (entry.match(/:/g) || []).length;

    if (colonCount >= 2) {
      // 完整格式: label:remaining:key 或 key:remaining:label
      // 尝试识别哪个是key（以sk-gamma开头）
      const parts = entry.split(':');
      let label: string;
      let remaining: number;
      let key: string;

      const keyIndex = parts.findIndex(p => p.trim().startsWith('sk-gamma'));
      if (keyIndex === -1) {
        // 没有找到sk-gamma格式，尝试旧格式 key:remaining:label
        key = parts[0];
        remaining = parseInt(parts[1], 10) || 3967;
        label = parts.slice(2).join(':') || `Key-${i + 1}`;
      } else if (keyIndex === 0) {
        // 格式: key:remaining:label
        key = parts[0];
        remaining = parseInt(parts[1], 10) || 3967;
        label = parts.slice(2).join(':') || `Key-${i + 1}`;
      } else if (keyIndex === parts.length - 1) {
        // 格式: label:remaining:key
        label = parts[0];
        remaining = parseInt(parts[1], 10) || 3967;
        key = parts[2];
      } else {
        // 中间位置，假定 label:remaining:key
        label = parts[0];
        remaining = parseInt(parts[1], 10) || 3967;
        key = parts.slice(2).join(':');
      }

      if (!key.startsWith('sk-gamma')) {
        throw new Error(`[Gamma] Key格式无效（不是sk-gamma开头）: ${entry}`);
      }

      keys.push({
        key,
        label,
        remaining,
        lastUsed: new Date(),
        successCount: 0,
        failCount: 0,
      });
    } else if (entry.startsWith('sk-gamma')) {
      // 仅有Key，remaining默认3967
      keys.push({
        key: entry,
        label: `Key-${i + 1}`,
        remaining: 3967,
        lastUsed: new Date(),
        successCount: 0,
        failCount: 0,
      });
    } else {
      throw new Error(`[Gamma] Key格式无法解析: ${entry}。请使用 sk-gamma 开头的Key。`);
    }
  }

  if (keys.length === 0) {
    throw new Error('[Gamma] GAMMA_API_KEYS 解析后没有任何有效Key。');
  }

  return keys;
}

// 动态加载Key池（运行时从环境变量读取）
let KEY_POOL: KeyInfo[] | null = null;

function getKeyPool(): KeyInfo[] {
  if (!KEY_POOL) {
    KEY_POOL = loadKeyPool();
  }
  return KEY_POOL;
}

/**
 * 重新加载Key池（用于运行时刷新）
 */
export function reloadKeyPool(): void {
  KEY_POOL = null;
  getKeyPool(); // 验证能正常加载
}

/**
 * 智能选择最优Key
 * 策略：余额优先 + 避免连续使用同一个
 */
export function selectBestKey(): KeyInfo {
  const pool = getKeyPool();
  // 过滤可用key（余额>=最低阈值）
  const availableKeys = pool.filter(k => k.remaining >= MIN_BALANCE_THRESHOLD);

  if (availableKeys.length === 0) {
    throw new Error('所有Gamma API Key余额不足');
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
export function updateKeyBalance(key: string, deducted: number, remaining: number): void {
  const pool = getKeyPool();
  const keyInfo = pool.find(k => k.key === key);
  if (keyInfo) {
    keyInfo.remaining = remaining;
    keyInfo.lastUsed = new Date();
    keyInfo.successCount++;

    // 低余额预警
    if (remaining < LOW_BALANCE_THRESHOLD) {
      console.warn(`[Gamma] ${keyInfo.label} 余额不足: ${remaining}`);
    }
  }
}

/**
 * 记录Key失败
 */
export function recordKeyFailure(key: string): void {
  const pool = getKeyPool();
  const keyInfo = pool.find(k => k.key === key);
  if (keyInfo) {
    keyInfo.failCount++;
    keyInfo.lastUsed = new Date();
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
} {
  const pool = getKeyPool();
  const healthyKeys = pool.filter(k => k.remaining >= LOW_BALANCE_THRESHOLD);
  const lowKeys = pool.filter(k => k.remaining < LOW_BALANCE_THRESHOLD);

  return {
    keys: pool,
    totalRemaining: pool.reduce((sum, k) => sum + k.remaining, 0),
    healthyCount: healthyKeys.length,
    lowBalanceKeys: lowKeys.map(k => `${k.label}: ${k.remaining}`),
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

// 导出Key信息类型
export type { KeyInfo };
