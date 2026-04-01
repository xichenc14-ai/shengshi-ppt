import { NextRequest, NextResponse } from 'next/server';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';

// 创建 Gamma 生成任务
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { inputText, textMode = 'generate', format = 'presentation', numCards = 8, exportAs = 'pptx', themeId } = body;

    if (!inputText || inputText.trim().length === 0) {
      return NextResponse.json({ error: '请输入内容' }, { status: 400 });
    }

    const apiKey = process.env.GAMMA_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gamma API Key 未配置' },
        { status: 500 }
      );
    }

    // 创建 Gamma 生成任务
    const gammaResponse = await fetch(`${GAMMA_API_BASE}/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({
        inputText: inputText.trim(),
        textMode,
        format,
        numCards,
        exportAs,
        ...(themeId && { themeId }),
      }),
    });

    if (!gammaResponse.ok) {
      const errText = await gammaResponse.text();
      console.error('Gamma API error:', gammaResponse.status, errText);
      return NextResponse.json(
        { error: `Gamma API 调用失败: ${gammaResponse.status}` },
        { status: 502 }
      );
    }

    const gammaData = await gammaResponse.json();
    const generationId = gammaData.generationId || gammaData.id;

    return NextResponse.json({
      generationId,
      message: '生成任务已创建',
    });
  } catch (error: any) {
    console.error('Gamma generation error:', error);
    return NextResponse.json(
      { error: error.message || '创建生成任务失败' },
      { status: 500 }
    );
  }
}

// 查询 Gamma 生成状态
export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.GAMMA_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gamma API Key 未配置' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const generationId = searchParams.get('id');

    if (!generationId) {
      return NextResponse.json({ error: '缺少 generationId' }, { status: 400 });
    }

    const response = await fetch(`${GAMMA_API_BASE}/generations/${generationId}`, {
      headers: {
        'X-API-KEY': apiKey,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `查询失败: ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Gamma status error:', error);
    return NextResponse.json(
      { error: error.message || '查询失败' },
      { status: 500 }
    );
  }
}
