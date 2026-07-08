export const paymentTemplateEnv = {
  wechat: ['PAYMENT_WECHAT_URL_TEMPLATE', 'PAYMENT_WECHAT_QRCODE_TEMPLATE', 'WECHAT_PAY_URL_TEMPLATE', 'WECHAT_QRCODE_URL_TEMPLATE'],
  alipay: ['PAYMENT_ALIPAY_URL_TEMPLATE', 'PAYMENT_ALIPAY_QRCODE_TEMPLATE', 'ALIPAY_PAY_URL_TEMPLATE', 'ALIPAY_QRCODE_URL_TEMPLATE'],
};

const paymentSdkEnv = {
  wechat: ['WECHAT_PAY_MCH_ID', 'WECHAT_PAY_APP_ID', 'WECHAT_PAY_API_V3_KEY'],
  alipay: ['ALIPAY_APP_ID', 'ALIPAY_PRIVATE_KEY', 'ALIPAY_PUBLIC_KEY'],
};

const xunhuEnv = ['XUNHU_PAY_APPID', 'XUNHU_PAY_SECRET'];

export function parseSupportedPaymentMethods() {
  const raw = process.env.PAYMENT_SUPPORTED_METHODS || process.env.NEXT_PUBLIC_PAYMENT_SUPPORTED_METHODS || 'wechat';
  const methods = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value === 'wechat' || value === 'alipay');
  return methods.length > 0 ? [...new Set(methods)] : ['wechat'];
}

export function hasAnyEnv(keys) {
  return keys.some((key) => Boolean(process.env[key]));
}

export function missingEnv(keys) {
  return keys.filter((key) => !process.env[key]);
}

export function allPresentEnv(keys) {
  return missingEnv(keys).length === 0;
}

export function inspectPaymentProvider(provider) {
  const templateReady = hasAnyEnv(paymentTemplateEnv[provider] || []);
  const sdkMissing = missingEnv(paymentSdkEnv[provider] || []);
  const sdkReady = sdkMissing.length === 0;

  if (provider === 'wechat') {
    const xunhuMissing = missingEnv(xunhuEnv);
    const xunhuReady = xunhuMissing.length === 0;
    const ready = templateReady || xunhuReady || sdkReady;
    return {
      provider,
      ready,
      mode: templateReady ? 'template' : (xunhuReady ? 'xunhu' : (sdkReady ? 'sdk-env' : 'missing')),
      missing: ready ? [] : [...xunhuMissing, ...sdkMissing],
    };
  }

  const ready = templateReady || sdkReady;
  return {
    provider,
    ready,
    mode: templateReady ? 'template' : (sdkReady ? 'sdk-env' : 'missing'),
    missing: ready ? [] : sdkMissing,
  };
}

export function inspectEnabledPaymentProviders() {
  return parseSupportedPaymentMethods().map((provider) => inspectPaymentProvider(provider));
}

export function getTemplateUrlProblems() {
  const templateUrlKeys = [
    'PAYMENT_WECHAT_URL_TEMPLATE',
    'WECHAT_PAY_URL_TEMPLATE',
    'PAYMENT_ALIPAY_URL_TEMPLATE',
    'ALIPAY_PAY_URL_TEMPLATE',
  ];
  return templateUrlKeys
    .map((key) => ({ key, value: process.env[key] || '' }))
    .filter(({ value }) => value && !/^https:\/\//i.test(value));
}
