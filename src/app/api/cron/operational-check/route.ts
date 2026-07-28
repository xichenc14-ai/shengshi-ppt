import { NextRequest, NextResponse } from 'next/server';
import { getRequestId, logOperationalEvent, sendOperationalAlert } from '@/lib/observability';
import { runReadinessChecks } from '@/lib/readiness';
import { cleanupExpiredGenerationRequests } from '@/lib/generation-idempotency';
import { cleanupExpiredTemporaryAttachments } from '@/lib/temporary-attachments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || '';
  const authorization = request.headers.get('authorization') || '';
  return Boolean(secret && authorization === `Bearer ${secret}`);
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  if (!authorized(request)) {
    logOperationalEvent('warn', 'operational_check.unauthorized', {
      requestId,
      route: '/api/cron/operational-check',
      status: 401,
    });
    return NextResponse.json({ error: 'unauthorized', requestId }, {
      status: 401,
      headers: { 'x-request-id': requestId },
    });
  }

  const result = await runReadinessChecks();
  let expiredTaskRecordsDeleted = 0;
  let expiredAttachmentsDeleted = 0;
  try {
    expiredTaskRecordsDeleted = await cleanupExpiredGenerationRequests();
  } catch (error) {
    await sendOperationalAlert('generation_request_cleanup.failed', {
      requestId,
      route: '/api/cron/operational-check',
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
  }
  try {
    expiredAttachmentsDeleted = await cleanupExpiredTemporaryAttachments();
  } catch (error) {
    await sendOperationalAlert('temporary_attachment_cleanup.failed', {
      requestId,
      route: '/api/cron/operational-check',
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
  }
  if (!result.ready) {
    await sendOperationalAlert('service.not_ready', {
      requestId,
      route: '/api/cron/operational-check',
      status: 503,
      metadata: { failedChecks: result.checks.filter((check) => !check.ok) },
    });
  } else {
    logOperationalEvent('info', 'operational_check.ready', {
      requestId,
      route: '/api/cron/operational-check',
      status: 200,
      metadata: { checks: result.checks },
    });
  }
  return NextResponse.json({ ok: result.ready, requestId, expiredTaskRecordsDeleted, expiredAttachmentsDeleted, ...result }, {
    status: result.ready ? 200 : 503,
    headers: { 'Cache-Control': 'no-store', 'x-request-id': requestId },
  });
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  if (!authorized(request)) {
    logOperationalEvent('warn', 'operational_alert_test.unauthorized', {
      requestId,
      route: '/api/cron/operational-check',
      status: 401,
    });
    return NextResponse.json({ error: 'unauthorized', requestId }, {
      status: 401,
      headers: { 'x-request-id': requestId },
    });
  }

  const delivery = await sendOperationalAlert('operational_alert.delivery_test', {
    requestId,
    route: '/api/cron/operational-check',
    status: 200,
    metadata: { source: 'commercial_postdeploy_check' },
  });
  const status = delivery.sent ? 200 : 503;
  logOperationalEvent(delivery.sent ? 'info' : 'error', 'operational_alert_test.completed', {
    requestId,
    route: '/api/cron/operational-check',
    status,
    metadata: { sent: delivery.sent, reason: delivery.reason },
  });
  return NextResponse.json({ ok: delivery.sent, requestId, delivery }, {
    status,
    headers: { 'Cache-Control': 'no-store', 'x-request-id': requestId },
  });
}
