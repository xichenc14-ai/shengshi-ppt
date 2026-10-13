import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { inspectAuthReadiness } from '@/lib/auth-readiness';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'hnd1';

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return NextResponse.json({ error: '无权限' }, { status: 403 });
  const result = await inspectAuthReadiness();
  return NextResponse.json(result, { status: result.ready ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
