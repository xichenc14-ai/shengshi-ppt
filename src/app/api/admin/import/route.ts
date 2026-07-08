import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';
import { writeAdminAuditLog } from '@/lib/admin-audit';

type CsvRow = Record<string, string>;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function parseCsv(text: string): CsvRow[] {
  const input = String(text || '').replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let cell = '';
  let row: string[] = [];
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const next = input[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') {
      cell += ch;
    }
  }
  row.push(cell);
  rows.push(row);

  const header = (rows.shift() || []).map((v) => v.trim());
  if (!header.includes('user_id')) throw new Error('CSV缺少 user_id 列，请使用后台导出的CSV');
  return rows
    .filter((values) => values.some((v) => String(v || '').trim()))
    .map((values) => Object.fromEntries(header.map((key, index) => [key, String(values[index] || '').trim()])));
}

function normalizePlanType(planType: string): 'free' | 'plus' | 'pro' {
  const value = String(planType || 'free').trim().toLowerCase();
  if (['plus', 'shengxin', 'basic'].includes(value)) return 'plus';
  if (['pro', 'advanced', 'standard', 'vip', 'supreme', 'enterprise'].includes(value)) return 'pro';
  return 'free';
}

function toIsoDateEnd(input: string): string | null {
  const raw = String(input || '').trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T23:59:59.999Z`;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function isMissingColumnError(error: { code?: string; message?: string } | null | undefined): string | null {
  if (!error) return null;
  const message = String(error.message || '');
  if (error.code !== 'PGRST204' && !message.includes('column')) return null;
  return message.match(/'([^']+)' column/)?.[1] || null;
}

async function updateUserCompat(
  sb: NonNullable<ReturnType<typeof getSupabase>>,
  userId: string,
  payload: Record<string, unknown>
): Promise<{ error: { message?: string } | null }> {
  const nextPayload = { ...payload };
  for (let i = 0; i < 8; i += 1) {
    if (Object.keys(nextPayload).length === 0) return { error: null };
    const { error } = await sb.from('users').update(nextPayload).eq('id', userId);
    const missing = isMissingColumnError(error as { code?: string; message?: string } | null);
    if (missing && missing in nextPayload) {
      delete nextPayload[missing];
      continue;
    }
    return { error: error as { message?: string } | null };
  }
  return { error: { message: '用户字段兼容更新失败' } };
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
    const rows = parseCsv(String(body?.csv || ''));
    const dryRun = body?.dryRun !== false;
    const maxRows = Math.min(rows.length, 10000);
    const results: Array<Record<string, unknown>> = [];
    let changed = 0;
    let missing = 0;
    let failed = 0;

    for (const row of rows.slice(0, maxRows)) {
      const userId = row.user_id;
      const phone = row.phone;
      const lookup = userId
        ? sb.from('users').select('id,phone,nickname,credits,plan_type,plan_expires_at').eq('id', userId).maybeSingle()
        : sb.from('users').select('id,phone,nickname,credits,plan_type,plan_expires_at').eq('phone', phone).maybeSingle();
      const { data: user, error: userErr } = await lookup;
      if (userErr || !user) {
        missing += 1;
        results.push({ user_id: userId, phone, status: 'missing' });
        continue;
      }

      const nextPlan = normalizePlanType(row.plan_type || String(user.plan_type || 'free'));
      const nextCredits = Math.max(0, Math.floor(Number(row.credits || user.credits || 0)));
      const nextExpire = nextPlan === 'free' ? null : toIsoDateEnd(row.plan_expires_at || '') || user.plan_expires_at || null;
      const nextNickname = row.nickname || user.nickname || '用户';
      const before = {
        nickname: user.nickname || '',
        plan_type: user.plan_type || 'free',
        plan_expires_at: user.plan_expires_at || null,
        credits: Number(user.credits || 0),
      };
      const after = {
        nickname: nextNickname,
        plan_type: nextPlan,
        plan_expires_at: nextExpire,
        credits: nextCredits,
      };
      const rowChanged = JSON.stringify(before) !== JSON.stringify(after);
      if (!rowChanged) {
        results.push({ user_id: user.id, phone: user.phone, status: 'unchanged', before, after });
        continue;
      }
      changed += 1;

      if (dryRun) {
        results.push({ user_id: user.id, phone: user.phone, status: 'will_update', before, after });
        continue;
      }

      const updateResult = await updateUserCompat(sb, String(user.id), {
        nickname: nextNickname,
        plan_type: nextPlan,
        plan_expires_at: nextExpire,
        credits: nextCredits,
        last_entitlement_sync_at: new Date().toISOString(),
      });
      if (updateResult.error) {
        failed += 1;
        results.push({ user_id: user.id, phone: user.phone, status: 'failed', error: updateResult.error.message, before, after });
        continue;
      }

      const delta = nextCredits - Number(user.credits || 0);
      if (delta !== 0) {
        await sb.from('credit_transactions').insert({
          user_id: user.id,
          amount: delta,
          balance_after: nextCredits,
          type: 'admin_import',
          description: '后台CSV导入恢复积分',
        });
      }
      if (nextPlan !== 'free' && nextExpire) {
        await sb.from('orders').insert({
          user_id: user.id,
          order_no: `admin_import_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
          product_type: 'subscription',
          product_name: '后台CSV导入恢复权益',
          amount: 0,
          status: 'completed',
          pay_method: 'admin',
          metadata: {
            manualExpireAt: nextExpire,
            reason: 'CSV导入恢复',
            operator: auth.userId,
            planType: nextPlan,
          },
          paid_at: new Date().toISOString(),
        });
      }
      results.push({ user_id: user.id, phone: user.phone, status: 'updated', before, after });
    }

    await writeAdminAuditLog(sb as never, request, {
      operatorUserId: auth.userId,
      operatorPhone: auth.phone,
      action: dryRun ? 'admin_import_preview' : 'admin_import_apply',
      targetType: 'users',
      after: { total: rows.length, scanned: maxRows, changed, missing, failed },
      reason: String(body?.reason || '后台CSV导入').slice(0, 200),
    });

    return NextResponse.json({
      success: !failed,
      dryRun,
      totalRows: rows.length,
      scannedRows: maxRows,
      changed,
      missing,
      failed,
      results: results.slice(0, 300),
      truncatedResults: results.length > 300,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '导入失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
