import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createArtifactSignedDownloadUrl } from '@/lib/artifact-storage';
import { distributedRateLimit, getClientIP } from '@/lib/rate-limit';
import { getSession } from '@/lib/session';

type ArtifactRow = {
  id: string;
  user_id?: string | null;
  object_key: string;
  filename: string;
  mime_type: string;
  status: string;
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ip = getClientIP(request);
  const { allowed } = await distributedRateLimit(`artifact_download:${ip}`, { windowMs: 60000, maxRequests: 30 });
  if (!allowed) return NextResponse.json({ error: '请求过于频繁' }, { status: 429 });

  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: '缺少文件ID' }, { status: 400 });

  try {
    const { data, error } = await sb
      .from('generation_artifacts')
      .select('id,user_id,object_key,filename,mime_type,status')
      .eq('id', id)
      .single();

    if (error || !data) return NextResponse.json({ error: '文件不存在或已过期' }, { status: 404 });

    const artifact = data as ArtifactRow;
    if (artifact.status !== 'ready') return NextResponse.json({ error: '文件尚未准备好' }, { status: 409 });

    if (artifact.user_id) {
      const session = await getSession();
      if (!session.isLoggedIn || session.user?.id !== artifact.user_id) {
        return NextResponse.json({ error: '无权限下载该文件' }, { status: 403 });
      }
    }

    const signedUrl = await createArtifactSignedDownloadUrl({
      key: artifact.object_key,
      filename: artifact.filename,
      contentType: artifact.mime_type,
    });

    return NextResponse.redirect(signedUrl, { status: 307 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '下载失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
