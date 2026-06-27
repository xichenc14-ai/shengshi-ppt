import { NextResponse } from 'next/server';

const DISABLED_MESSAGE = '积分充值功能已关闭，请通过会员套餐获取积分额度';

export async function GET() {
  return NextResponse.json({ error: DISABLED_MESSAGE, packages: [] }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({ error: DISABLED_MESSAGE }, { status: 410 });
}
