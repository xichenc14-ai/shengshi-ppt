import { APP_VERSION } from '@/lib/version';

export type ObservabilityLevel = 'info' | 'warn' | 'error';

export type ObservabilityContext = {
  requestId?: string;
  taskId?: string;
  orderNo?: string;
  userId?: string;
  route?: string;
  durationMs?: number;
  status?: number;
  metadata?: Record<string, unknown>;
};

const SECRET_KEY_PATTERN = /(authorization|cookie|password|secret|token|api[_-]?key|signature|code|phone)/i;
const MAX_METADATA_DEPTH = 3;

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_METADATA_DEPTH) return '[truncated]';
  if (typeof value === 'string') return value.slice(0, 500);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 40).map(([key, item]) => (
      [key, SECRET_KEY_PATTERN.test(key) ? '[redacted]' : sanitizeValue(item, depth + 1)]
    )));
  }
  return String(value).slice(0, 500);
}

function safeUserId(userId?: string): string | undefined {
  if (!userId) return undefined;
  return userId.length <= 12 ? userId : `${userId.slice(0, 8)}…${userId.slice(-4)}`;
}

export function getRequestId(request: Request): string {
  const value = request.headers.get('x-request-id')?.trim() || '';
  return /^[a-zA-Z0-9._:-]{8,128}$/.test(value) ? value : crypto.randomUUID();
}

export function logOperationalEvent(
  level: ObservabilityLevel,
  event: string,
  context: ObservabilityContext = {},
): void {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service: 'shengxin-ppt',
    version: APP_VERSION,
    event: event.slice(0, 120),
    requestId: context.requestId,
    taskId: context.taskId,
    orderNo: context.orderNo,
    userId: safeUserId(context.userId),
    route: context.route,
    durationMs: context.durationMs,
    status: context.status,
    metadata: context.metadata ? sanitizeValue(context.metadata) : undefined,
  };
  const line = JSON.stringify(payload);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export async function sendOperationalAlert(
  event: string,
  context: ObservabilityContext = {},
): Promise<{ sent: boolean; reason?: string }> {
  logOperationalEvent('error', event, context);
  const webhookUrl = process.env.OPS_ALERT_WEBHOOK_URL || '';
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN || '';
  const telegramChatId = process.env.TELEGRAM_CHAT_ID || '';

  const sendTelegram = async (): Promise<{ sent: boolean; reason?: string }> => {
    if (!telegramToken || !telegramChatId) return { sent: false, reason: 'telegram_not_configured' };
    try {
      const safeContext = sanitizeValue({ ...context, userId: safeUserId(context.userId) });
      const response = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: `[省心PPT ${APP_VERSION}] ${event}\n${JSON.stringify(safeContext).slice(0, 2500)}`,
        }),
        signal: AbortSignal.timeout(8_000),
      });
      return response.ok ? { sent: true } : { sent: false, reason: `telegram_http_${response.status}` };
    } catch (error) {
      return { sent: false, reason: error instanceof Error ? error.message : String(error) };
    }
  };

  if (!webhookUrl) {
    if (telegramToken && telegramChatId) return sendTelegram();
    return { sent: false, reason: 'alert_channel_not_configured' };
  }
  if (process.env.NODE_ENV === 'production' && !/^https:\/\//i.test(webhookUrl)) {
    return { sent: false, reason: 'webhook_must_use_https' };
  }

  let webhookFailure = '';
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.OPS_ALERT_WEBHOOK_SECRET
          ? { 'x-ops-alert-secret': process.env.OPS_ALERT_WEBHOOK_SECRET }
          : {}),
      },
      body: JSON.stringify({
        service: 'shengxin-ppt',
        version: APP_VERSION,
        event: event.slice(0, 120),
        timestamp: new Date().toISOString(),
        context: sanitizeValue({ ...context, userId: safeUserId(context.userId) }),
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (response.ok) return { sent: true };
    webhookFailure = `webhook_http_${response.status}`;
  } catch (error) {
    webhookFailure = error instanceof Error ? error.message : String(error);
  }

  if (telegramToken && telegramChatId) {
    const fallback = await sendTelegram();
    if (fallback.sent) return { sent: true, reason: `telegram_fallback_after_${webhookFailure}` };
    return { sent: false, reason: `${webhookFailure};telegram_${fallback.reason || 'failed'}` };
  }
  return { sent: false, reason: webhookFailure };
}

export function responseWithRequestId(response: Response, requestId: string): Response {
  response.headers.set('x-request-id', requestId);
  return response;
}
