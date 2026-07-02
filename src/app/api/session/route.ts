import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSession, type SessionData } from '@/lib/session';
import { verifyAuthProof } from '@/lib/auth-proof';
import { getClientIP, rateLimit } from '@/lib/rate-limit';
import { isAdminIdentity } from '@/lib/admin-auth';
import { reconcileUserEntitlements } from '@/lib/payment/subscription';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

type TrustedUser = {
  id: string;
  phone?: string | null;
  nickname?: string | null;
  credits?: number | null;
  plan_type?: string | null;
  created_at?: string | null;
  last_login_at?: string | null;
  [key: string]: unknown;
};

type SessionUser = NonNullable<SessionData['user']>;

function planRank(planType: string | null | undefined): number {
  if (['advanced', 'standard', 'pro', 'vip', 'supreme'].includes(String(planType || ''))) return 2;
  if (['shengxin', 'basic'].includes(String(planType || ''))) return 1;
  return 0;
}

function pickCanonicalUser(users: TrustedUser[]): TrustedUser | null {
  if (!users.length) return null;
  return [...users].sort((a, b) => {
    const rankDiff = planRank(b.plan_type) - planRank(a.plan_type);
    if (rankDiff !== 0) return rankDiff;
    const bTime = new Date(String(b.last_login_at || b.created_at || 0)).getTime();
    const aTime = new Date(String(a.last_login_at || a.created_at || 0)).getTime();
    return bTime - aTime;
  })[0];
}

function toSessionUser(base: Partial<SessionUser> | undefined, trusted: TrustedUser): SessionUser {
  return {
    id: trusted.id || base?.id || '',
    phone: String(trusted.phone || base?.phone || ''),
    nickname: String(trusted.nickname || base?.nickname || '用户'),
    ...(typeof trusted.avatar === 'string' ? { avatar: trusted.avatar } : base?.avatar ? { avatar: base.avatar } : {}),
    credits: Number(trusted.credits || 0),
    plan_type: String(trusted.plan_type || base?.plan_type || 'free'),
    ...(typeof trusted.plan_expires_at === 'string' || trusted.plan_expires_at === null
      ? { plan_expires_at: trusted.plan_expires_at as string | null }
      : base?.plan_expires_at !== undefined
        ? { plan_expires_at: base.plan_expires_at }
        : {}),
    ...(base?.is_admin ? { is_admin: true } : {}),
  };
}

async function readSamePhoneUsers(
  sb: NonNullable<ReturnType<typeof getSupabase>>,
  phone: string,
  withExpiryFields: boolean
): Promise<TrustedUser[]> {
  const selections = withExpiryFields
    ? [
        'id,phone,nickname,avatar,credits,plan_type,plan_expires_at,is_active,created_at,last_login_at',
        'id,phone,nickname,credits,plan_type,plan_expires_at,is_active,created_at,last_login_at',
        'id,phone,nickname,avatar,credits,plan_type,is_active,created_at,last_login_at',
        'id,phone,nickname,credits,plan_type,is_active,created_at,last_login_at',
      ]
    : [
        'id,phone,nickname,avatar,credits,plan_type,is_active,created_at,last_login_at',
        'id,phone,nickname,credits,plan_type,is_active,created_at,last_login_at',
        'id,phone,nickname,credits,plan_type,created_at,last_login_at',
      ];

  for (const select of selections) {
    const { data, error } = await sb.from('users').select(select).eq('phone', phone).limit(20);
    if (!error && Array.isArray(data)) return data as unknown as TrustedUser[];
  }
  return [];
}

async function readTrustedUser(userId: string) {
  const sb = getSupabase();
  if (!sb) return null;
  await reconcileUserEntitlements(sb, userId);
  const withExpiry = await sb
    .from('users')
    .select('id,phone,nickname,avatar,credits,plan_type,plan_expires_at,is_active,free_cycle_anchor,free_credits_reset_at,last_entitlement_sync_at')
    .eq('id', userId)
    .single();
  if (!withExpiry.error && withExpiry.data) {
    const current = withExpiry.data as TrustedUser;
    if (/^1[3-9]\d{9}$/.test(String(current.phone || ''))) {
      const samePhoneUsers = await readSamePhoneUsers(sb, String(current.phone), true);
      const canonical = pickCanonicalUser(samePhoneUsers);
      if (canonical?.id && canonical.id !== current.id) {
        await reconcileUserEntitlements(sb, canonical.id);
        return canonical;
      }
    }
    return current;
  }
  const fallbackSelections = [
    'id,phone,nickname,avatar,credits,plan_type,is_active,created_at,last_login_at',
    'id,phone,nickname,credits,plan_type,is_active,created_at,last_login_at',
    'id,phone,nickname,credits,plan_type,created_at,last_login_at',
    'id,phone,nickname,credits,plan_type',
  ];
  let fallbackUser: TrustedUser | null = null;
  for (const select of fallbackSelections) {
    const { data, error } = await sb.from('users').select(select).eq('id', userId).single();
    if (!error && data) {
      fallbackUser = data as unknown as TrustedUser;
      break;
    }
  }
  if (!fallbackUser) return null;
  if (/^1[3-9]\d{9}$/.test(String(fallbackUser.phone || ''))) {
    const samePhoneUsers = await readSamePhoneUsers(sb, String(fallbackUser.phone), false);
    const canonical = pickCanonicalUser(samePhoneUsers);
    if (canonical?.id && canonical.id !== fallbackUser.id) {
      await reconcileUserEntitlements(sb, canonical.id);
      return canonical;
    }
  }
  return fallbackUser;
}

// GET: 读取当前session
export async function GET() {
  try {
    const session = await getSession();
    const trustedUser = session.user?.id ? await readTrustedUser(session.user.id) : null;
    if (trustedUser && session.user) {
      session.user = toSessionUser(session.user, trustedUser);
      await session.save();
    }
    const user = session.user
      ? {
          ...session.user,
          ...(isAdminIdentity({ id: session.user.id, phone: session.user.phone }) ? { plan_type: 'pro' } : {}),
          is_admin: isAdminIdentity({ id: session.user.id, phone: session.user.phone }),
        }
      : null;
    return NextResponse.json({
      user,
      isLoggedIn: session.isLoggedIn || false,
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch {
    return NextResponse.json({ user: null, isLoggedIn: false }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }
}

// POST: 写入session（登录/更新用户信息）
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIP(req);
    const { allowed } = rateLimit(`api_session:${ip}`, { windowMs: 60 * 1000, maxRequests: 20 });
    if (!allowed) {
      return NextResponse.json({ error: '请求过于频繁' }, { status: 429 });
    }

    const session = await getSession();
    const body = await req.json();

    if (body.action === 'login' && body.user) {
      const authToken = typeof body.authToken === 'string' ? body.authToken : '';
      const userId = typeof body.user?.id === 'string' ? body.user.id : '';
      if (!verifyAuthProof(authToken, userId)) {
        return NextResponse.json({ error: '登录校验失败，请重试' }, { status: 401 });
      }
      const trustedUser = await readTrustedUser(userId);
      if (!trustedUser) {
        return NextResponse.json({ error: '用户信息不存在' }, { status: 404 });
      }
      const nextUser = toSessionUser(body.user, trustedUser);
      const isAdmin = isAdminIdentity({ id: nextUser.id, phone: nextUser.phone });
      if (isAdmin) {
        nextUser.is_admin = true;
        nextUser.plan_type = 'pro';
      }
      session.user = nextUser;
      session.isLoggedIn = true;
      await session.save();
      return NextResponse.json({ success: true, user: session.user });
    }

    if (body.action === 'update' && body.user) {
      if (!session.user?.id) {
        return NextResponse.json({ error: '未登录' }, { status: 401 });
      }
      const trustedUser = session.user?.id ? await readTrustedUser(session.user.id) : null;
      const safeClientPatch = {
        ...(typeof body.user.nickname === 'string' ? { nickname: body.user.nickname } : {}),
        ...(typeof body.user.avatar === 'string' ? { avatar: body.user.avatar } : {}),
      };
      session.user = trustedUser
        ? toSessionUser({ ...session.user, ...safeClientPatch }, trustedUser)
        : { ...session.user, ...safeClientPatch };
      await session.save();
      return NextResponse.json({ success: true, user: session.user });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Session操作失败' }, { status: 500 });
  }
}

// DELETE: 销毁session（登出）
export async function DELETE() {
  try {
    const session = await getSession();
    session.destroy();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '登出失败' }, { status: 500 });
  }
}
