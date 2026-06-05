# Commercial Env Doctor Report

- Verdict: **NOT_READY**

## === Commercial Env Doctor ===
Core ready: NO
Notify URL https: NO
WeChat ready: NO
Alipay ready: NO

## Fix Core
- export PAYMENT_NOTIFY_URL=<value>
- export PAYMENT_NOTIFY_SECRET=<value>
- export ALLOWED_CALLBACK_IPS=<value>

## Fix Core (Vercel CLI)
- printf '%s' '<PAYMENT_NOTIFY_URL>' | vercel env add PAYMENT_NOTIFY_URL production
- printf '%s' '<PAYMENT_NOTIFY_SECRET>' | vercel env add PAYMENT_NOTIFY_SECRET production
- printf '%s' '<ALLOWED_CALLBACK_IPS>' | vercel env add ALLOWED_CALLBACK_IPS production

## Fix Core (.env.production.local snippet)
PAYMENT_NOTIFY_URL=
PAYMENT_NOTIFY_SECRET=
ALLOWED_CALLBACK_IPS=

## Fix Notify URL
- PAYMENT_NOTIFY_URL must start with https://

## Fix WeChat (choose one path)
- Template path: set PAYMENT_WECHAT_URL_TEMPLATE or PAYMENT_WECHAT_QRCODE_TEMPLATE
- SDK path missing: WECHAT_PAY_MCH_ID, WECHAT_PAY_APP_ID, WECHAT_PAY_API_V3_KEY

## Fix WeChat (Vercel CLI examples)
- printf '%s' 'https://pay.example.com/wx?order={orderNo}&amount={amountFen}' | vercel env add PAYMENT_WECHAT_URL_TEMPLATE production
- printf '%s' 'https://pay.example.com/wx-qr?order={orderNo}' | vercel env add PAYMENT_WECHAT_QRCODE_TEMPLATE production
- printf '%s' '<WECHAT_PAY_MCH_ID>' | vercel env add WECHAT_PAY_MCH_ID production
- printf '%s' '<WECHAT_PAY_APP_ID>' | vercel env add WECHAT_PAY_APP_ID production
- printf '%s' '<WECHAT_PAY_API_V3_KEY>' | vercel env add WECHAT_PAY_API_V3_KEY production

## Fix Alipay (choose one path)
- Template path: set PAYMENT_ALIPAY_URL_TEMPLATE or PAYMENT_ALIPAY_QRCODE_TEMPLATE
- SDK path missing: ALIPAY_APP_ID, ALIPAY_PRIVATE_KEY, ALIPAY_PUBLIC_KEY

## Fix Alipay (Vercel CLI examples)
- printf '%s' 'https://pay.example.com/ali?order={orderNo}&amount={amountFen}' | vercel env add PAYMENT_ALIPAY_URL_TEMPLATE production
- printf '%s' 'https://pay.example.com/ali-qr?order={orderNo}' | vercel env add PAYMENT_ALIPAY_QRCODE_TEMPLATE production
- printf '%s' '<ALIPAY_APP_ID>' | vercel env add ALIPAY_APP_ID production
- printf '%s' '<ALIPAY_PRIVATE_KEY>' | vercel env add ALIPAY_PRIVATE_KEY production
- printf '%s' '<ALIPAY_PUBLIC_KEY>' | vercel env add ALIPAY_PUBLIC_KEY production

## Minimal Go-Live Path (Template mode)
- Fastest production path: fill core + one WeChat template + one Alipay template
- Missing for minimal path: PAYMENT_NOTIFY_URL, PAYMENT_NOTIFY_SECRET, ALLOWED_CALLBACK_IPS, PAYMENT_WECHAT_URL_TEMPLATE, PAYMENT_ALIPAY_URL_TEMPLATE

## Minimal Path (Vercel CLI)
- printf '%s' '<PAYMENT_NOTIFY_URL>' | vercel env add PAYMENT_NOTIFY_URL production
- printf '%s' '<PAYMENT_NOTIFY_SECRET>' | vercel env add PAYMENT_NOTIFY_SECRET production
- printf '%s' '<ALLOWED_CALLBACK_IPS>' | vercel env add ALLOWED_CALLBACK_IPS production
- printf '%s' 'https://pay.example.com/wx?order={orderNo}&amount={amountFen}' | vercel env add PAYMENT_WECHAT_URL_TEMPLATE production
- printf '%s' 'https://pay.example.com/ali?order={orderNo}&amount={amountFen}' | vercel env add PAYMENT_ALIPAY_URL_TEMPLATE production

## Next Commands
- npm run -s env:commercial
- npm run -s preflight:commercial
- npm run -s go-live:commercial
