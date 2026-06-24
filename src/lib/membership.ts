// 会员权限体系 - v10.61（双套餐）

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

  // 兼容历史字段，当前下载不再单独计费
  monthlyFreeDownloads?: number;
  monthlyPptTrial?: number;
  smartTrialUsed?: boolean;       // 新用户省心模式体验标记
  pricePerPage?: number;
}

export interface UserDownloadInfo {
  plan_type: string;
  download_count_month: number;
  ppt_trial_count_month: number;
  download_reset_month: string; // '2026-04'
}

const PLANS: Record<string, MembershipPlan> = {
  free: {
    id: 'free',
    name: '免费',
    emoji: '💚',
    credits: 40,
    maxPages: 8,
    priceMonthly: 0,
    priceAnnual: 0,
    allowedImageSources: ['pictographic', 'pexels', 'themeAccent', 'noImages'],
    allowedAiModels: [],
    smartMode: false,
    monthlyFreeDownloads: -1,
    monthlyPptTrial: -1,
    smartTrialUsed: false,       // 新用户首次省心模式体验（一次）
    pricePerPage: 0,
  },
  // 省心会员：19.9元，500积分
  shengxin: {
    id: 'shengxin',
    name: '省心会员',
    emoji: '💎',
    credits: 500,
    maxPages: 20,
    priceMonthly: 19.9,
    priceAnnual: 199,
    allowedImageSources: ['pictographic', 'pexels', 'themeAccent', 'noImages', 'aiGenerated'],
    allowedAiModels: ['imagen-3-flash'],
    smartMode: true,
    monthlyFreeDownloads: -1,  // 无限制（会员特权）
    monthlyPptTrial: -1,       // 无限制
    pricePerPage: 0,           // 会员免费下载
  },
  // 尊享会员：49.9元，1500积分（解锁高阶AI图与更高页数）
  advanced: {
    id: 'advanced',
    name: '尊享会员',
    emoji: '👑',
    credits: 1500,
    maxPages: 40,
    priceMonthly: 49.9,
    priceAnnual: 499,
    allowedImageSources: ['pictographic', 'pexels', 'themeAccent', 'noImages', 'aiGenerated'],
    allowedAiModels: ['imagen-3-flash', 'imagen-3-pro', 'flux-1-pro', 'ideogram-v3', 'gemini-2.5-flash-image'],
    smartMode: true,
    monthlyFreeDownloads: -1,
    monthlyPptTrial: -1,
    pricePerPage: 0,
  },
  // 兼容旧数据别名（旧 plan_type 自动映射到双套餐）
  basic: { id: 'shengxin', name: '省心会员', emoji: '💎', credits: 500, maxPages: 20, priceMonthly: 19.9, priceAnnual: 199, allowedImageSources: ['pictographic', 'pexels', 'themeAccent', 'noImages', 'aiGenerated'], allowedAiModels: ['imagen-3-flash'], smartMode: true, monthlyFreeDownloads: -1, monthlyPptTrial: -1, pricePerPage: 0 },
  standard: { id: 'advanced', name: '尊享会员', emoji: '👑', credits: 1500, maxPages: 40, priceMonthly: 49.9, priceAnnual: 499, allowedImageSources: ['pictographic', 'pexels', 'themeAccent', 'noImages', 'aiGenerated'], allowedAiModels: ['imagen-3-flash', 'imagen-3-pro', 'flux-1-pro', 'ideogram-v3', 'gemini-2.5-flash-image'], smartMode: true, monthlyFreeDownloads: -1, monthlyPptTrial: -1, pricePerPage: 0 },
  pro: { id: 'advanced', name: '尊享会员', emoji: '👑', credits: 1500, maxPages: 40, priceMonthly: 49.9, priceAnnual: 499, allowedImageSources: ['pictographic', 'pexels', 'themeAccent', 'noImages', 'aiGenerated'], allowedAiModels: ['imagen-3-flash', 'imagen-3-pro', 'flux-1-pro', 'ideogram-v3', 'gemini-2.5-flash-image'], smartMode: true, monthlyFreeDownloads: -1, monthlyPptTrial: -1, pricePerPage: 0 },
  vip: { id: 'advanced', name: '尊享会员', emoji: '👑', credits: 1500, maxPages: 40, priceMonthly: 49.9, priceAnnual: 499, allowedImageSources: ['pictographic', 'pexels', 'themeAccent', 'noImages', 'aiGenerated'], allowedAiModels: ['imagen-3-flash', 'imagen-3-pro', 'flux-1-pro', 'ideogram-v3', 'gemini-2.5-flash-image'], smartMode: true, monthlyFreeDownloads: -1, monthlyPptTrial: -1, pricePerPage: 0 },
  supreme: { id: 'advanced', name: '尊享会员', emoji: '👑', credits: 1500, maxPages: 40, priceMonthly: 49.9, priceAnnual: 499, allowedImageSources: ['pictographic', 'pexels', 'themeAccent', 'noImages', 'aiGenerated'], allowedAiModels: ['imagen-3-flash', 'imagen-3-pro', 'flux-1-pro', 'ideogram-v3', 'gemini-2.5-flash-image'], smartMode: true, monthlyFreeDownloads: -1, monthlyPptTrial: -1, pricePerPage: 0 },
};

export const PLAN_LIST: MembershipPlan[] = [PLANS.free, PLANS.shengxin, PLANS.advanced];

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
    case 'auto':
      return 'themeAccent';
    case 'none':
    case 'noImages':
      return 'noImages';
    case 'theme-img':
    case 'theme':
    case 'themeAccent':
    case 'pictographic':
      return 'themeAccent';
    case 'web':
    case 'pexels':
    case 'webFreeToUseCommercially':
      return 'pexels';
    case 'ai':
    case 'ai-pro':
    case 'aiGenerated':
      return 'aiGenerated';
    default: return 'themeAccent';
  }
}

/**
 * 下载权限检查
 * 当前策略：生成阶段统一按积分结算，生成成功后可直接下载。
 */
export function checkDownloadPermission(user: UserDownloadInfo, pageCount: number, format: 'pptx' | 'pdf'): {
  allowed: boolean;
  needPayment?: boolean;
  cost?: number;
  isFreeDownload?: boolean;
  isTrial?: boolean;
  watermarked?: boolean;
  reason?: string;
} {
  return {
    allowed: true,
    cost: 0,
    isFreeDownload: true,
    watermarked: false,
    reason: `${format.toUpperCase()} 下载已纳入积分结算`,
  };
}
