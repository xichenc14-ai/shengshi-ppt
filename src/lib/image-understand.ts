// MiniMax Vision 图片理解
// 统一使用 api.minimaxi.com 端点
export async function understandImage(base64Data: string, mimeType: string): Promise<string> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) return '[图片内容无法识别：未配置API Key]';

  try {
    const response = await fetch('https://api.minimaxi.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'MiniMax-M2.7',
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

    if (!response.ok) {
      console.error('MiniMax Vision error:', response.status, await response.text());
      return '[图片内容无法识别]';
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '[图片内容无法识别]';
  } catch (error: any) {
    console.error('Image understand error:', error);
    return '[图片内容无法识别]';
  }
}
