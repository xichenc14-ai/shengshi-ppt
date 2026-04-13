// 会员权限体系 - 按兮晨哥哥2026-04-13制定的扣费表

export interface MembershipPlan {
  id: string;
  name: string;
  emoji: string;
  credits: number;
  maxPages: number;
  priceMonthly: number;
  priceAnnual: number;

  // 图片权限（source 级别控制）
  allowedImageSources: string[];
  allowedAiModels: string[];

  // 省心定制（preserve模式）权限
  smartMode: boolean;
}

const PLANS: Record<string, MembershipPlan> = {
  free: {
    id: 'free',
    name: '免费',
    emoji: '💚',
    credits: 50,
    maxPages: 8,
    priceMonthly: 0,
    priceAnnual: 0,
    allowedImageSources: ['noImages', 'pictographic'],
    allowedAiModels: [],
    smartMode: false,
  },
  // 省心会员：9.9元，300积分，省心模式+AI图+20页
  shengxin: {
    id: 'shengxin',
    name: '省心会员',
    emoji: '✨',
    credits: 300,
    maxPages: 20,
    priceMonthly: 9.9,
    priceAnnual: 99,
    allowedImageSources: ['noImages', 'pictographic', 'webFreeToUseCommercially', 'themeAccent', 'aiGenerated'],
    allowedAiModels: ['imagen-3-flash'], // AI普通图(2积分/图)
    smartMode: true,
  },
  // 高级会员：29.9元，1000积分，高级图+40页
  advanced: {
    id: 'advanced',
    name: '高级会员',
    emoji: '👑',
    credits: 1000,
    maxPages: 40,
    priceMonthly: 29.9,
    priceAnnual: 299,
    allowedImageSources: ['noImages', 'pictographic', 'webFreeToUseCommercially', 'themeAccent', 'aiGenerated'],
    allowedAiModels: ['imagen-3-flash', 'imagen-3-pro'], // AI普通图+高级图
    smartMode: true,
  },
  // 尊享会员：49.9元，2000积分，全开+60页
  supreme: {
    id: 'supreme',
    name: '尊享会员',
    emoji: '🏆',
    credits: 2000,
    maxPages: 60,
    priceMonthly: 49.9,
    priceAnnual: 499,
    allowedImageSources: ['noImages', 'pictographic', 'webFreeToUseCommercially', 'themeAccent', 'aiGenerated'],
    allowedAiModels: ['imagen-3-flash', 'imagen-3-pro'],
    smartMode: true,
  },
  // 兼容旧数据别名
  basic: { id: 'shengxin', name: '基础', emoji: '💎', credits: 300, maxPages: 20, priceMonthly: 9.9, priceAnnual: 99, allowedImageSources: ['noImages', 'pictographic', 'webFreeToUseCommercially', 'themeAccent', 'aiGenerated'], allowedAiModels: ['imagen-3-flash'], smartMode: true },
  standard: { id: 'advanced', name: '标准', emoji: '👑', credits: 1000, maxPages: 40, priceMonthly: 29.9, priceAnnual: 299, allowedImageSources: ['noImages', 'pictographic', 'webFreeToUseCommercially', 'themeAccent', 'aiGenerated'], allowedAiModels: ['imagen-3-flash', 'imagen-3-pro'], smartMode: true },
  pro: { id: 'supreme', name: '高级', emoji: '🏆', credits: 2000, maxPages: 60, priceMonthly: 49.9, priceAnnual: 499, allowedImageSources: ['noImages', 'pictographic', 'webFreeToUseCommercially', 'themeAccent', 'aiGenerated'], allowedAiModels: ['imagen-3-flash', 'imagen-3-pro'], smartMode: true },
  vip: { id: 'supreme', name: '尊享', emoji: '🏆', credits: 2000, maxPages: 60, priceMonthly: 49.9, priceAnnual: 499, allowedImageSources: ['noImages', 'pictographic', 'webFreeToUseCommercially', 'themeAccent', 'aiGenerated'], allowedAiModels: ['imagen-3-flash', 'imagen-3-pro'], smartMode: true },
};

export const PLAN_LIST = Object.values(PLANS);

export function getPlan(planType: string): MembershipPlan {
  return PLANS[planType] || PLANS.free;
}

/**
 * 检查用户是否有权限执行某操作
 */
export function checkPermission(planType: string, opts: {
  numPages: number;
  imageSource: string;
  aiModel?: string;
  mode?: 'direct' | 'smart';
}): { allowed: boolean; reason?: string; requiredPlan?: string } {
  const plan = getPlan(planType);

  // 1. 页数检查
  if (opts.numPages > plan.maxPages) {
    const required = PLAN_LIST.find(p => p.maxPages >= opts.numPages);
    return {
      allowed: false,
      reason: `当前套餐最多${plan.maxPages}页，您选择了${opts.numPages}页`,
      requiredPlan: required?.id,
    };
  }

  // 2. 图片权限检查
  if (opts.imageSource === 'aiGenerated') {
    const model = opts.aiModel || 'imagen-3-flash';
    if (!plan.allowedAiModels.includes(model)) {
      const required = PLAN_LIST.find(p => p.allowedAiModels.includes(model));
      return {
        allowed: false,
        reason: `当前套餐不支持该AI生图模型`,
        requiredPlan: required?.id,
      };
    }
  } else if (!plan.allowedImageSources.includes(opts.imageSource)) {
    const required = PLAN_LIST.find(p => p.allowedImageSources.includes(opts.imageSource));
    return {
      allowed: false,
      reason: `当前套餐不支持该图片方案`,
      requiredPlan: required?.id,
    };
  }

  // 3. 省心定制权限检查
  if (opts.mode === 'smart' && !plan.smartMode) {
    return {
      allowed: false,
      reason: '省心定制为会员专属功能',
      requiredPlan: 'basic',
    };
  }

  return { allowed: true };
}

/**
 * 将前端图片模式映射到 imageSource
 */
export function mapImgModeToSource(imgMode: string): string {
  switch (imgMode) {
    case 'none': return 'noImages';
    case 'theme': return 'pictographic';      // 免费套图
    case 'web': return 'webFreeToUseCommercially';
    case 'ai': return 'aiGenerated';           // AI普通图(2积分)
    case 'ai-pro': return 'aiGenerated';       // AI高级图(5积分)
    default: return 'noImages';
  }
}