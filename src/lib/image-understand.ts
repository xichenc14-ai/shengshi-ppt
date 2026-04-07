// MiniMax VL-01 图片理解
export async function understandImage(base64Data: string, mimeType: string): Promise<string> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) return '[图片内容无法识别：未配置API Key]';

  try {
    const response = await fetch('https://api.minimax.chat/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'MiniMax-VL-01',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: '请详细描述这张图片的内容，包括文字、图表数据、关键信息。如果这是一张PPT截图，请提取每页的标题和内容。' },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } }
          ]
        }],
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      console.error('MiniMax VL error:', response.status, await response.text());
      return '[图片内容无法识别]';
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '[图片内容无法识别]';
  } catch (error: any) {
    console.error('Image understand error:', error);
    return '[图片内容无法识别]';
  }
}
