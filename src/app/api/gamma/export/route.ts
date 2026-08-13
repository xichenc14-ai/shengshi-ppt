import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSession } from '@/lib/session';
import { distributedRateLimit } from '@/lib/rate-limit';
import { getAllKeys, recordKeyFailure, selectBestKey } from '@/lib/gamma-key-pool';
import {
  createGammaExport,
  getArtifactExtension,
  getArtifactMimeType,
  getGammaExport,
  isGammaExportFormat,
  validateGammaExportBuffer,
  type GammaExportFormat,
} from '@/lib/gamma-export';
import {
  buildArtifactObjectKey,
  formatStorageError,
  isArtifactAccelerationEnabled,
  putArtifactObject,
  sanitizeDownloadFilename,
  sha256Hex,
} from '@/lib/artifact-storage';

export const runtime = 'nodejs';
export const preferredRegion = 'hkg1';
export const maxDuration = 60;

type ArtifactRow = {
  id: string;
  user_id: string;
  generation_id: string;
  gamma_id: string | null;
  export_id: string | null;
  format: GammaExportFormat;
  object_key: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  sha256: string | null;
  status: 'pending' | 'ready' | 'failed';
  error_message: string | null;
};

type GenerationRequestRow = {
  provider_generation_id: string;
  gamma_id: string | null;
  provider_key_ref: string | null;
};

type Supabase = NonNullable<ReturnType<typeof getSupabase>>;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function errorResponse(generationId: string, code: string, message: string, status: number) {
  return NextResponse.json({
    generationId,
    status: 'failed',
    error: { code, message },
  }, { status });
}

function getFilename(raw: unknown, format: GammaExportFormat): string {
  const base = sanitizeDownloadFilename(String(raw || '省心PPT'), '省心PPT');
  const extension = getArtifactExtension(format);
  const withoutExtension = base.replace(/\.(pdf|pptx|png|zip)$/i, '');
  return `${withoutExtension}.${extension}`;
}

async function getRequiredUserId(): Promise<string | null> {
  const session = await getSession();
  return session.isLoggedIn ? (session.user?.id || null) : null;
}

async function getGenerationContext(
  sb: Supabase,
  generationId: string,
  userId: string,
): Promise<GenerationRequestRow | null> {
  if (!sb) return null;
  const { data, error } = await sb
    .from('generation_requests')
    .select('provider_generation_id,gamma_id,provider_key_ref')
    .eq('provider_generation_id', generationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    if (String(error.message || '').includes('gamma_id') || String(error.message || '').includes('provider_key_ref')) {
      // The migration can be applied independently from a rolling deployment.
      return null;
    }
    throw error;
  }
  return data as GenerationRequestRow | null;
}

async function resolveGammaId(
  sb: Supabase,
  generationId: string,
  userId: string,
  existing: GenerationRequestRow,
): Promise<{ gammaId: string; apiKey: string } | null> {
  if (existing.gamma_id) {
    const selected = await selectBestKey();
    return { gammaId: existing.gamma_id, apiKey: selected.key };
  }

  const keys = await getAllKeys();
  const lastKey = keys[0];
  for (const keyInfo of [await selectBestKey(), ...keys.filter((item) => item.key !== lastKey?.key)]) {
    const response = await fetch(`https://public-api.gamma.app/v1.0/generations/${encodeURIComponent(generationId)}`, {
      headers: { 'X-API-KEY': keyInfo.key },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      if ([401, 403, 429, 500, 502, 503, 504].includes(response.status)) {
        await recordKeyFailure(keyInfo.key);
        continue;
      }
      return null;
    }
    const payload = await response.json() as Record<string, unknown>;
    const gammaId = typeof payload.gammaId === 'string' ? payload.gammaId.trim() : '';
    if (!gammaId) continue;

    await sb
      .from('generation_requests')
      .update({ gamma_id: gammaId, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('provider_generation_id', generationId);
    return { gammaId, apiKey: keyInfo.key };
  }
  return null;
}

async function getReadyArtifact(
  sb: Supabase,
  generationId: string,
  userId: string,
  format: GammaExportFormat,
): Promise<ArtifactRow | null> {
  if (!sb) return null;
  const { data, error } = await sb
    .from('generation_artifacts')
    .select('*')
    .eq('generation_id', generationId)
    .eq('user_id', userId)
    .eq('format', format)
    .maybeSingle();
  if (error) throw error;
  return data as ArtifactRow | null;
}

function artifactResponse(artifact: ArtifactRow) {
  return {
    artifactId: artifact.id,
    generationId: artifact.generation_id,
    gammaId: artifact.gamma_id,
    exportId: artifact.export_id,
    format: artifact.format,
    status: artifact.status === 'ready' ? 'ready' : artifact.status === 'failed' ? 'failed' : 'pending',
    error: artifact.error_message ? { code: 'EXPORT_FAILED', message: artifact.error_message } : undefined,
    downloadUrl: artifact.status === 'ready' ? `/api/artifacts/${encodeURIComponent(artifact.id)}/download` : undefined,
    previewUrl: artifact.status === 'ready' && artifact.format === 'pdf'
      ? `/api/artifacts/${encodeURIComponent(artifact.id)}/preview`
      : undefined,
  };
}

async function markArtifactFailed(
  sb: Supabase,
  artifactId: string,
  message: string,
) {
  await sb?.from('generation_artifacts').update({
    status: 'failed',
    error_message: message.slice(0, 500),
    updated_at: new Date().toISOString(),
  }).eq('id', artifactId);
}

async function materializeArtifact(
  sb: Supabase,
  artifact: ArtifactRow,
  apiKey: string,
  exportUrl: string,
): Promise<ArtifactRow> {
  if (!isArtifactAccelerationEnabled()) {
    throw new Error('导出文件存储未配置，请配置 R2 后重试');
  }

  const response = await fetch(exportUrl, {
    headers: { 'User-Agent': 'shengxin-ppt/independent-export' },
    redirect: 'follow',
    cache: 'no-store',
    signal: AbortSignal.timeout(45_000),
  });
  let buffer = Buffer.from(await response.arrayBuffer());
  if (!response.ok || !validateGammaExportBuffer(artifact.format, buffer)) {
    const retry = await fetch(exportUrl, {
      headers: { 'User-Agent': 'shengxin-ppt/independent-export', 'X-API-KEY': apiKey },
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(45_000),
    });
    if (!retry.ok) throw new Error(`${artifact.format.toUpperCase()} 文件下载失败: ${retry.status}`);
    buffer = Buffer.from(await retry.arrayBuffer());
  }
  if (!validateGammaExportBuffer(artifact.format, buffer)) {
    throw new Error(`${artifact.format.toUpperCase()} 文件校验失败，上游返回的文件不完整`);
  }

  const sha256 = sha256Hex(buffer);
  const objectKey = buildArtifactObjectKey(artifact.format, artifact.generation_id, sha256);
  const stored = await putArtifactObject({
    key: objectKey,
    body: buffer,
    contentType: getArtifactMimeType(artifact.format),
    filename: artifact.filename,
  });
  const { data, error } = await sb
    .from('generation_artifacts')
    .update({
      object_key: objectKey,
      size_bytes: stored.sizeBytes,
      sha256: stored.sha256,
      status: 'ready',
      source_url_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', artifact.id)
    .select('*')
    .single();
  if (error || !data) throw error || new Error('导出产物元数据保存失败');
  return data as ArtifactRow;
}

export async function POST(request: NextRequest) {
  const userId = await getRequiredUserId();
  if (!userId) return errorResponse('', 'UNAUTHENTICATED', '请先登录', 401);
  const rate = await distributedRateLimit(`gamma_export_create:${userId}`, { windowMs: 60_000, maxRequests: 20 });
  if (!rate.allowed) return errorResponse('', 'RATE_LIMITED', '导出请求过于频繁，请稍后再试', 429);

  const sb = getSupabase();
  if (!sb) return errorResponse('', 'SERVICE_NOT_CONFIGURED', '导出服务未配置', 503);

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const generationId = String(body.generationId || '').trim();
  const format = String(body.format || '').toLowerCase();
  if (!generationId) return errorResponse('', 'MISSING_ID', '缺少 generationId', 400);
  if (!isGammaExportFormat(format)) return errorResponse(generationId, 'INVALID_FORMAT', '仅支持 PDF、PPTX、PNG 三种格式', 400);

  try {
    const existingContext = await getGenerationContext(sb, generationId, userId);
    if (!existingContext) return errorResponse(generationId, 'GENERATION_NOT_FOUND', '生成任务不存在或尚未保存 gammaId', 404);

    const filename = getFilename(body.filename, format);
    const pendingObjectKey = `pending/${generationId}/${format}`;
    let artifact = await getReadyArtifact(sb, generationId, userId, format);
    if (artifact?.status === 'ready') return NextResponse.json(artifactResponse(artifact));
    if (artifact?.status === 'pending' && artifact.export_id) return NextResponse.json(artifactResponse(artifact));

    const context = await resolveGammaId(sb, generationId, userId, existingContext);
    if (!context) return errorResponse(generationId, 'GAMMA_ID_NOT_READY', 'Gamma 文稿仍在同步，请稍后重试', 409);

    const { data: upserted, error: upsertError } = await sb
      .from('generation_artifacts')
      .upsert({
        ...(artifact?.id ? { id: artifact.id } : {}),
        user_id: userId,
        generation_id: generationId,
        gamma_id: context.gammaId,
        format,
        object_key: artifact?.object_key || pendingObjectKey,
        filename,
        mime_type: getArtifactMimeType(format),
        size_bytes: 0,
        status: 'pending',
        error_message: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'generation_id,format' })
      .select('*')
      .single();
    if (upsertError || !upserted) throw upsertError || new Error('导出任务保存失败');
    artifact = upserted as ArtifactRow;
    if (artifact.export_id) return NextResponse.json(artifactResponse(artifact));

    const created = await createGammaExport(context.apiKey, context.gammaId, format);
    const { data: updated, error: updateError } = await sb
      .from('generation_artifacts')
      .update({
        gamma_id: context.gammaId,
        export_id: created.exportId,
        status: created.status === 'completed' ? 'pending' : 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', artifact.id)
      .select('*')
      .single();
    if (updateError || !updated) throw updateError || new Error('导出任务状态保存失败');
    return NextResponse.json(artifactResponse(updated as ArtifactRow));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '导出任务创建失败';
    return errorResponse(generationId, 'EXPORT_CREATE_FAILED', message, 502);
  }
}

export async function GET(request: NextRequest) {
  const userId = await getRequiredUserId();
  if (!userId) return errorResponse('', 'UNAUTHENTICATED', '请先登录', 401);
  const rate = await distributedRateLimit(`gamma_export_status:${userId}`, { windowMs: 60_000, maxRequests: 90 });
  if (!rate.allowed) return errorResponse('', 'RATE_LIMITED', '导出状态查询过于频繁，请稍后再试', 429);

  const sb = getSupabase();
  if (!sb) return errorResponse('', 'SERVICE_NOT_CONFIGURED', '导出服务未配置', 503);
  const { searchParams } = new URL(request.url);
  const artifactId = String(searchParams.get('artifactId') || '').trim();
  if (!artifactId) return errorResponse('', 'MISSING_ID', '缺少 artifactId', 400);

  try {
    const { data, error } = await sb
      .from('generation_artifacts')
      .select('*')
      .eq('id', artifactId)
      .eq('user_id', userId)
      .single();
    if (error || !data) return errorResponse('', 'ARTIFACT_NOT_FOUND', '导出文件不存在', 404);
    const artifact = data as ArtifactRow;
    if (artifact.status === 'ready' || artifact.status === 'failed') {
      return NextResponse.json(artifactResponse(artifact));
    }
    if (!artifact.gamma_id || !artifact.export_id) {
      return NextResponse.json(artifactResponse(artifact), { status: 202 });
    }

    const keyInfo = await selectBestKey();
    const status = await getGammaExport(keyInfo.key, artifact.export_id);
    if (status.status === 'failed') {
      const message = status.error?.message || status.error?.reason || 'Gamma 导出失败';
      await markArtifactFailed(sb, artifact.id, message);
      return NextResponse.json({ ...artifactResponse({ ...artifact, status: 'failed', error_message: message }), error: { code: status.error?.reason || 'EXPORT_FAILED', message } }, { status: 502 });
    }
    if (status.status !== 'completed' || !status.exportUrl) {
      return NextResponse.json(artifactResponse(artifact), { status: 202 });
    }

    const ready = await materializeArtifact(sb, artifact, keyInfo.key, status.exportUrl);
    return NextResponse.json(artifactResponse(ready));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '导出状态查询失败';
    console.error('[GammaExport] status failed:', message);
    try {
      const { data } = await sb.from('generation_artifacts').select('id,generation_id').eq('id', artifactId).eq('user_id', userId).maybeSingle();
      if (data?.id && /校验失败|存储未配置|文件下载失败|文件不完整/.test(message)) await markArtifactFailed(sb, artifactId, message);
    } catch (metadataError) {
      console.error('[GammaExport] metadata update failed:', formatStorageError(metadataError));
    }
    return errorResponse('', 'EXPORT_STATUS_FAILED', message, 502);
  }
}
