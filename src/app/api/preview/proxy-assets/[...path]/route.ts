import { NextResponse } from 'next/server';

const DISABLED_MESSAGE = '站内已禁用 Gamma 资源代理预览。请改用 /api/export-pdf 或 /api/export-pptx 获取文件。';

export async function GET() {
  return NextResponse.json({
    error: DISABLED_MESSAGE,
    code: 'GAMMA_PROXY_ASSETS_DISABLED',
  }, { status: 410 });
}
