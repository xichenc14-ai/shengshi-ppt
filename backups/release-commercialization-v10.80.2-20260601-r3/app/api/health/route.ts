import { NextResponse } from 'next/server';
import { APP_VERSION } from '@/lib/version';

export async function GET() {
  const now = new Date();

  return NextResponse.json({
    status: 'ok',
    service: 'shengxin-ppt',
    version: APP_VERSION,
    timestamp: now.toISOString(),
    env: process.env.NODE_ENV || 'unknown',
  }, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
