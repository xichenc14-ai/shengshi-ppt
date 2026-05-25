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

  // 🆕 兮晨哥哥2026-04-15方案：免费用户下载配额
  monthlyFreeDownloads?: number;  // 旧 PDF 下载额度字段，保留兼容历史数据
  monthlyPptTrial?: number;       // 每月原生PPT体验次数
  smartTrialUsed?: boolean;       // 新用户省心模式体验标记
  pricePerPage?: number;          // 超出后按页付费（¥0.2/页）
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
    credits: 50,
    maxPages: 8,
    priceMonthly: 0,
    priceAnnual: 0,
    allowedImageSources: ['pictographic', 'webFreeToUseCommercially', 'themeAccent'],
    allowedAiModels: [],
    smartMode: false,
    // 🆕 兮晨哥哥2026-04-15方案
    monthlyFreeDownloads: 3,     // 历史 PDF 下载额度，当前下载入口已关闭 PDF
    monthlyPptTrial: 1,          // 每月1次体验原生PPT
    smartTrialUsed: false,       // 新用户首次省心模式体验（一次）
  },
  // 省心会员：19.9元，400积分（按 400积分≈10元成本基准保留安全毛利）
  shengxin: {
    id: 'shengxin',
    name: '省心会员',
    emoji: '✨',
    credits: 400,
    maxPages: 20,
    priceMonthly: 19.9,
    priceAnnual: 199,
    allowedImageSources: ['pictographic', 'webFreeToUseCommercially', 'themeAccent', 'aiGenerated'],
    allowedAiModels: ['imagen-3-flash'],
    smartMode: true,
    monthlyFreeDownloads: -1,  // 无限制（会员特权）
    monthlyPptTrial: -1,       // 无限制
    pricePerPage: 0,           // 会员免费下载
  },
  // 高级会员：39.9元，1000积分（解锁高阶AI图与更高页数）
  advanced: {
    id: 'advanced',
    name: '高级会员',
    emoji: '👑',
    credits: 1000,
    maxPages: 40,
    priceMonthly: 39.9,
    priceAnnual: 399,
    allowedImageSources: ['pictographic', 'webFreeToUseCommercially', 'themeAccent', 'aiGenerated'],
    allowedAiModels: ['imagen-3-flash', 'imagen-3-pro', 'flux-1-pro', 'ideogram-v3', 'gemini-2.5-flash-image'],
    smartMode: true,
    monthlyFreeDownloads: -1,
    monthlyPptTrial: -1,
    pricePerPage: 0,
  },
  // 兼容旧数据别名（旧 plan_type 自动映射到双套餐）
  basic: { id: 'shengxin', name: '省心会员', emoji: '✨', credits: 400, maxPages: 20, priceMonthly: 19.9, priceAnnual: 199, allowedImageSources: ['pictographic', 'webFreeToUseCommercially', 'themeAccent', 'aiGenerated'], allowedAiModels: ['imagen-3-flash'], smartMode: true, monthlyFreeDownloads: -1, monthlyPptTrial: -1, pricePerPage: 0 },
  standard: { id: 'advanced', name: '高级会员', emoji: '👑', credits: 1000, maxPages: 40, priceMonthly: 39.9, priceAnnual: 399, allowedImageSources: ['pictographic', 'webFreeToUseCommercially', 'themeAccent', 'aiGenerated'], allowedAiModels: ['imagen-3-flash', 'imagen-3-pro', 'flux-1-pro', 'ideogram-v3', 'gemini-2.5-flash-image'], smartMode: true, monthlyFreeDownloads: -1, monthlyPptTrial: -1, pricePerPage: 0 },
  pro: { id: 'advanced', name: '高级会员', emoji: '👑', credits: 1000, maxPages: 40, priceMonthly: 39.9, priceAnnual: 399, allowedImageSources: ['pictographic', 'webFreeToUseCommercially', 'themeAccent', 'aiGenerated'], allowedAiModels: ['imagen-3-flash', 'imagen-3-pro', 'flux-1-pro', 'ideogram-v3', 'gemini-2.5-flash-image'], smartMode: true, monthlyFreeDownloads: -1, monthlyPptTrial: -1, pricePerPage: 0 },
  vip: { id: 'advanced', name: '高级会员', emoji: '👑', credits: 1000, maxPages: 40, priceMonthly: 39.9, priceAnnual: 399, allowedImageSources: ['pictographic', 'webFreeToUseCommercially', 'themeAccent', 'aiGenerated'], allowedAiModels: ['imagen-3-flash', 'imagen-3-pro', 'flux-1-pro', 'ideogram-v3', 'gemini-2.5-flash-image'], smartMode: true, monthlyFreeDownloads: -1, monthlyPptTrial: -1, pricePerPage: 0 },
  supreme: { id: 'advanced', name: '高级会员', emoji: '👑', credits: 1000, maxPages: 40, priceMonthly: 39.9, priceAnnual: 399, allowedImageSources: ['pictographic', 'webFreeToUseCommercially', 'themeAccent', 'aiGenerated'], allowedAiModels: ['imagen-3-flash', 'imagen-3-pro', 'flux-1-pro', 'ideogram-v3', 'gemini-2.5-flash-image'], smartMode: true, monthlyFreeDownloads: -1, monthlyPptTrial: -1, pricePerPage: 0 },
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
      return 'themeAccent';
    case 'theme-img':
    case 'theme':
    case 'themeAccent':
    case 'pictographic':
      return 'themeAccent';
    case 'web':
    case 'webFreeToUseCommercially':
      return 'webFreeToUseCommercially';
    case 'ai':
    case 'ai-pro':
    case 'aiGenerated':
      return 'aiGenerated';
    default: return 'themeAccent';
  }
}

/**
 * 🆕 兮晨哥哥2026-04-15方案：下载权限检查
 * 免费用户：每月1次体验原生PPT
 * 超出后按页数付费（¥0.2/页）
 * 付费会员：无限制免费下载
 */
export function checkDownloadPermission(user: UserDownloadInfo, pageCount: number, format: 'pptx'): {
  allowed: boolean;
  needPayment?: boolean;
  cost?: number;
  isFreeDownload?: boolean;
  isTrial?: boolean;
  watermarked?: boolean;
  reason?: string;
} {
  const plan = getPlan(user.plan_type || 'free');

  // 1. 付费会员 → 无限制免费下载
  if (user.plan_type !== 'free' && plan.pricePerPage === 0) {
    return { allowed: true, cost: 0, isFreeDownload: true };
  }

  // 2. 免费用户 → 检查月度配额
  const currentMonth = new Date().toISOString().substring(0, 7); // '2026-04'
  const monthlyPptTrial = plan.monthlyPptTrial || 1;

  // 检查是否需要月度重置
  if (user.download_reset_month !== currentMonth) {
    // 月度重置：自动获得新的免费配额
    return {
      allowed: true,
      isFreeDownload: true,
      isTrial: true,
      watermarked: false,
    }; // 需要在 API 层更新 download_reset_month
  }

  // 3. PPTX下载：每月1次体验
  if (format === 'pptx' && user.ppt_trial_count_month < monthlyPptTrial) {
    return {
      allowed: true,
      cost: 0,
      isTrial: true,
      reason: `本月体验第${user.ppt_trial_count_month + 1}/${monthlyPptTrial}次（原生PPT）`,
    }; // 需要在 API 层更新 ppt_trial_count_month
  }

  // 4. 超出配额 → 按页数付费
  const pricePerPage = 0.2; // ¥0.2/页
  const cost = pageCount * pricePerPage;
  return {
    allowed: true,
    needPayment: true,
    cost,
    reason: `超出免费配额，需付费 ¥${cost.toFixed(2)}（${pageCount}页 × ¥0.2）`,
  }; // 需要在 API 层处理支付
}
