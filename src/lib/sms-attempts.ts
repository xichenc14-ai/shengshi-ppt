import { createHash, randomUUID } from 'node:crypto';

export type SMSAttemptPurpose = 'login' | 'reset_password' | 'change_phone';
export type SMSAttemptState = 'pending' | 'accepted' | 'unknown' | 'failed';

export type SMSAttempt = {
  outId: string;
  requestId: string;
  phone: string;
  purpose: SMSAttemptPurpose;
};

type SMSAttemptPatch = {
  state: SMSAttemptState;
  provider?: string;
  providerRequestId?: string;
  providerMessageId?: string;
  errorCode?: string;
};

type SupabaseWriter = {
  from: (table: string) => {
    upsert: (value: Record<string, unknown>, options: { onConflict: string }) => PromiseLike<{ error?: { message?: string } | null }>;
  };
};

function phoneFingerprint(phone: string): string {
  return createHash('sha256').update(`sms-attempt:v1:${phone}`, 'utf8').digest('hex');
}

export function createSMSAttempt(phone: string, purpose: SMSAttemptPurpose, requestId: string): SMSAttempt {
  return { outId: randomUUID(), requestId, phone, purpose };
}

// 追踪写入为旁路：迁移尚未执行或审计表暂不可用时，不影响验证码主链路。
export async function recordSMSAttempt(
  client: SupabaseWriter,
  attempt: SMSAttempt,
  patch: SMSAttemptPatch,
): Promise<void> {
  try {
    const { error } = await client.from('sms_send_attempts').upsert({
      out_id: attempt.outId,
      request_id: attempt.requestId,
      phone_hash: phoneFingerprint(attempt.phone),
      phone_last4: attempt.phone.slice(-4),
      purpose: attempt.purpose,
      provider: patch.provider || process.env.SMS_PROVIDER || 'aliyun_auth',
      state: patch.state,
      provider_request_id: patch.providerRequestId || null,
      provider_message_id: patch.providerMessageId || null,
      error_code: patch.errorCode || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'out_id' });
    if (error) console.warn('[SMS] 发送审计写入失败:', error.message || 'unknown');
  } catch (error) {
    console.warn('[SMS] 发送审计写入异常:', error instanceof Error ? error.message : 'unknown');
  }
}
