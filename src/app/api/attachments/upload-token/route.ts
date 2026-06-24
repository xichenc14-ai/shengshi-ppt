import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import {
  getAttachmentPolicy,
  getFileExtension,
  isPaidPlan,
  isImageExtension,
  validateAttachmentMeta,
  type AttachmentMode,
} from '@/lib/attachment-policy';
import { getClientIP, rateLimit } from '@/lib/rate-limit';

const BUCKET = 'temporary-attachments';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function ensureBucket(sb: NonNullable<ReturnType<typeof getSupabase>>) {
  const { data } = await sb.storage.getBucket(BUCKET);
  if (data) return;
  const { error } = await sb.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: '10MB',
    allowedMimeTypes: [
      'text/plain', 'text/markdown', 'text/csv',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/png', 'image/jpeg', 'image/webp',
      'application/octet-stream',
    ],
  });
  if (error && !/already exists/i.test(error.message)) throw error;
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const { allowed } = rateLimit(`attachment_token:${ip}`, { windowMs: 60_000, maxRequests: 20 });
  if (!allowed) return NextResponse.json({ error: '上传请求过于频繁' }, { status: 429 });

  const session = await getSession();
  if (!session.isLoggedIn || !session.user?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const mode: AttachmentMode = body?.mode === 'smart' ? 'smart' : 'direct';
    if (mode === 'smart' && !isPaidPlan(session.user.plan_type)) {
      return NextResponse.json({ error: '省心模式为会员专享功能' }, { status: 403 });
    }
    const policy = getAttachmentPolicy(session.user.plan_type, mode);
    const file = {
      name: String(body?.name || '').slice(0, 180),
      size: Number(body?.size || 0),
    };
    const error = validateAttachmentMeta(file, policy);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const batchCount = Math.max(0, Number(body?.batchCount || 0));
    const batchBytes = Math.max(0, Number(body?.batchBytes || 0));
    if (batchCount + 1 > policy.maxFiles) {
      return NextResponse.json({ error: `最多上传${policy.maxFiles}个附件` }, { status: 400 });
    }
    if (batchBytes + file.size > policy.maxTotalBytes) {
      return NextResponse.json({ error: `附件总大小超过${Math.round(policy.maxTotalBytes / 1024 / 1024)}MB` }, { status: 400 });
    }

    const sb = getSupabase();
    if (!sb) return NextResponse.json({ error: '附件存储服务未配置' }, { status: 503 });
    await ensureBucket(sb);

    const extension = getFileExtension(file.name);
    const path = `${session.user.id}/${Date.now()}-${randomUUID()}${extension}`;
    const { data, error: signError } = await sb.storage
      .from(BUCKET)
      .createSignedUploadUrl(path, { upsert: false });
    if (signError || !data) throw signError || new Error('无法创建上传令牌');

    return NextResponse.json({
      bucket: BUCKET,
      path,
      token: data.token,
      signedUrl: data.signedUrl,
      isImage: isImageExtension(extension),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '创建上传任务失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
