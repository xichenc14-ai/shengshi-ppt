import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const { inputText } = await req.json();
  
  const apiKey = process.env.GLM_API_KEYS?.split(',').filter(Boolean)[0];
  console.log('[GLM-Test] apiKey length:', apiKey?.length);
  
  if (!apiKey) {
    return NextResponse.json({ error: 'GLM_KEY missing' }, { status: 500 });
  }

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
          { role: 'system', content: 'PPT大纲生成器。返回JSON:{title,slides:[{title,content:[],notes}]}' },
          { role: 'user', content: `生成3页PPT大纲：${inputText || 'AI趋势'}` },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    console.log('[GLM-Test] Response time:', Date.now() - startTime, 'ms, status:', res.status);

    if (!res.ok) {
      const err = await res.text();
      console.error('[GLM-Test] Error:', err);
      return NextResponse.json({ error: `GLM ${res.status}`, detail: err.substring(0,200) }, { status: 502 });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    
    console.log('[GLM-Test] Content length:', content?.length);
    
    return NextResponse.json({ 
      success: true,
      timeMs: Date.now() - startTime,
      content: content?.substring(0, 500),
      fullResponse: JSON.stringify(data).substring(0, 500)
    });
  } catch (e: any) {
    console.error('[GLM-Test] Exception:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}