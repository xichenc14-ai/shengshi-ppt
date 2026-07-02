import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';
import { writeAdminAuditLog } from '@/lib/admin-audit';
import { encryptGammaApiKey, getKeyPoolStatus, parseEnvKeyPool, reloadKeyPool } from '@/lib/gamma-key-pool';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function sanitizeLabel(value: unknown): string {
  return String(value || '').trim().slice(0, 80) || 'Gamma Key';
}

function sanitizePoolTag(value: unknown): string {
  return String(value || 'default').trim().replace(/[^\w.-]/g, '_').slice(0, 60) || 'default';
}

function isMissingTable(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message || '');
  return msg.includes('admin_gamma_keys') || msg.toLowerCase().includes('does not exist');
}

function publicKeyShape(key: Record<string, any>) {
  return {
    id: key.id,
    source: key.source,
    label: key.label,
    last4: key.last4,
    remaining: key.remaining,
    status: key.status,
    quotaPoolTag: key.quotaPoolTag,
    countsTowardAdminQuota: key.countsTowardAdminQuota,
    successCount: key.successCount,
    failCount: key.failCount,
    lastUsed: key.lastUsed,
    lastCheckedAt: key.lastCheckedAt,
    lastFailureAt: key.lastFailureAt,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason || '无权限' }, { status: auth.reason === '请先登录' ? 401 : 403 });
  }

  const status = await getKeyPoolStatus().catch((e) => ({ error: e instanceof Error ? e.message : '读取失败' }));
  if ('error' in status) return NextResponse.json(status, { status: 500 });
  return NextResponse.json({
    ...status,
    keys: status.keys.map((key) => publicKeyShape(key as never)),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason || '无权限' }, { status: auth.reason === '请先登录' ? 401 : 403 });
  }

  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });

  try {
    const body = await request.json();
    const action = String(body?.action || '');

    if (action === 'import_env_keys') {
      const envKeys = parseEnvKeyPool();
      if (envKeys.length === 0) {
        return NextResponse.json({ error: '未读取到环境变量 Gamma Key' }, { status: 400 });
      }

      const { data: existingRows, error: existingErr } = await sb
        .from('admin_gamma_keys')
        .select('api_key_last4,label');
      if (existingErr) {
        if (isMissingTable(existingErr)) return NextResponse.json({ error: '数据库未迁移 admin_gamma_keys 表' }, { status: 503 });
        return NextResponse.json({ error: existingErr.message || '读取已有 Key 失败' }, { status: 500 });
      }

      const existingLast4 = new Set((existingRows || []).map((row) => String(row.api_key_last4 || '')));
      const rows = envKeys
        .filter((key) => !existingLast4.has(key.last4))
        .map((key) => ({
          label: key.label,
          api_key_ciphertext: encryptGammaApiKey(key.key),
          api_key_last4: key.last4,
          status: key.status,
          quota_pool_tag: key.quotaPoolTag,
          counts_toward_admin_quota: key.countsTowardAdminQuota,
          remaining: Math.max(0, Math.floor(Number(key.remaining || 0))),
          created_by: auth.userId || null,
        }));

      if (rows.length > 0) {
        const { error } = await sb.from('admin_gamma_keys').insert(rows);
        if (error) return NextResponse.json({ error: error.message || '迁移失败' }, { status: 500 });
      }

      await reloadKeyPool().catch(() => {});
      await writeAdminAuditLog(sb as never, request, {
        operatorUserId: auth.userId,
        operatorPhone: auth.phone,
        action: 'gamma_key_import_env',
        targetType: 'gamma_key',
        after: { imported: rows.length, skipped: envKeys.length - rows.length },
        reason: String(body?.reason || '接管环境变量 Gamma Key 到数据库').slice(0, 200),
      });

      const status = await getKeyPoolStatus();
      return NextResponse.json({
        success: true,
        imported: rows.length,
        skipped: envKeys.length - rows.length,
        ...status,
        keys: status.keys.map((key) => publicKeyShape(key as never)),
      });
    }

    const apiKey = String(body?.apiKey || '').trim();
    if (!apiKey.startsWith('sk-gamma')) {
      return NextResponse.json({ error: 'Gamma Key 格式无效' }, { status: 400 });
    }

    const payload = {
      label: sanitizeLabel(body?.label),
      api_key_ciphertext: encryptGammaApiKey(apiKey),
      api_key_last4: apiKey.slice(-4),
      status: 'active',
      quota_pool_tag: sanitizePoolTag(body?.quotaPoolTag),
      counts_toward_admin_quota: body?.countsTowardAdminQuota !== false,
      remaining: Math.max(0, Math.floor(Number(body?.remaining || 0))),
      created_by: auth.userId || null,
    };

    const { data, error } = await sb
      .from('admin_gamma_keys')
      .insert(payload)
      .select('id,label,api_key_last4,status,quota_pool_tag,counts_toward_admin_quota,remaining,created_at')
      .single();

    if (error) {
      if (isMissingTable(error)) return NextResponse.json({ error: '数据库未迁移 admin_gamma_keys 表' }, { status: 503 });
      return NextResponse.json({ error: error.message || '保存失败' }, { status: 500 });
    }

    await reloadKeyPool().catch(() => {});
    await writeAdminAuditLog(sb as never, request, {
      operatorUserId: auth.userId,
      operatorPhone: auth.phone,
      action: 'gamma_key_create',
      targetType: 'gamma_key',
      targetId: data?.id,
      after: data,
      reason: String(body?.reason || '新增 Gamma Key').slice(0, 200),
    });

    return NextResponse.json({ success: true, key: data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '保存失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
