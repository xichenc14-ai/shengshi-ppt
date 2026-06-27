import { createXunhuOrder, getXunhuConfig } from '@/lib/payment/xunhu';

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
  mode: 'template' | 'xunhu' | 'sdk-env' | 'missing' | 'unsupported';
  missing: string[];
  hasPayUrlTemplate: boolean;
  hasQrCodeTemplate: boolean;
}

export function getSupportedPaymentMethods(): PaymentProvider[] {
  const raw = process.env.PAYMENT_SUPPORTED_METHODS || process.env.NEXT_PUBLIC_PAYMENT_SUPPORTED_METHODS || 'wechat';
  const methods = raw
    .split(',')
    .map((v) => v.trim())
    .filter((v): v is PaymentProvider => v === 'wechat' || v === 'alipay');
  return methods.length > 0 ? methods : ['wechat'];
}

export function inspectProviderReadiness(provider: PaymentProvider): ProviderReadiness {
  if (!getSupportedPaymentMethods().includes(provider)) {
    return {
      provider,
      ready: true,
      mode: 'unsupported',
      missing: [],
      hasPayUrlTemplate: false,
      hasQrCodeTemplate: false,
    };
  }

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

  if (provider === 'wechat') {
    const missing = ['XUNHU_PAY_APPID', 'XUNHU_PAY_SECRET'].filter(k => !process.env[k]);
    return {
      provider,
      ready: missing.length === 0,
      mode: missing.length === 0 ? 'xunhu' : 'missing',
      missing,
      hasPayUrlTemplate: false,
      hasQrCodeTemplate: false,
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

  if (provider === 'wechat') return ['XUNHU_PAY_APPID', 'XUNHU_PAY_SECRET'].filter(k => !process.env[k]);
  const required = ['ALIPAY_APP_ID', 'ALIPAY_PRIVATE_KEY', 'ALIPAY_PUBLIC_KEY'];
  return required.filter(k => !process.env[k]);
}

/**
 * 创建第三方支付下单意图
 * - 当前仅封装接口层，真实参数由后续配置补齐
 * - 未配置时自动回落 mock，避免阻塞联调
 */
export async function createProviderOrderIntent(input: CreateOrderInput): Promise<ProviderOrderIntent> {
  if (!getSupportedPaymentMethods().includes(input.provider)) {
    return {
      provider: input.provider,
      providerOrderId: `unsupported_${input.orderNo}`,
      mock: true,
      raw: { reason: 'payment_method_unsupported' },
    };
  }

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

  if (input.provider === 'wechat' && getXunhuConfig()) {
    const xunhu = await createXunhuOrder({
      orderNo: input.orderNo,
      amountFen: input.amountFen,
      title: input.subject,
      notifyUrl: input.notifyUrl,
      returnUrl: process.env.PAYMENT_RETURN_URL,
      callbackUrl: process.env.PAYMENT_CALLBACK_URL,
      attach: JSON.stringify({ userId: input.userId, provider: input.provider }),
    });
    return {
      provider: input.provider,
      providerOrderId: xunhu.openOrderId,
      payUrl: xunhu.payUrl,
      qrCodeUrl: xunhu.qrCodeUrl,
      mock: false,
      raw: {
        mode: 'xunhu',
        openOrderId: xunhu.openOrderId,
        response: xunhu.raw,
      },
    };
  }

  return {
    provider: input.provider,
    providerOrderId: `unsupported_${input.orderNo}`,
    payUrl: undefined,
    qrCodeUrl: undefined,
    mock: true,
    raw: { reason: 'provider_not_configured' },
  };
}
