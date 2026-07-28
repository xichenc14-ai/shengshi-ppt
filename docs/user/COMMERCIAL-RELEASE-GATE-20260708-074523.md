# Commercial Release Gate Report

- Verdict: **FAIL**
- Timestamp: 2026-07-07T23:45:23.406Z
- Failed Step: Assert minimal env

## Step Logs
- Assert minimal env: FAIL

## Failure Output (tail)
```text
[ASSERT] 缺失必填变量: PAYMENT_NOTIFY_SECRET, ALLOWED_CALLBACK_IPS
```

## Next Actions
- npm run -s env:commercial:doctor
- npm run -s env:commercial:assert
- npm run -s go-live:commercial
