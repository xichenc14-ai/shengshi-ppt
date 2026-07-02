import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function hasEnv(name: string): boolean {
  return Boolean(String(process.env[name] || '').trim());
}

async function tableReady(sb: NonNullable<ReturnType<typeof getSupabase>>, table: string): Promise<boolean> {
  try {
    const { error } = await sb.from(table).select('id').limit(1);
    if (!error) return true;
    const msg = String(error.message || '').toLowerCase();
    return !(msg.includes(table.toLowerCase()) && (msg.includes('does not exist') || msg.includes('could not find')));
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason || '无权限' }, { status: auth.reason === '请先登录' ? 401 : 403 });
  }
  const sb = getSupabase();
  const tables = sb
    ? {
        admin_audit_logs: await tableReady(sb, 'admin_audit_logs'),
        admin_gamma_keys: await tableReady(sb, 'admin_gamma_keys'),
        refund_requests: await tableReady(sb, 'refund_requests'),
      }
    : {
        admin_audit_logs: false,
        admin_gamma_keys: false,
        refund_requests: false,
      };

  const checks = {
    supabaseConfigured: Boolean(sb),
    adminUserPhonesConfigured: hasEnv('ADMIN_USER_PHONES'),
    adminUserIdsConfigured: hasEnv('ADMIN_USER_IDS'),
    gammaKeyEncryptionConfigured: hasEnv('ADMIN_SECRET_ENCRYPTION_KEY') || hasEnv('GAMMA_KEY_ENCRYPTION_SECRET'),
    fallbackGammaKeysConfigured: hasEnv('GAMMA_API_KEYS'),
    paymentAutoRefundEnabled: process.env.PAYMENT_AUTO_REFUND_ENABLED === 'true',
    tables,
  };

  const requiredOk = checks.supabaseConfigured
    && (checks.adminUserPhonesConfigured || checks.adminUserIdsConfigured)
    && checks.gammaKeyEncryptionConfigured
    && tables.admin_audit_logs
    && tables.admin_gamma_keys
    && tables.refund_requests;

  return NextResponse.json({
    ready: requiredOk,
    checks,
    missing: [
      !checks.supabaseConfigured ? 'Supabase service role' : '',
      !(checks.adminUserPhonesConfigured || checks.adminUserIdsConfigured) ? 'ADMIN_USER_PHONES 或 ADMIN_USER_IDS' : '',
      !checks.gammaKeyEncryptionConfigured ? 'ADMIN_SECRET_ENCRYPTION_KEY' : '',
      !tables.admin_audit_logs || !tables.admin_gamma_keys || !tables.refund_requests ? 'Supabase admin migration' : '',
    ].filter(Boolean),
  });
}
