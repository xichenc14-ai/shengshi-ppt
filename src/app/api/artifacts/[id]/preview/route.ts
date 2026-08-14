import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createArtifactSignedDownloadUrl, sanitizeDownloadFilename } from '@/lib/artifact-storage';
import { distributedRateLimit, getClientIP } from '@/lib/rate-limit';
import { getSession } from '@/lib/session';

type ArtifactRow = {
  id: string;
  user_id?: string | null;
  object_key: string;
  filename: string;
  mime_type: string;
  format: string;
  status: string;
};

export const runtime = 'nodejs';
export const preferredRegion = 'hkg1';
export const maxDuration = 60;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const ip = getClientIP(request);
  const { allowed } = await distributedRateLimit(`artifact_preview:${ip}`, { windowMs: 60_000, maxRequests: 40 });
  if (!allowed) return NextResponse.json({ error: '请求过于频繁' }, { status: 429 });

  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: '缺少文件ID' }, { status: 400 });

  try {
    const { data, error } = await sb
      .from('generation_artifacts')
      .select('id,user_id,object_key,filename,mime_type,format,status')
      .eq('id', id)
      .single();
    if (error || !data) return NextResponse.json({ error: '文件不存在或已过期' }, { status: 404 });

    const artifact = data as ArtifactRow;
    if (artifact.format !== 'pdf') return NextResponse.json({ error: '只有 PDF 支持在线预览' }, { status: 400 });
    if (artifact.status !== 'ready') return NextResponse.json({ error: '文件尚未准备好' }, { status: 409 });

    const session = await getSession();
    if (!session.isLoggedIn || session.user?.id !== artifact.user_id) {
      return NextResponse.json({ error: '无权限预览该文件' }, { status: 403 });
    }

    const signedUrl = await createArtifactSignedDownloadUrl({
      key: artifact.object_key,
      filename: artifact.filename,
      contentType: artifact.mime_type || 'application/pdf',
      disposition: 'inline',
    });
    // Keep PDF.js on the same origin. Redirecting to the R2 signed URL makes
    // the browser fetch cross-origin and fails before PDF.js can read bytes.
    const upstream = await fetch(signedUrl, {
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(45_000),
    });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: `预览文件读取失败：${upstream.status}` }, { status: 502 });
    }

    const filename = sanitizeDownloadFilename(artifact.filename, 'shengxin-ppt.pdf');
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Cache-Control': 'private, max-age=0, no-store',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Type': artifact.mime_type || 'application/pdf',
      },
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '预览失败' }, { status: 500 });
  }
}
