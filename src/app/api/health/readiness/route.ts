export const runtime = 'nodejs';
export const preferredRegion = 'hnd1';

import { NextRequest, NextResponse } from 'next/server';
import { APP_VERSION } from '@/lib/version';
import { getRequestId, logOperationalEvent } from '@/lib/observability';
import { runReadinessChecks } from '@/lib/readiness';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const startedAt = Date.now();
  const result = await runReadinessChecks();
  logOperationalEvent(result.ready ? 'info' : 'error', 'service.readiness', {
    requestId,
    route: '/api/health/readiness',
    durationMs: Date.now() - startedAt,
    status: result.ready ? 200 : 503,
    metadata: { checks: result.checks },
  });
  return NextResponse.json({
    status: result.ready ? 'ready' : 'not_ready',
    service: 'shengxin-ppt',
    version: APP_VERSION,
    requestId,
    ...result,
  }, {
    status: result.ready ? 200 : 503,
    headers: { 'Cache-Control': 'no-store', 'x-request-id': requestId },
  });
}
