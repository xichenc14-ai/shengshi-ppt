import { NextRequest } from 'next/server';

type SupabaseLike = {
  from: (table: string) => {
    insert: (payload: Record<string, unknown>) => Promise<{ error?: { message?: string } | null }>;
  };
};

export async function writeAdminAuditLog(
  sb: SupabaseLike | null,
  request: NextRequest,
  input: {
    operatorUserId?: string | null;
    operatorPhone?: string | null;
    action: string;
    targetType: string;
    targetId?: string | null;
    before?: unknown;
    after?: unknown;
    reason?: string | null;
  }
) {
  if (!sb) return;
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '';
    const userAgent = request.headers.get('user-agent') || '';
    await sb.from('admin_audit_logs').insert({
      operator_user_id: input.operatorUserId || null,
      operator_phone: input.operatorPhone || null,
      action: input.action,
      target_type: input.targetType,
      target_id: input.targetId || null,
      before_snapshot: input.before ?? null,
      after_snapshot: input.after ?? null,
      reason: input.reason || null,
      ip_address: ip,
      user_agent: userAgent.slice(0, 500),
    });
  } catch (e) {
    console.warn('[AdminAudit] write failed:', e instanceof Error ? e.message : String(e));
  }
}
