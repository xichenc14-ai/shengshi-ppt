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

function templateVar(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((acc, [k, v]) => {
    return acc.replaceAll(`{${k}}`, encodeURIComponent(v));
  }, template);
}

function toYuan(amountFen: number): string {
  return (amountFen / 100).toFixed(2);
}

function getProviderTemplate(provider: PaymentProvider): {
  payUrlTemplate?: string;
  qrCodeTemplate?: string;
} {
  if (provider === 'wechat') {
    return {
      payUrlTemplate: process.env.WECHAT_PAY_URL_TEMPLATE || process.env.PAYMENT_WECHAT_URL_TEMPLATE,
      qrCodeTemplate: process.env.WECHAT_QRCODE_URL_TEMPLATE || process.env.PAYMENT_WECHAT_QRCODE_TEMPLATE,
    };
  }
  return {
    payUrlTemplate: process.env.ALIPAY_PAY_URL_TEMPLATE || process.env.PAYMENT_ALIPAY_URL_TEMPLATE,
    qrCodeTemplate: process.env.ALIPAY_QRCODE_URL_TEMPLATE || process.env.PAYMENT_ALIPAY_QRCODE_TEMPLATE,
  };
}

export interface ProviderReadiness {
  provider: PaymentProvider;
  ready: boolean;
  mode: 'template' | 'sdk-env' | 'missing';
  missing: string[];
  hasPayUrlTemplate: boolean;
  hasQrCodeTemplate: boolean;
}

export function inspectProviderReadiness(provider: PaymentProvider): ProviderReadiness {
  const { payUrlTemplate, qrCodeTemplate } = getProviderTemplate(provider);
  if (payUrlTemplate || qrCodeTemplate) {
    return {
      provider,
      ready: true,
      mode: 'template',
      missing: [],
      hasPayUrlTemplate: Boolean(payUrlTemplate),
      hasQrCodeTemplate: Boolean(qrCodeTemplate),
    };
  }

  const missing = missingEnvFor(provider);
  if (missing.length === 0) {
    return {
      provider,
      ready: true,
      mode: 'sdk-env',
      missing,
      hasPayUrlTemplate: false,
      hasQrCodeTemplate: false,
    };
  }
  return {
    provider,
    ready: false,
    mode: 'missing',
    missing,
    hasPayUrlTemplate: false,
    hasQrCodeTemplate: false,
  };
}

function missingEnvFor(provider: PaymentProvider): string[] {
  const { payUrlTemplate, qrCodeTemplate } = getProviderTemplate(provider);
  if (payUrlTemplate || qrCodeTemplate) return [];

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
  const { payUrlTemplate, qrCodeTemplate } = getProviderTemplate(input.provider);
  if (payUrlTemplate || qrCodeTemplate) {
    const vars = {
      provider: input.provider,
      orderNo: input.orderNo,
      amountFen: String(input.amountFen),
      amountYuan: toYuan(input.amountFen),
      subject: input.subject,
      userId: input.userId,
      notifyUrl: input.notifyUrl,
    };

    return {
      provider: input.provider,
      providerOrderId: `${input.provider}_${input.orderNo}`,
      payUrl: payUrlTemplate ? templateVar(payUrlTemplate, vars) : undefined,
      qrCodeUrl: qrCodeTemplate ? templateVar(qrCodeTemplate, vars) : undefined,
      mock: false,
      raw: {
        mode: 'template',
        payUrlTemplate: Boolean(payUrlTemplate),
        qrCodeTemplate: Boolean(qrCodeTemplate),
      },
    };
  }

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
