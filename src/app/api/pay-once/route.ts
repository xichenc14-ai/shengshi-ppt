import { NextResponse } from 'next/server';

const DISABLED_MESSAGE = '单次付费下载通道已关闭，当前统一按积分结算。';

export async function GET() {
  return NextResponse.json({ error: DISABLED_MESSAGE }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({ error: DISABLED_MESSAGE }, { status: 410 });
}
