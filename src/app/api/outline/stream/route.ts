import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

type OutlineStreamEvent =
  | { type: 'stage'; stage: 'analyzing' | 'planning' | 'generating' | 'polishing'; message: string }
  | { type: 'slides'; slides: unknown[]; current: number; total: number }
  | { type: 'complete'; data: unknown }
  | { type: 'error'; status: number; message: string };

type ParsedOutlinePayload = {
  title?: string;
  slides?: unknown[];
  [key: string]: unknown;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function encodeEvent(event: OutlineStreamEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 });
  }

  if (!body.inputText || typeof body.inputText !== 'string' || !body.inputText.trim()) {
    return NextResponse.json({ error: '请输入内容' }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const forwardIp = request.headers.get('x-forwarded-for') || '';
  const cookie = request.headers.get('cookie') || '';
  const authorization = request.headers.get('authorization') || '';
  const inputText = String(body.inputText || '');
  const textLength = inputText.length;
  const paragraphCount = inputText.split(/\n{2,}/).filter(Boolean).length;
  const requestedSlides = Number(body.slideCount || body.numCards || 0) || 8;
  const autoMode = Boolean(body.auto);
  const requestedMode = String(body.textMode || 'preserve');
  const detectedFileCount = (inputText.match(/\[附件:[^\]]+\]/g) || []).length;

  const modeLabel = autoMode
    ? '智能预处理'
    : requestedMode === 'generate'
      ? '扩充文本'
      : requestedMode === 'condense'
        ? '提炼文本'
        : '保持原样';

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const push = (event: OutlineStreamEvent) => {
        if (closed) return false;
        try {
          controller.enqueue(encodeEvent(event));
          return true;
        } catch {
          closed = true;
          return false;
        }
      };

      try {
        push({
          type: 'stage',
          stage: 'analyzing',
          message: `已接收素材：约${textLength}字，${Math.max(paragraphCount, 1)}段${detectedFileCount > 0 ? `，${detectedFileCount}个附件片段` : ''}`,
        });
        await sleep(120);
        push({
          type: 'stage',
          stage: 'planning',
          message: `正在按「${modeLabel}」处理方式整理内容，目标 ${requestedSlides} 页大纲...`,
        });

        const outlineRes = await fetch(`${origin}/api/outline`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': forwardIp,
            ...(cookie ? { cookie } : {}),
            ...(authorization ? { authorization } : {}),
          },
          body: JSON.stringify(body),
          cache: 'no-store',
        });

        push({ type: 'stage', stage: 'generating', message: '正在生成页面标题与关键要点...' });

        const raw = await outlineRes.text();
        let parsed: ParsedOutlinePayload | null = null;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = null;
        }

        if (!outlineRes.ok || !parsed) {
          const message = parsed && typeof parsed.error === 'string'
            ? parsed.error
            : 'AI 大纲服务暂时不可用，未生成任何大纲，请稍后重试';
          push({ type: 'error', status: outlineRes.status || 503, message });
          return;
        }

        const slides: unknown[] = Array.isArray(parsed.slides) ? parsed.slides : [];
        const progressive: unknown[] = [];

        for (let i = 0; i < slides.length; i++) {
          progressive.push(slides[i]);
          push({ type: 'slides', slides: [...progressive], current: i + 1, total: slides.length });
          await sleep(70);
        }

        push({ type: 'stage', stage: 'polishing', message: '正在做最终校验与参数对齐...' });
        await sleep(80);
        push({ type: 'complete', data: parsed });
      } catch (e: unknown) {
        console.warn('[outline/stream] generation failed:', getErrorMessage(e));
        if (!closed) {
          push({
            type: 'error',
            status: 503,
            message: '大纲生成连接中断，未生成任何大纲，请重试',
          });
        }
      } finally {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {}
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
