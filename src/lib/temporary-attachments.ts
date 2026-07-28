import { createClient } from '@supabase/supabase-js';

export const TEMPORARY_ATTACHMENT_BUCKET = 'temporary-attachments';
const CLEANUP_RETRY_MS = 15 * 60 * 1000;
const DEFAULT_SIGNED_UPLOAD_TOKEN_LIFETIME_MS = 2 * 60 * 60 * 1000;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function getTemporaryAttachmentTtlMs(): number {
  const configured = Number(process.env.TEMPORARY_ATTACHMENT_TTL_MINUTES || 60);
  const minutes = Number.isFinite(configured) ? Math.max(15, Math.min(24 * 60, Math.floor(configured))) : 60;
  return minutes * 60 * 1000;
}

export function isTemporaryAttachmentExpired(createdAt: string, now = Date.now()): boolean {
  const created = new Date(createdAt).getTime();
  return Number.isFinite(created) && created <= now - getTemporaryAttachmentTtlMs();
}

export function getSignedUploadTokenExpiry(token: string, now = Date.now()): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString('utf8')) as { exp?: unknown };
    const expiresAt = Number(payload.exp) * 1000;
    if (Number.isFinite(expiresAt) && expiresAt > now) return expiresAt;
  } catch {
    // Fall through to the conservative server default.
  }
  return now + DEFAULT_SIGNED_UPLOAD_TOKEN_LIFETIME_MS;
}

export async function registerTemporaryAttachment(userId: string, storagePath: string, signedToken: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error('临时附件清理服务未配置');
  const expiresAt = new Date(Date.now() + getTemporaryAttachmentTtlMs()).toISOString();
  const deleteAfter = new Date(getSignedUploadTokenExpiry(signedToken) + CLEANUP_RETRY_MS).toISOString();
  const { error } = await sb.from('temporary_attachment_leases').insert({
    user_id: userId,
    storage_path: storagePath,
    expires_at: expiresAt,
    delete_after: deleteAfter,
  });
  if (error) throw new Error(`临时附件租约登记失败: ${error.message}`);
}

export async function releaseTemporaryAttachment(storagePath: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from('temporary_attachment_leases').delete().eq('storage_path', storagePath);
  if (error) throw new Error(`临时附件租约释放失败: ${error.message}`);
}

export async function cleanupExpiredTemporaryAttachments(): Promise<number> {
  const sb = getSupabase();
  if (!sb) {
    if (process.env.NODE_ENV === 'production') throw new Error('临时附件清理服务未配置');
    return 0;
  }

  const { data, error } = await sb
    .from('temporary_attachment_leases')
    .select('id,storage_path,expires_at,delete_after')
    .lt('expires_at', new Date().toISOString())
    .limit(500);
  if (error) throw new Error(`临时附件租约扫描失败: ${error.message}`);

  const rows = data || [];
  const paths = rows.map((item) => String(item.storage_path || '')).filter(Boolean);
  if (paths.length === 0) return 0;

  const { error: removeError } = await sb.storage.from(TEMPORARY_ATTACHMENT_BUCKET).remove(paths);
  if (removeError) throw new Error(`临时附件过期删除失败: ${removeError.message}`);

  const now = Date.now();
  const finalIds = rows
    .filter((item) => new Date(String(item.delete_after || '')).getTime() <= now)
    .map((item) => String(item.id || ''))
    .filter(Boolean);
  const retryIds = rows
    .filter((item) => new Date(String(item.delete_after || '')).getTime() > now)
    .map((item) => String(item.id || ''))
    .filter(Boolean);
  if (finalIds.length > 0) {
    const { error: deleteError } = await sb.from('temporary_attachment_leases').delete().in('id', finalIds);
    if (deleteError) throw new Error(`临时附件租约清理失败: ${deleteError.message}`);
  }
  if (retryIds.length > 0) {
    const { error: retryError } = await sb.from('temporary_attachment_leases').update({
      expires_at: new Date(now + CLEANUP_RETRY_MS).toISOString(),
    }).in('id', retryIds);
    if (retryError) throw new Error(`临时附件租约复查调度失败: ${retryError.message}`);
  }
  return paths.length;
}
