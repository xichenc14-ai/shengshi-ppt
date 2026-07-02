import { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';

const DEFAULT_ADMIN_PHONE = '15767979625';

function splitEnvList(raw?: string | null): string[] {
  return (raw || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export function getAdminPhones(): string[] {
  const configured = splitEnvList(process.env.ADMIN_USER_PHONES);
  return configured.length ? configured : [DEFAULT_ADMIN_PHONE];
}

export function isAdminIdentity(identity?: { id?: string; phone?: string | null }): boolean {
  if (!identity?.phone) return false;
  return getAdminPhones().includes(identity.phone);
}

export async function requireAdmin(request: NextRequest): Promise<{ ok: boolean; userId?: string; phone?: string | null; reason?: string }> {
  const headerKey = request.headers.get('x-admin-key') || '';
  const envKey = process.env.ADMIN_DASHBOARD_KEY || '';
  const allowHeaderAdmin =
    process.env.NODE_ENV !== 'production' || process.env.ADMIN_DASHBOARD_KEY_ALLOW_PRODUCTION === 'true';
  if (allowHeaderAdmin && envKey && headerKey && headerKey === envKey) {
    return { ok: true, userId: 'header-admin' };
  }

  const session = await getSession();
  if (!session?.isLoggedIn || !session.user?.id) {
    return { ok: false, reason: '请先登录' };
  }
  const ok = isAdminIdentity({ id: session.user.id, phone: session.user.phone });
  if (!ok) return { ok: false, reason: '无后台权限' };
  return { ok: true, userId: session.user.id, phone: session.user.phone };
}
