import { NextRequest, NextResponse } from 'next/server';

/**
 * Legacy compat route.
 * 旧的 /api/smart-outline 已并入 /api/outline（统一管线）。
 * 这里保留轻量转发，避免历史客户端直接报错。
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const origin = new URL(request.url).origin;
    const forwardIp = request.headers.get('x-forwarded-for') || '';

    const res = await fetch(`${origin}/api/outline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': forwardIp,
        'x-legacy-route': 'smart-outline',
      },
      body: JSON.stringify({
        ...body,
        auto: true,
      }),
      cache: 'no-store',
    });

    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'application/json; charset=utf-8',
        'x-api-deprecated': 'true',
        'x-api-replacement': '/api/outline',
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'smart-outline legacy proxy error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
