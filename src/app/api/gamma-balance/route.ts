import { NextResponse } from 'next/server';

// GET: 查询 Gamma API 余额（管理/监控用）
export async function GET() {
  try {
    const apiKey = process.env.GAMMA_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gamma API Key 未配置' }, { status: 500 });
    }

    const response = await fetch('https://public-api.gamma.app/v1.0/account', {
      headers: { 'X-API-KEY': apiKey },
    });

    if (!response.ok) {
      return NextResponse.json({ error: '查询失败', status: response.status }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json({
      credits: data.credits ?? data.creditBalance ?? 0,
      raw: data,
      checkedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
