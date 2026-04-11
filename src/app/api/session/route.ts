import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

// GET: 读取当前session
export async function GET() {
  try {
    const session = await getSession();
    return NextResponse.json({
      user: session.user || null,
      isLoggedIn: session.isLoggedIn || false,
    });
  } catch {
    return NextResponse.json({ user: null, isLoggedIn: false });
  }
}

// POST: 写入session（登录/更新用户信息）
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const body = await req.json();

    if (body.action === 'login' && body.user) {
      session.user = body.user;
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
