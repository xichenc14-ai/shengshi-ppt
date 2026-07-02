import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';

export type GammaKeyStatus = 'active' | 'exhausted' | 'disabled' | 'invalid';

export interface KeyInfo {
  id?: string;
  source: 'db' | 'env';
  key: string;
  label: string;
  remaining: number;
  status: GammaKeyStatus;
  quotaPoolTag: string;
  countsTowardAdminQuota: boolean;
  lastUsed: Date;
  successCount: number;
  failCount: number;
  lastFailureAt?: Date;
  lastCheckedAt?: Date;
  last4: string;
}

export interface GammaQuotaGroup {
  tag: string;
  remaining: number;
  activeKeyCount: number;
  exhaustedKeyCount: number;
  totalKeyCount: number;
}

const LOW_BALANCE_THRESHOLD = 500;
const MIN_BALANCE_THRESHOLD = 100;
const FAILURE_COOLDOWN_MS = 90 * 1000;
const CACHE_TTL_MS = 10 * 1000;

let KEY_POOL: KeyInfo[] | null = null;
let KEY_POOL_LOADED_AT = 0;
let KEY_CURSOR = 0;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function splitEnvList(raw?: string | null): string[] {
  return (raw || '').split(',').map((v) => v.trim()).filter(Boolean);
}

function normalizeStatus(raw: unknown): GammaKeyStatus {
  const value = String(raw || 'active').trim();
  if (value === 'exhausted' || value === 'disabled' || value === 'invalid') return value;
  return 'active';
}

function normalizePoolTag(raw: unknown): string {
  return String(raw || 'default').trim() || 'default';
}

function last4(key: string): string {
  return key.slice(-4);
}

function getCipherKey(): Buffer | null {
  const raw = process.env.ADMIN_SECRET_ENCRYPTION_KEY || process.env.GAMMA_KEY_ENCRYPTION_SECRET || '';
  if (!raw) return null;
  return createHash('sha256').update(raw).digest();
}

export function encryptGammaApiKey(apiKey: string): string {
  const cipherKey = getCipherKey();
  if (!cipherKey) {
    throw new Error('ADMIN_SECRET_ENCRYPTION_KEY 未配置，不能在后台保存 Gamma Key');
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', cipherKey, iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptGammaApiKey(ciphertext: string): string {
  if (ciphertext.startsWith('plain:')) return ciphertext.slice('plain:'.length);
  const cipherKey = getCipherKey();
  if (!cipherKey) throw new Error('ADMIN_SECRET_ENCRYPTION_KEY 未配置，无法读取后台 Gamma Key');
  const [version, ivRaw, tagRaw, dataRaw] = ciphertext.split(':');
  if (version !== 'v1' || !ivRaw || !tagRaw || !dataRaw) {
    throw new Error('Gamma Key 密文格式无效');
  }
  const decipher = createDecipheriv('aes-256-gcm', cipherKey, Buffer.from(ivRaw, 'base64'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataRaw, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export function parseEnvKeyPool(): KeyInfo[] {
  const entries = splitEnvList(process.env.GAMMA_API_KEYS);
  const keys: KeyInfo[] = [];

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const parts = entry.split(':').map((p) => p.trim());
    const keyIndex = parts.findIndex((p) => p.startsWith('sk-gamma'));

    let label = `Key-${i + 1}`;
    let remaining = 3967;
    let key = '';
    let quotaPoolTag = 'default';
    let status: GammaKeyStatus = 'active';
    let countsTowardAdminQuota = true;

    if (keyIndex >= 0) {
      key = parts[keyIndex];
      if (keyIndex >= 2) {
        label = parts[0] || label;
        remaining = parseInt(parts[1], 10) || remaining;
      } else if (keyIndex === 0) {
        remaining = parseInt(parts[1], 10) || remaining;
        label = parts[2] || label;
      }
      quotaPoolTag = normalizePoolTag(parts[keyIndex + 1]);
      status = normalizeStatus(parts[keyIndex + 2]);
      if (parts[keyIndex + 3]) countsTowardAdminQuota = parts[keyIndex + 3] !== 'false';
    } else if (entry.startsWith('sk-gamma')) {
      key = entry;
    }

    if (!key || !key.startsWith('sk-gamma')) {
      throw new Error(`[Gamma] Key格式无法解析: ${entry}`);
    }

    keys.push({
      source: 'env',
      key,
      label,
      remaining,
      status,
      quotaPoolTag,
      countsTowardAdminQuota,
      lastUsed: new Date(),
      successCount: 0,
      failCount: 0,
      last4: last4(key),
    });
  }

  return keys;
}

async function loadDbKeyPool(): Promise<KeyInfo[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from('admin_gamma_keys')
    .select('id,label,api_key_ciphertext,api_key_last4,status,quota_pool_tag,counts_toward_admin_quota,remaining,success_count,fail_count,last_used_at,last_checked_at,last_failure_at')
    .order('created_at', { ascending: true });

  if (error) {
    const msg = String(error.message || '');
    if (msg.includes('admin_gamma_keys') || msg.toLowerCase().includes('does not exist') || error.code === '42P01') {
      return null;
    }
    console.warn('[Gamma] 后台Key读取失败，回退环境变量:', msg);
    return null;
  }

  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) return null;

  const keys: KeyInfo[] = [];
  for (const row of rows as Array<Record<string, any>>) {
    try {
      const key = decryptGammaApiKey(String(row.api_key_ciphertext || ''));
      if (!key.startsWith('sk-gamma')) continue;
      keys.push({
        id: String(row.id),
        source: 'db',
        key,
        label: String(row.label || `Key-${keys.length + 1}`),
        remaining: Number(row.remaining || 0),
        status: normalizeStatus(row.status),
        quotaPoolTag: normalizePoolTag(row.quota_pool_tag),
        countsTowardAdminQuota: row.counts_toward_admin_quota !== false,
        lastUsed: row.last_used_at ? new Date(row.last_used_at) : new Date(0),
        successCount: Number(row.success_count || 0),
        failCount: Number(row.fail_count || 0),
        lastFailureAt: row.last_failure_at ? new Date(row.last_failure_at) : undefined,
        lastCheckedAt: row.last_checked_at ? new Date(row.last_checked_at) : undefined,
        last4: String(row.api_key_last4 || last4(key)),
      });
    } catch (e) {
      console.warn('[Gamma] 跳过无法解密的后台Key:', e instanceof Error ? e.message : String(e));
    }
  }
  return keys.length > 0 ? keys : null;
}

async function loadKeyPool(force = false): Promise<KeyInfo[]> {
  const now = Date.now();
  if (!force && KEY_POOL && now - KEY_POOL_LOADED_AT < CACHE_TTL_MS) return KEY_POOL;

  const dbPool = await loadDbKeyPool();
  const pool = dbPool || parseEnvKeyPool();
  if (pool.length === 0) {
    throw new Error('[Gamma] 没有任何可用 Key。请配置后台 Gamma Key 或 GAMMA_API_KEYS。');
  }

  KEY_POOL = pool;
  KEY_POOL_LOADED_AT = now;
  return pool;
}

export async function reloadKeyPool(): Promise<void> {
  KEY_POOL = null;
  KEY_POOL_LOADED_AT = 0;
  KEY_CURSOR = 0;
  await loadKeyPool(true);
}

function isCooling(key: KeyInfo, now = Date.now()): boolean {
  return Boolean(key.lastFailureAt && now - key.lastFailureAt.getTime() < FAILURE_COOLDOWN_MS);
}

function isSelectable(key: KeyInfo): boolean {
  return key.status === 'active' && key.remaining >= MIN_BALANCE_THRESHOLD && !isCooling(key);
}

export async function selectBestKey(): Promise<KeyInfo> {
  const pool = await loadKeyPool();
  const availableKeys = pool.filter(isSelectable);
  const fallbackKeys = availableKeys.length > 0
    ? availableKeys
    : pool.filter((k) => k.status === 'active' && k.remaining >= MIN_BALANCE_THRESHOLD);

  if (fallbackKeys.length === 0) {
    const exhausted = pool.filter((k) => k.status === 'exhausted').length;
    const inactive = pool.length - pool.filter((k) => k.status === 'active').length;
    throw new Error(`暂无可用 Gamma Key，请在后台恢复额度或新增 Key（额度用尽 ${exhausted} 个，非活动 ${inactive} 个）`);
  }

  fallbackKeys.sort((a, b) => {
    const aScore = a.remaining - a.failCount * 20;
    const bScore = b.remaining - b.failCount * 20;
    if (bScore !== aScore) return bScore - aScore;
    return a.lastUsed.getTime() - b.lastUsed.getTime();
  });

  const roundWindow = Math.min(3, fallbackKeys.length);
  const bestKey = fallbackKeys[KEY_CURSOR % roundWindow];
  KEY_CURSOR = (KEY_CURSOR + 1) % Math.max(1, roundWindow);
  bestKey.lastUsed = new Date();
  void persistKeyUsage(bestKey, { last_used_at: bestKey.lastUsed.toISOString() });
  return bestKey;
}

async function persistKeyUsage(key: KeyInfo, payload: Record<string, unknown>) {
  if (key.source !== 'db' || !key.id) return;
  const sb = getSupabase();
  if (!sb) return;
  await sb.from('admin_gamma_keys').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', key.id);
}

export async function updateKeyBalance(key: string, deducted: number, remaining: number): Promise<void> {
  const pool = await loadKeyPool();
  const keyInfo = pool.find((k) => k.key === key);
  if (!keyInfo) return;

  for (const item of pool.filter((k) => k.quotaPoolTag === keyInfo.quotaPoolTag)) {
    item.remaining = remaining;
  }
  keyInfo.lastUsed = new Date();
  keyInfo.lastCheckedAt = new Date();
  keyInfo.successCount += 1;

  const sb = getSupabase();
  if (sb && keyInfo.source === 'db') {
    await sb
      .from('admin_gamma_keys')
      .update({
        remaining,
        success_count: keyInfo.successCount,
        last_used_at: keyInfo.lastUsed.toISOString(),
        last_checked_at: keyInfo.lastCheckedAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', keyInfo.id);

    await sb
      .from('admin_gamma_keys')
      .update({ remaining, last_checked_at: keyInfo.lastCheckedAt.toISOString(), updated_at: new Date().toISOString() })
      .eq('quota_pool_tag', keyInfo.quotaPoolTag);
  }

  if (remaining < LOW_BALANCE_THRESHOLD) {
    console.warn(`[Gamma] ${keyInfo.label} 余额不足: ${remaining}, deducted=${deducted}`);
  }
}

export async function recordKeyFailure(key: string): Promise<void> {
  const pool = await loadKeyPool();
  const keyInfo = pool.find((k) => k.key === key);
  if (!keyInfo) return;
  keyInfo.failCount += 1;
  keyInfo.lastUsed = new Date();
  keyInfo.lastFailureAt = new Date();
  await persistKeyUsage(keyInfo, {
    fail_count: keyInfo.failCount,
    last_used_at: keyInfo.lastUsed.toISOString(),
    last_failure_at: keyInfo.lastFailureAt.toISOString(),
  });
}

export async function getAllKeys(): Promise<KeyInfo[]> {
  return await loadKeyPool();
}

export async function getKeyPoolStatus(): Promise<{
  keys: KeyInfo[];
  totalRemaining: number;
  sharedRemaining: number;
  adminTotalRemaining: number;
  quotaGroups: GammaQuotaGroup[];
  healthyCount: number;
  lowBalanceKeys: string[];
}> {
  const pool = await loadKeyPool();
  const quotaGroups = calculateQuotaGroups(pool);
  const adminTotalRemaining = quotaGroups.reduce((sum, group) => sum + group.remaining, 0);
  const activeKeys = pool.filter((k) => k.status === 'active');
  const sharedRemaining = calculateLegacySharedRemaining(pool);
  return {
    keys: pool,
    totalRemaining: adminTotalRemaining,
    sharedRemaining,
    adminTotalRemaining,
    quotaGroups,
    healthyCount: activeKeys.filter((k) => k.remaining >= LOW_BALANCE_THRESHOLD).length,
    lowBalanceKeys: activeKeys.filter((k) => k.remaining < LOW_BALANCE_THRESHOLD).map((k) => `${k.label}: ${k.remaining}`),
  };
}

function calculateLegacySharedRemaining(pool: KeyInfo[]): number {
  const active = pool.find((k) => k.status === 'active');
  return active?.remaining ?? 0;
}

function calculateQuotaGroups(pool: KeyInfo[]): GammaQuotaGroup[] {
  const grouped = new Map<string, KeyInfo[]>();
  for (const key of pool) {
    if (!key.countsTowardAdminQuota) continue;
    if (key.status === 'disabled' || key.status === 'invalid') continue;
    const tag = normalizePoolTag(key.quotaPoolTag);
    grouped.set(tag, [...(grouped.get(tag) || []), key]);
  }

  return [...grouped.entries()].map(([tag, keys]) => {
    const activeKeys = keys.filter((k) => k.status === 'active');
    const sourceKeys = activeKeys.length > 0 ? activeKeys : [];
    const remaining = sourceKeys.length > 0 ? Math.max(...sourceKeys.map((k) => Number(k.remaining || 0))) : 0;
    return {
      tag,
      remaining,
      activeKeyCount: activeKeys.length,
      exhaustedKeyCount: keys.filter((k) => k.status === 'exhausted').length,
      totalKeyCount: keys.length,
    };
  }).sort((a, b) => a.tag.localeCompare(b.tag));
}

export async function getSharedKeyPoolRemaining(): Promise<number> {
  return (await getKeyPoolStatus()).adminTotalRemaining;
}

export function convertCreditsToUserPoints(gammaCredits: number): number {
  return gammaCredits;
}
