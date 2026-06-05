export type PaymentProvider = 'wechat' | 'alipay';

export interface CreateOrderInput {
  provider: PaymentProvider;
  orderNo: string;
  amountFen: number;
  subject: string;
  userId: string;
  notifyUrl: string;
}

export interface ProviderOrderIntent {
  provider: PaymentProvider;
  providerOrderId: string;
  payUrl?: string;
  qrCodeUrl?: string;
  raw?: Record<string, unknown>;
  mock: boolean;
}

function missingEnvFor(provider: PaymentProvider): string[] {
  if (provider === 'wechat') {
    const required = ['WECHAT_PAY_MCH_ID', 'WECHAT_PAY_APP_ID', 'WECHAT_PAY_API_V3_KEY'];
    return required.filter(k => !process.env[k]);
  }
  const required = ['ALIPAY_APP_ID', 'ALIPAY_PRIVATE_KEY', 'ALIPAY_PUBLIC_KEY'];
  return required.filter(k => !process.env[k]);
}

/**
 * 创建第三方支付下单意图
 * - 当前仅封装接口层，真实参数由后续配置补齐
 * - 未配置时自动回落 mock，避免阻塞联调
 */
export async function createProviderOrderIntent(input: CreateOrderInput): Promise<ProviderOrderIntent> {
  const missing = missingEnvFor(input.provider);
  if (missing.length > 0) {
    return {
      provider: input.provider,
      providerOrderId: `mock_${input.orderNo}`,
      payUrl: undefined,
      qrCodeUrl: undefined,
      mock: true,
      raw: { reason: 'missing_env', missing },
    };
  }

  // TODO: 接入真实 SDK / 官方网关请求
  // 这里保留标准化返回结构，避免上层业务逻辑未来重写
  return {
    provider: input.provider,
    providerOrderId: `todo_${input.orderNo}`,
    payUrl: undefined,
    qrCodeUrl: undefined,
    mock: true,
    raw: { reason: 'provider_not_implemented_yet' },
  };
}
