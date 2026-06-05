#!/usr/bin/env bash
set -euo pipefail

# 用法：
# 1) 复制本文件为 ops/vercel-env-minimal.sh
# 2) 填写下面变量（不要保留占位值）
# 3) 执行：bash ops/vercel-env-minimal.sh

ENV_TARGET="production"

NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="replace_with_service_role_key"
SESSION_PASSWORD="replace_with_32_plus_chars"
PAYMENT_NOTIFY_URL="https://your-domain.com/api/payment"
PAYMENT_NOTIFY_SECRET="replace_with_long_random_secret"
ALLOWED_CALLBACK_IPS="1.2.3.4,5.6.7."

# 最小上线路径（Template模式）
PAYMENT_WECHAT_URL_TEMPLATE="https://pay.example.com/wx?order={orderNo}&amount={amountFen}"
PAYMENT_ALIPAY_URL_TEMPLATE="https://pay.example.com/ali?order={orderNo}&amount={amountFen}"

required=(
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  SESSION_PASSWORD
  PAYMENT_NOTIFY_URL
  PAYMENT_NOTIFY_SECRET
  ALLOWED_CALLBACK_IPS
  PAYMENT_WECHAT_URL_TEMPLATE
  PAYMENT_ALIPAY_URL_TEMPLATE
)

for k in "${required[@]}"; do
  v="${!k:-}"
  if [[ -z "$v" || "$v" == replace_with_* || "$v" == https://your-* || "$v" == 1.2.3.4,5.6.7. ]]; then
    echo "[ERROR] $k 未正确填写: $v"
    exit 1
  fi
done

if [[ ! "$PAYMENT_NOTIFY_URL" =~ ^https:// ]]; then
  echo "[ERROR] PAYMENT_NOTIFY_URL 必须以 https:// 开头"
  exit 1
fi

add_env() {
  local key="$1"
  local val="$2"
  printf '%s' "$val" | vercel env add "$key" "$ENV_TARGET"
}

echo "[INFO] 注入 Vercel 环境变量到 $ENV_TARGET"
add_env NEXT_PUBLIC_SUPABASE_URL "$NEXT_PUBLIC_SUPABASE_URL"
add_env SUPABASE_SERVICE_ROLE_KEY "$SUPABASE_SERVICE_ROLE_KEY"
add_env SESSION_PASSWORD "$SESSION_PASSWORD"
add_env PAYMENT_NOTIFY_URL "$PAYMENT_NOTIFY_URL"
add_env PAYMENT_NOTIFY_SECRET "$PAYMENT_NOTIFY_SECRET"
add_env ALLOWED_CALLBACK_IPS "$ALLOWED_CALLBACK_IPS"
add_env PAYMENT_WECHAT_URL_TEMPLATE "$PAYMENT_WECHAT_URL_TEMPLATE"
add_env PAYMENT_ALIPAY_URL_TEMPLATE "$PAYMENT_ALIPAY_URL_TEMPLATE"

echo "[OK] 注入完成。请执行："
echo "  npm run -s env:commercial:doctor"
echo "  npm run -s go-live:commercial"
