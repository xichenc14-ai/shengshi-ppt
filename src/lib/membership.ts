// 会员权限体系
// 按纯净模式（免费图/noImages）计算参考数据

export interface MembershipPlan {
  id: string;
  name: string;
  emoji: string;
  credits: number;      // 每月积分
  maxPages: number;     // 单次最大页数
  priceMonthly: number; // 月付价格
  priceAnnual: number;  // 年付价格

  // 图片权限（source 级别控制）
  allowedImageSources: string[];  // 允许的 imageSource 值
  allowedAiModels: string[];      // 允许的 AI 生图模型

  // 省心定制（preserve模式）权限
  smartMode: boolean;             // 是否可用省心定制
}

const PLANS: Record<string, MembershipPlan> = {
  free: {
    id: 'free',
    name: '免费体验',
    emoji: '💚',
    credits: 50,
    maxPages: 8,
    priceMonthly: 0,
    priceAnnual: 0,
    allowedImageSources: ['noImages', 'pictographic'],
    allowedAiModels: [],
    smartMode: false,
  },
  basic: {
    id: 'basic',
    name: '普通会员',
    emoji: '💎',
    credits: 500,
    maxPages: 20,
    priceMonthly: 29.9,
    priceAnnual: 299,
    allowedImageSources: ['noImages', 'pictographic', 'pexels', 'webFreeToUseCommercially'],
    allowedAiModels: ['imagen-3-flash'],
    smartMode: true, // 1次免费体验后需付费
  },
  pro: {
    id: 'pro',
    name: '高级会员',
    emoji: '👑',
    credits: 1000,
    maxPages: 40,
    priceMonthly: 49.9,
    priceAnnual: 499,
    allowedImageSources: ['noImages', 'pictographic', 'pexels', 'webFreeToUseCommercially', 'aiGenerated'],
    allowedAiModels: ['imagen-3-flash', 'flux-kontext-fast'],
    smartMode: true,
  },
  vip: {
    id: 'vip',
    name: '尊享会员',
    emoji: '🏆',
    credits: 2000,
    maxPages: 60,
    priceMonthly: 99.9,
    priceAnnual: 999,
    allowedImageSources: ['noImages', 'pictographic', 'pexels', 'webFreeToUseCommercially', 'aiGenerated'],
    allowedAiModels: ['imagen-3-flash', 'flux-kontext-fast', 'imagen-3-pro'],
    smartMode: true,
  },
};

export const PLAN_LIST = Object.values(PLANS);

export function getPlan(planType: string): MembershipPlan {
  return PLANS[planType] || PLANS.free;
}

/**
 * 检查用户是否有权限执行某操作
 * 返回 { allowed, reason? } 
 */
export function checkPermission(planType: string, opts: {
  numPages: number;
  imageSource: string;
  aiModel?: string;
  mode?: 'direct' | 'smart';  // 生成模式
  smartTrialUsed?: boolean;     // 省心定制是否已用完免费体验
}): { allowed: boolean; reason?: string; requiredPlan?: string } {
  const plan = getPlan(planType);

  // 1. 页数检查
  if (opts.numPages > plan.maxPages) {
    // 找到满足页数要求的最低套餐
    const required = PLAN_LIST.find(p => p.maxPages >= opts.numPages);
    return {
      allowed: false,
      reason: `当前套餐最多支持${plan.maxPages}页，您选择了${opts.numPages}页`,
      requiredPlan: required?.id,
    };
  }

  // 2. 图片权限检查
  if (opts.imageSource === 'aiGenerated') {
    const model = opts.aiModel || 'imagen-3-flash';
    if (!plan.allowedAiModels.includes(model)) {
      // 找到支持该模型的最低套餐
      const required = PLAN_LIST.find(p => p.allowedAiModels.includes(model));
      return {
        allowed: false,
        reason: `当前套餐不支持该AI生图模型，请升级`,
        requiredPlan: required?.id,
      };
    }
  } else if (!plan.allowedImageSources.includes(opts.imageSource)) {
    // 图片源不在允许列表
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
 * 计算参考数据：每档套餐能生成多少份10页PPT（纯净模式）
 */
export function calcReferenceData() {
  return PLAN_LIST.map(plan => {
    const creditsPerPpt = 10; // 10页 × 1积分/页（纯净模式，图片0积分）
    const pptCount = Math.floor(plan.credits / creditsPerPpt);
    const costPerPage = plan.priceMonthly > 0 ? (plan.priceMonthly / (plan.credits)).toFixed(2) : '0.00';
    return {
      ...plan,
      pptCount10Pages: pptCount,
      costPerPage: plan.priceMonthly > 0 ? `¥${costPerPage}` : '免费',
    };
  });
}

/**
 * 获取页数上限对应的最低套餐
 */
export function getMinPlanForPages(numPages: number): MembershipPlan | null {
  return PLAN_LIST.find(p => p.maxPages >= numPages) || null;
}

/**
 * 获取图片方案对应的最低套餐
 */
export function getMinPlanForImage(imageSource: string, aiModel?: string): MembershipPlan | null {
  if (imageSource === 'aiGenerated' && aiModel) {
    return PLAN_LIST.find(p => p.allowedAiModels.includes(aiModel)) || null;
  }
  if (imageSource === 'aiGenerated') {
    return PLAN_LIST.find(p => p.allowedAiModels.length > 0) || null;
  }
  return PLAN_LIST.find(p => p.allowedImageSources.includes(imageSource)) || null;
}

/**
 * 将前端图片模式映射到 imageSource
 */
export function mapImgModeToSource(imgMode: string): string {
  switch (imgMode) {
    case 'none': return 'noImages';
    case 'theme': return 'pictographic';      // 免费套图
    case 'web': return 'webFreeToUseCommercially';
    case 'ai': return 'aiGenerated';           // AI定制图(普通)
    case 'ai-pro': return 'aiGenerated';       // AI尊享图(高级)
    default: return 'noImages';
  }
}
