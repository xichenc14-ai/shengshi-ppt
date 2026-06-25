/**
 * 积分常量定义 - v10.15
 */

// 每页PPT消耗的积分
export const CREDIT_PER_PAGE = 3;

// AI生成图片每张消耗的积分
export const IMG_CREDIT_PER_PAGE = 3;

// 默认积分余额
export const DEFAULT_FREE_CREDITS = 40;

// 会员积分上限
export const MEMBER_CREDITS_LIMIT = {
  shengxin: 500,    // 省心会员
  advanced: 1500,   // 尊享会员
  supreme: 1500,    // 兼容旧字段
};

// 积分充值价格（元/积分）
export const CREDIT_PRICE = {
  perCredit: 0.1,   // 每积分0.1元
  minPurchase: 100, // 最小充值100积分
};
