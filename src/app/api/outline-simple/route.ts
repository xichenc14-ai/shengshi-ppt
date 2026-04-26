import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const { inputText, slideCount = 5 } = await req.json();
  
  if (!inputText?.trim()) {
    return NextResponse.json({ error: '请输入内容' }, { status: 400 });
  }

  const systemPrompt = 'PPT大纲生成器。返回JSON:{title,slides:[{title,content:[],notes}]}';
  const userPrompt = `生成${slideCount}页PPT大纲：${inputText}`;
  
  const apiKey = process.env.GLM_API_KEYS?.split(',')[0];
  if (!apiKey) {
    return NextResponse.json({ error: 'GLM API Key未配置' }, { status: 500 });
  }

  console.log('[Outline-Simple] Calling GLM...');
  const startTime = Date.now();
  
  try {
    const res = await fetch('https://mydamoxing.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'glm-5',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 2048,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(29000),
    });

    console.log('[Outline-Simple] GLM responded in', Date.now() - startTime, 'ms, status:', res.status);

    if (!res.ok) {
      const err = await res.text();
      console.error('[Outline-Simple] GLM error:', res.status, err);
      return NextResponse.json({ error: `GLM失败: ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      return NextResponse.json({ error: 'GLM返回空内容' }, { status: 500 });
    }

    // 尝试解析JSON
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      // 如果不是纯JSON，尝试提取JSON部分
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        return NextResponse.json({ error: '无法解析大纲JSON', raw: content.substring(0, 200) }, { status: 500 });
      }
    }

    return NextResponse.json(parsed);
  } catch (e: any) {
    console.error('[Outline-Simple] Error:', e.message);
    return NextResponse.json({ error: e.message || '请求超时' }, { status: 500 });
  }
}