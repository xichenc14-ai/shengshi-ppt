import { NextResponse } from 'next/server';

const DISABLED_MESSAGE = '站内水印预览入口已禁用。请改用 /api/export-pdf 或 /api/export-pptx 获取文件。';

export async function GET() {
  return NextResponse.json({
    error: DISABLED_MESSAGE,
    code: 'GAMMA_WATERMARK_PREVIEW_DISABLED',
  }, { status: 410 });
}
