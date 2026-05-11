// 图片理解：MiniMax VL-01（v10.45 统一为 MiniMax）
//
// 架构决策: AI 服务统一为 MiniMax
// - 移除了 Kimi K2.5 作为首选
// - 统一使用 MiniMax-VL-01 进行图片理解
//
// v10.45

export async function understandImage(base64Data: string, mimeType: string): Promise<string> {
  // MiniMax VL-01
  const minimaxKey = process.env.MINIMAX_API_KEY;
  if (!minimaxKey) {
    console.error('[ImageUnderstand] MINIMAX_API_KEY not configured');
    return '[图片识别服务未配置]';
  }

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
            { type: 'text', text: '请详细描述这张图片的内容，包括文字、图表数据、关键信息。如果这是一张PPT截图或网页截图，请提取其中的关键内容。' }
          ]
        }],
        max_tokens: 4096,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error('[ImageUnderstand] MiniMax API error:', response.status, await response.text());
      return '[图片识别失败，请稍后重试]';
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return '[图片内容为空]';
    }
    return content;
  } catch (e) {
    console.error('[ImageUnderstand] MiniMax error:', e);
    return '[图片识别服务异常]';
  }
}
