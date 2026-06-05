export function isPaymentFeatureEnabledClient(): boolean {
  return process.env.NEXT_PUBLIC_PAYMENT_FEATURE_ENABLED === 'true';
}

export function isPaymentFeatureEnabledServer(): boolean {
  return process.env.PAYMENT_FEATURE_ENABLED === 'true'
    || process.env.NEXT_PUBLIC_PAYMENT_FEATURE_ENABLED === 'true';
}
