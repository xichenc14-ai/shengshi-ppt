import { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';

function splitEnvList(raw?: string | null): string[] {
  return (raw || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export function isAdminIdentity(identity?: { id?: string; phone?: string | null }): boolean {
  if (!identity?.id && !identity?.phone) return false;
  const adminIds = splitEnvList(process.env.ADMIN_USER_IDS);
  const adminPhones = splitEnvList(process.env.ADMIN_USER_PHONES);
  if (identity.id && adminIds.includes(identity.id)) return true;
  if (identity.phone && adminPhones.includes(identity.phone)) return true;
  return false;
}

export async function requireAdmin(request: NextRequest): Promise<{ ok: boolean; userId?: string; phone?: string | null; reason?: string }> {
  const headerKey = request.headers.get('x-admin-key') || '';
  const envKey = process.env.ADMIN_DASHBOARD_KEY || '';
  if (envKey && headerKey && headerKey === envKey) {
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

