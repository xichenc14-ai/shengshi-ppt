/** Keep provider validation errors actionable without blaming a healthy key. */
export function describeGammaRequestError(status: number, raw: string, requestId?: string | null) {
  let detail = '';
  try {
    const parsed = JSON.parse(raw);
    const message = parsed?.message ?? parsed?.error?.message ?? parsed?.error;
    if (typeof message === 'string') detail = message;
    else if (Array.isArray(message)) detail = message.filter(item => typeof item === 'string').join('; ');
  } catch { /* Non-JSON gateway responses are not suitable for the UI. */ }
  detail = detail.replace(/sk-gamma-[A-Za-z0-9_-]+/g, '[redacted]').slice(0, 1000);
  const reason = status === 400
    ? 'PPT生成参数未通过校验'
    : status === 402
      ? 'PPT生成服务额度不足，请联系管理员'
      : status === 401 || status === 403
        ? 'PPT生成服务认证或权限异常，请联系管理员'
        : status === 429
          ? 'PPT生成服务繁忙，请稍后再试'
          : `PPT生成服务调用失败（${status}）`;
  return {
    error: status === 400 && detail ? `${reason}：${detail}` : reason,
    code: status === 400 ? 'GAMMA_INVALID_REQUEST' : 'GAMMA_API_ERROR',
    providerStatus: status,
    ...(detail ? { detail } : {}),
    ...(requestId ? { providerRequestId: requestId } : {}),
  };
}

export function isGammaKeyFailure(status: number): boolean {
  return status === 401 || status === 403 || status === 429 || status >= 500;
}
