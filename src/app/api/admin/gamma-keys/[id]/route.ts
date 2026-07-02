import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';
import { writeAdminAuditLog } from '@/lib/admin-audit';
import { getAllKeys, reloadKeyPool } from '@/lib/gamma-key-pool';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';
const GAMMA_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function sanitizePoolTag(value: unknown): string {
  return String(value || 'default').trim().replace(/[^\w.-]/g, '_').slice(0, 60) || 'default';
}

function publicKeyShape(row: Record<string, any> | null) {
  if (!row) return null;
  return {
    id: row.id,
    label: row.label,
    last4: row.api_key_last4,
    status: row.status,
    quotaPoolTag: row.quota_pool_tag,
    countsTowardAdminQuota: row.counts_toward_admin_quota,
    remaining: row.remaining,
    successCount: row.success_count,
    failCount: row.fail_count,
    exhaustedAt: row.exhausted_at,
    exhaustedReason: row.exhausted_reason,
  };
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason || '无权限' }, { status: auth.reason === '请先登录' ? 401 : 403 });
  }

  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });
  const { id } = await context.params;

  try {
    const body = await request.json();
    const action = String(body?.action || '');
    const reason = String(body?.reason || '').trim().slice(0, 200);

    const { data: before, error: beforeErr } = await sb
      .from('admin_gamma_keys')
      .select('*')
      .eq('id', id)
      .single();
    if (beforeErr || !before) return NextResponse.json({ error: 'Key 不存在' }, { status: 404 });

    const update: Record<string, unknown> = {};
    let auditAction = 'gamma_key_update';

    if (action === 'mark_exhausted') {
      update.status = 'exhausted';
      update.exhausted_at = new Date().toISOString();
      update.exhausted_by = auth.userId || null;
      update.exhausted_reason = reason || '管理员标记额度用尽';
      auditAction = 'gamma_key_mark_exhausted';
    } else if (action === 'restore_quota') {
      update.status = 'active';
      update.restored_at = new Date().toISOString();
      update.restored_by = auth.userId || null;
      update.exhausted_at = null;
      update.exhausted_by = null;
      update.exhausted_reason = null;
      if (Number.isFinite(Number(body?.remaining))) update.remaining = Math.max(0, Math.floor(Number(body.remaining)));
      auditAction = 'gamma_key_restore_quota';
    } else if (action === 'disable') {
      update.status = 'disabled';
      auditAction = 'gamma_key_disable';
    } else if (action === 'enable') {
      update.status = 'active';
      auditAction = 'gamma_key_enable';
    } else if (action === 'mark_invalid') {
      update.status = 'invalid';
      auditAction = 'gamma_key_mark_invalid';
    } else if (action === 'test_key') {
      const allKeys = await getAllKeys().catch(() => []);
      const keyInfo = allKeys.find((key) => key.id === id);
      if (!keyInfo) return NextResponse.json({ error: '无法读取待测试 Key' }, { status: 404 });
      const testedAt = new Date().toISOString();
      try {
        const res = await fetch(`${GAMMA_API_BASE}/me`, {
          headers: {
            'X-API-KEY': keyInfo.key,
            'User-Agent': GAMMA_UA,
          },
          signal: AbortSignal.timeout(15000),
        });
        update.last_checked_at = testedAt;
        if (res.ok) {
          update.status = before.status === 'invalid' ? 'active' : before.status;
          auditAction = 'gamma_key_test_success';
        } else {
          update.status = res.status === 401 || res.status === 403 ? 'invalid' : before.status;
          update.last_failure_at = testedAt;
          auditAction = 'gamma_key_test_failed';
        }
      } catch {
        update.last_checked_at = testedAt;
        update.last_failure_at = testedAt;
        auditAction = 'gamma_key_test_failed';
      }
    } else if (action === 'update_meta') {
      if (typeof body?.label === 'string') update.label = body.label.trim().slice(0, 80) || before.label;
      if (body?.quotaPoolTag !== undefined) update.quota_pool_tag = sanitizePoolTag(body.quotaPoolTag);
      if (body?.countsTowardAdminQuota !== undefined) update.counts_toward_admin_quota = body.countsTowardAdminQuota !== false;
      if (Number.isFinite(Number(body?.remaining))) update.remaining = Math.max(0, Math.floor(Number(body.remaining)));
      auditAction = 'gamma_key_update_meta';
    } else {
      return NextResponse.json({ error: '未知操作' }, { status: 400 });
    }

    update.updated_at = new Date().toISOString();

    const { data: after, error } = await sb
      .from('admin_gamma_keys')
      .update(update)
      .eq('id', id)
      .select('*')
      .single();
    if (error || !after) return NextResponse.json({ error: error?.message || '更新失败' }, { status: 500 });

    await reloadKeyPool().catch(() => {});
    await writeAdminAuditLog(sb as never, request, {
      operatorUserId: auth.userId,
      operatorPhone: auth.phone,
      action: auditAction,
      targetType: 'gamma_key',
      targetId: id,
      before: publicKeyShape(before),
      after: publicKeyShape(after),
      reason,
    });

    return NextResponse.json({ success: true, key: publicKeyShape(after) });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '更新失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason || '无权限' }, { status: auth.reason === '请先登录' ? 401 : 403 });
  }
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });
  const { id } = await context.params;

  const { data: before } = await sb.from('admin_gamma_keys').select('*').eq('id', id).single();
  const { error } = await sb.from('admin_gamma_keys').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message || '删除失败' }, { status: 500 });
  await reloadKeyPool().catch(() => {});
  await writeAdminAuditLog(sb as never, request, {
    operatorUserId: auth.userId,
    operatorPhone: auth.phone,
    action: 'gamma_key_delete',
    targetType: 'gamma_key',
    targetId: id,
    before: publicKeyShape((before || null) as Record<string, any> | null),
    reason: '删除 Gamma Key',
  });
  return NextResponse.json({ success: true });
}
