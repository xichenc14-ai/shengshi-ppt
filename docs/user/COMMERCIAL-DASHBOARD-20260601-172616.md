# Commercial Dashboard Latest

- Generated: 2026-06-01T09:26:16.317Z

## Command Status
- env:commercial:assert: FAIL
- env:commercial:doctor: FAIL
- go-live:commercial: FAIL
- release-gate:commercial: FAIL
- audit:objective:commercial: FAIL

## Latest Report Verdicts
- Env Doctor: NOT_READY
- Release Gate: FAIL
- Objective Audit: NOT_READY

## Blockers (from latest command output tails)
- env:commercial:assert:
```text
[ASSERT] 缺失必填变量: PAYMENT_NOTIFY_URL, PAYMENT_NOTIFY_SECRET, ALLOWED_CALLBACK_IPS
```
- env:commercial:doctor:
```text
ALLOWED_CALLBACK_IPS>' | vercel env add ALLOWED_CALLBACK_IPS production
- printf '%s' 'https://pay.example.com/wx?order={orderNo}&amount={amountFen}' | vercel env add PAYMENT_WECHAT_URL_TEMPLATE production
- printf '%s' 'https://pay.example.com/ali?order={orderNo}&amount={amountFen}' | vercel env add PAYMENT_ALIPAY_URL_TEMPLATE production

Next Commands
- npm run -s env:commercial
- npm run -s preflight:commercial
- npm run -s go-live:commercial

Doctor verdict: NOT_READY
Doctor report: docs/user/COMMERCIAL-ENV-DOCTOR-LATEST.md
Doctor archive: docs/user/COMMERCIAL-ENV-DOCTOR-20260601-172614.md
```
- go-live:commercial:
```text
[go-live] Environment readiness

=== Commercial Environment Readiness ===
FAIL  Core variables - missing: PAYMENT_NOTIFY_URL, PAYMENT_NOTIFY_SECRET
FAIL  PAYMENT_NOTIFY_URL is https - value: (empty)
FAIL  WeChat provider ready - missing sdk: WECHAT_PAY_MCH_ID, WECHAT_PAY_APP_ID, WECHAT_PAY_API_V3_KEY
FAIL  Alipay provider ready - missing sdk: ALIPAY_APP_ID, ALIPAY_PRIVATE_KEY, ALIPAY_PUBLIC_KEY

Overall: NOT_READY

[go-live] FAIL at: Environment readiness
```
- release-gate:commercial:
```text
[release-gate] Assert minimal env
[ASSERT] 缺失必填变量: PAYMENT_NOTIFY_URL, PAYMENT_NOTIFY_SECRET, ALLOWED_CALLBACK_IPS
[release-gate] report: docs/user/COMMERCIAL-RELEASE-GATE-LATEST.md
[release-gate] archive: docs/user/COMMERCIAL-RELEASE-GATE-20260601-172615.md

[release-gate] FAIL at: Assert minimal env
```
- audit:objective:commercial:
```text
Objective audit verdict: NOT_READY
Objective audit latest: docs/user/COMMERCIAL-OBJECTIVE-AUDIT-LATEST.md
Objective audit archive: docs/user/COMMERCIAL-OBJECTIVE-AUDIT-20260601-172616.md
Release gate still blocked by external env/config.
```

## Next Actions
1. 注入生产变量（PAYMENT_NOTIFY_URL / PAYMENT_NOTIFY_SECRET / ALLOWED_CALLBACK_IPS）。
2. 配置支付模板或SDK变量（微信+支付宝至少各一条路径）。
3. 重新执行: npm run -s release-gate:commercial
