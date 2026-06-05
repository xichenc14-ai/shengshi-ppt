import { NextRequest, NextResponse } from 'next/server';
import { getClientIP, rateLimit } from '@/lib/rate-limit';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'text/plain', 'text/markdown',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp',
];

// 简单的文本提取（实际生产中建议用专门的文档解析服务）
async function extractText(file: File): Promise<string> {
  const type = file.type || file.name;

  // 纯文本
  if (type.startsWith('text/') || /\.(txt|md|csv)$/i.test(file.name)) {
    return await file.text();
  }

  // 图片 - 用AI理解
  if (type.startsWith('image/') || /\.(png|jpg|jpeg|webp)$/i.test(file.name)) {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/understand-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mimeType: file.type || 'image/jpeg' }),
      });
      const data = await res.json();
      return data.text || `[图片: ${file.name}]`;
    } catch {
      return `[图片: ${file.name}]`;
    }
  }

  // Word/Excel - 返回占位提示（完整解析需要 mammoth/pdf-parse 等库）
  if (type.includes('document') || type.includes('sheet') || /\.(doc|docx|xls|xlsx)$/i.test(file.name)) {
    return `[文档: ${file.name}] 请手动复制内容到输入框`;
  }

  // PDF
  if (type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    return `[PDF文档: ${file.name}] 请手动复制内容到输入框`;
  }

  return `[文件: ${file.name}]`;
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const { allowed } = rateLimit(`upload:${ip}`, { windowMs: 60000, maxRequests: 10 });
  if (!allowed) return NextResponse.json({ error: '上传过于频繁，请稍后再试' }, { status: 429 });

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) return NextResponse.json({ error: '请选择文件' }, { status: 400 });

    // 文件大小检查
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `文件过大，最大支持10MB` }, { status: 400 });
    }

    // 类型检查
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const allowedExts = ['.txt', '.md', '.csv', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg', '.webp'];
    if (!ALLOWED_TYPES.includes(file.type) && !allowedExts.includes(ext)) {
      return NextResponse.json({ error: `不支持的文件类型，仅支持: ${allowedExts.join(' ')}` }, { status: 400 });
    }

    // 提取文本内容
    const content = await extractText(file);

    return NextResponse.json({
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      content,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '上传失败' }, { status: 500 });
  }
}
