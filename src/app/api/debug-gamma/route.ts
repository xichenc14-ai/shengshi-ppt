import { NextResponse } from 'next/server';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';

export async function GET() {
  const apiKey = process.env.GAMMA_API_KEY;

  // Step 1: 创建一个带 exportAs 的生成任务
  const createRes = await fetch(`${GAMMA_API_BASE}/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey!,
    },
    body: JSON.stringify({
      inputText: "# 测试\n\n---\n\n## 页1\n\n- 内容",
      textMode: "generate",
      format: "presentation",
      numCards: 2,
      exportAs: "pptx",
      themeId: "default-light",
      textOptions: { amount: "medium", tone: "professional", language: "zh-cn" },
      imageOptions: { source: "noImages" },
      cardOptions: { dimensions: "16x9" }
    }),
  });

  const createData = await createRes.json();

  // Step 2: 等 30 秒后查询状态
  await new Promise(r => setTimeout(r, 30000));

  const statusRes = await fetch(`${GAMMA_API_BASE}/generations/${createData.generationId || createData.id}`, {
    headers: { 'X-API-KEY': apiKey! },
  });

  const statusData = await statusRes.json();

  return NextResponse.json({
    step1_create: {
      status: createRes.status,
      data: createData,
    },
    step2_status: {
      status: statusRes.status,
      data: statusData,
    },
    allKeys: Object.keys(statusData),
  });
}
