// 图片理解：Kimi K2.5 优先 → MiniMax VL 备用
// Kimi 多模态能力强，128K 上下文

export async function understandImage(base64Data: string, mimeType: string): Promise<string> {
  // 1️⃣ Kimi K2.5（首选：zeroby 中转站）
  const kimiKey = process.env.KIMI_API_KEY;
  const kimiBase = process.env.KIMI_API_BASE || 'https://ai.1seey.com/v1';
  if (kimiKey) {
    try {
      const response = await fetch(`${kimiBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${kimiKey}`,
        },
        body: JSON.stringify({
          model: 'Kimi-K2.5',
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } },
              { type: 'text', text: '请详细描述这张图片的内容，包括文字、图表数据、关键信息。如果这是一张PPT截图或网页截图，请提取其中的关键内容。' }
            ]
          }],
          max_tokens: 4096,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) return content;
      }
      console.warn('[ImageUnderstand] Kimi failed, falling back to MiniMax');
    } catch (e) {
      console.warn('[ImageUnderstand] Kimi error:', e);
    }
  }

  // 2️⃣ MiniMax VL-01（备用）
  const minimaxKey = process.env.MINIMAX_API_KEY;
  if (minimaxKey) {
    try {
      const response = await fetch('https://api.minimaxi.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${minimaxKey}`,
        },
        body: JSON.stringify({
          model: 'MiniMax-VL-01',
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } },
              { type: 'text', text: '请详细描述这张图片的内容，包括文字、图表数据、关键信息。' }
            ]
          }],
          max_tokens: 4096,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) return content;
      }
    } catch (e) {
      console.error('[ImageUnderstand] MiniMax error:', e);
    }
  }

  return '[图片内容无法识别]';
}
