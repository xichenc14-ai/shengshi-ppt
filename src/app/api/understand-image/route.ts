import { NextRequest, NextResponse } from 'next/server';
import { understandImage } from '@/lib/image-understand';

export async function POST(request: NextRequest) {
  try {
    const { image, mimeType } = await request.json();

    if (!image || !mimeType) {
      return NextResponse.json({ error: '缺少图片数据' }, { status: 400 });
    }

    const text = await understandImage(image, mimeType);
    return NextResponse.json({ text });
  } catch (error: any) {
    console.error('Understand image error:', error);
    return NextResponse.json({ error: '图片识别失败', text: '[图片内容无法识别]' }, { status: 500 });
  }
}
