// Gamma API Key Pool Manager
// 实现：多key轮换 + 积分监控 + 智能分配

interface KeyInfo {
  key: string;
  label: string;
  remaining: number;
  lastUsed: Date;
  successCount: number;
  failCount: number;
}

// Key池配置
const KEY_POOL: KeyInfo[] = [
  {
    key: 'sk-gamma-aN5tVoqv26bND6vl7eIfaNzY5ffx20725LbgEnlSw',
    label: '主key',
    remaining: 3976,
    lastUsed: new Date(),
    successCount: 0,
    failCount: 0,
  },
  {
    key: 'sk-gamma-T6liPnfuBuch5oPfgdqDkU7cfcwS29IAv6M2QYBRmr8',
    label: '备用1',
    remaining: 3967,
    lastUsed: new Date(),
    successCount: 0,
    failCount: 0,
  },
  {
    key: 'sk-gamma-cknOnrWaGzmJ6C8ieRIr1VAKIFz81kFOJnCOqV2oNU',
    label: '备用2',
    remaining: 3967,
    lastUsed: new Date(),
    successCount: 0,
    failCount: 0,
  },
];

// 积分阈值配置
const LOW_BALANCE_THRESHOLD = 500; // 低余额预警
const MIN_BALANCE_THRESHOLD = 100; // 最低可用余额

/**
 * 智能选择最优Key
 * 策略：余额优先 + 避免连续使用同一个
 */
export function selectBestKey(): KeyInfo {
  // 过滤可用key（余额>=最低阈值）
  const availableKeys = KEY_POOL.filter(k => k.remaining >= MIN_BALANCE_THRESHOLD);
  
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
  const keyInfo = KEY_POOL.find(k => k.key === key);
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
  const keyInfo = KEY_POOL.find(k => k.key === key);
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
  const healthyKeys = KEY_POOL.filter(k => k.remaining >= LOW_BALANCE_THRESHOLD);
  const lowKeys = KEY_POOL.filter(k => k.remaining < LOW_BALANCE_THRESHOLD);
  
  return {
    keys: KEY_POOL,
    totalRemaining: KEY_POOL.reduce((sum, k) => sum + k.remaining, 0),
    healthyCount: healthyKeys.length,
    lowBalanceKeys: lowKeys.map(k => `${k.label}: ${k.remaining}`),
  };
}

/**
 * 获取所有Key（用于需要遍历的场景）
 */
export function getAllKeys(): KeyInfo[] {
  return KEY_POOL;
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