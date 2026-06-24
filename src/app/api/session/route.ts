import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSession } from '@/lib/session';
import { verifyAuthProof } from '@/lib/auth-proof';
import { getClientIP, rateLimit } from '@/lib/rate-limit';
import { isAdminIdentity } from '@/lib/admin-auth';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function readTrustedUser(userId: string) {
  const sb = getSupabase();
  if (!sb) return null;
  const withExpiry = await sb
    .from('users')
    .select('id,phone,nickname,avatar,credits,plan_type,plan_expires_at,is_active')
    .eq('id', userId)
    .single();
  if (!withExpiry.error && withExpiry.data) return withExpiry.data;
  const fallback = await sb
    .from('users')
    .select('id,phone,nickname,avatar,credits,plan_type,is_active')
    .eq('id', userId)
    .single();
  return fallback.data || null;
}

// GET: 读取当前session
export async function GET() {
  try {
    const session = await getSession();
    const trustedUser = session.user?.id ? await readTrustedUser(session.user.id) : null;
    if (trustedUser && session.user) {
      session.user = {
        ...session.user,
        ...trustedUser,
        credits: Number(trustedUser.credits || 0),
      };
      await session.save();
    }
    const user = session.user
      ? {
          ...session.user,
          is_admin: isAdminIdentity({ id: session.user.id, phone: session.user.phone }),
        }
      : null;
    return NextResponse.json({
      user,
      isLoggedIn: session.isLoggedIn || false,
    });
  } catch {
    return NextResponse.json({ user: null, isLoggedIn: false });
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
      const nextUser = {
        ...body.user,
        ...trustedUser,
        credits: Number(trustedUser.credits || 0),
      };
      const isAdmin = isAdminIdentity({ id: nextUser.id, phone: nextUser.phone });
      if (isAdmin) {
        nextUser.is_admin = true;
      }
      session.user = nextUser;
      session.isLoggedIn = true;
      await session.save();
      return NextResponse.json({ success: true, user: session.user });
    }

    if (body.action === 'update' && body.user) {
      session.user = { ...session.user, ...body.user };
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
