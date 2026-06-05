import { NextRequest, NextResponse } from 'next/server';
import { callDeepSeek } from '@/lib/deepseek-client';

type DiagnosticResult = {
  minimaxKey: '存在' | '不存在';
  deepseekKey: '存在' | '不存在';
  deepseekTest?: { success?: boolean; response?: string; error?: string };
  minimaxTest?: { status?: number; response?: string | null; error?: unknown };
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'diagnostic disabled in production' }, { status: 403 });
    }

    const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
    const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
    
    const results: DiagnosticResult = {
      minimaxKey: MINIMAX_API_KEY ? '存在' : '不存在',
      deepseekKey: DEEPSEEK_API_KEY ? '存在' : '不存在',
    };

    // 测试 DeepSeek
    if (DEEPSEEK_API_KEY) {
      try {
        const response = await callDeepSeek(
          [
            { role: 'user', content: '用JSON返回：{"reply":"ok","message":"DeepSeek正常"}' }
          ],
          { timeoutMs: 15000, maxTokens: 100 }
        );
        results.deepseekTest = { success: true, response: response.substring(0, 200) };
      } catch (e: unknown) {
        results.deepseekTest = { success: false, error: getErrorMessage(e) };
      }
    } else {
      results.deepseekTest = { error: 'DEEPSEEK_API_KEY 不存在' };
    }

    // 测试 Minimax
    if (MINIMAX_API_KEY) {
      try {
        const response = await fetch('https://api.minimaxi.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${MINIMAX_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'MiniMax-M2.7',
            messages: [{ role: 'user', content: '用JSON返回：{"reply":"ok"}' }],
            max_tokens: 100,
          }),
        });
        const data = await response.json();
        results.minimaxTest = {
          status: response.status,
          response: data.choices?.[0]?.message?.content?.substring(0, 200) || null,
          error: data.error || null,
        };
      } catch (e: unknown) {
        results.minimaxTest = { error: getErrorMessage(e) };
      }
    }

    return NextResponse.json(results);
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}
