import { createClient } from '@supabase/supabase-js';

type GenerationRequestRow = {
  id: string;
  user_id: string;
  idempotency_key: string;
  route: string;
  provider_generation_id: string | null;
  gamma_id: string | null;
  status: 'creating' | 'processing' | 'failed';
  attempts: number;
  created_at: string;
  updated_at: string;
  expires_at: string;
};

type ClaimResult =
  | { kind: 'disabled' }
  | { kind: 'claimed'; id: string; key: string }
  | { kind: 'replay'; generationId: string; key: string }
  | { kind: 'in_progress'; key: string };

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function normalizeGenerationRequestId(value: unknown): string {
  const key = typeof value === 'string' ? value.trim() : '';
  return /^[a-zA-Z0-9._:-]{8,128}$/.test(key) ? key : '';
}

export async function claimGenerationRequest(
  userId: string,
  requestId: unknown,
  route: 'gamma' | 'gamma-direct',
): Promise<ClaimResult> {
  const key = normalizeGenerationRequestId(requestId);
  if (!key) return { kind: 'disabled' };
  const sb = getSupabase();
  if (!sb) {
    if (process.env.NODE_ENV === 'production') throw new Error('生成幂等服务未配置');
    return { kind: 'disabled' };
  }

  const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
  const { data, error } = await sb.from('generation_requests').insert({
    user_id: userId,
    idempotency_key: key,
    route,
    status: 'creating',
    attempts: 1,
    expires_at: expiresAt,
  }).select('id').single();
  if (!error && data?.id) return { kind: 'claimed', id: String(data.id), key };
  if (error?.code !== '23505') throw new Error(`生成幂等服务异常: ${error?.message || 'insert_failed'}`);

  const { data: existing, error: readError } = await sb
    .from('generation_requests')
    .select('*')
    .eq('user_id', userId)
    .eq('idempotency_key', key)
    .single();
  if (readError || !existing) throw new Error('生成幂等记录读取失败');
  const row = existing as GenerationRequestRow;
  if (row.provider_generation_id && row.status === 'processing') {
    return { kind: 'replay', generationId: row.provider_generation_id, key };
  }

  const stale = Date.now() - new Date(row.updated_at || row.created_at).getTime() > 2 * 60 * 1000;
  if (row.status === 'creating' && !stale) return { kind: 'in_progress', key };

  const { error: resetError } = await sb.from('generation_requests').update({
    status: 'creating',
    provider_generation_id: null,
    error_code: null,
    attempts: Number(row.attempts || 0) + 1,
    updated_at: new Date().toISOString(),
    expires_at: expiresAt,
  }).eq('id', row.id);
  if (resetError) throw new Error(`生成幂等记录恢复失败: ${resetError.message}`);
  return { kind: 'claimed', id: row.id, key };
}

export async function markGenerationStarted(
  id: string | undefined,
  generationId: string,
  providerKeyRef?: string,
): Promise<void> {
  if (!id) return;
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from('generation_requests').update({
    provider_generation_id: generationId,
    ...(providerKeyRef ? { provider_key_ref: providerKeyRef } : {}),
    status: 'processing',
    updated_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) throw new Error(`生成幂等状态写入失败: ${error.message}`);
}

export async function markGenerationFailed(id: string | undefined, errorCode: string): Promise<void> {
  if (!id) return;
  const sb = getSupabase();
  if (!sb) return;
  await sb.from('generation_requests').update({
    status: 'failed',
    error_code: errorCode.slice(0, 100),
    updated_at: new Date().toISOString(),
  }).eq('id', id);
}

export async function cleanupExpiredGenerationRequests(): Promise<number> {
  const sb = getSupabase();
  if (!sb) return 0;
  const { data, error } = await sb
    .from('generation_requests')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('id');
  if (error) throw new Error(`生成幂等记录清理失败: ${error.message}`);
  return Array.isArray(data) ? data.length : 0;
}
