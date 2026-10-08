import type { UserInfo } from './auth-context';

export interface LoginResponse {
  success?: boolean;
  error?: string;
  message?: string;
  deliveryState?: string;
  retryAfter?: number;
  attemptsLeft?: number;
  requestId?: string;
  nickname?: string;
  user?: UserInfo;
  authToken?: string;
}

export const SMS_UNCONFIRMED_MESSAGE = '短信发送状态暂未确认。如已收到验证码，请直接输入；未收到请等待倒计时结束后重试。';

// 超时只代表客户端未确认结果，不能据此自动重发短信或注册。
export async function requestLogin(
  body: Record<string, unknown>,
  signal: AbortSignal,
): Promise<{ response: Response; data: LoginResponse }> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener('abort', cancel, { once: true });
  if (signal.aborted) controller.abort();
  const timeout = setTimeout(cancel, 35_000);
  try {
    const response = await fetch('/api/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await response.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('INVALID_RESPONSE');
    }
    return { response, data };
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', cancel);
  }
}

export function classifySMSSend(response: Pick<Response, 'ok'>, data: LoginResponse) {
  if (data.error || !response.ok || data.success === false) return 'rejected';
  if (data.success === true && data.deliveryState !== 'unknown') return 'accepted';
  return 'unknown';
}

export function retrySeconds(value: unknown, fallback = 0): number {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : fallback;
}
