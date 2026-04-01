import { NextRequest, NextResponse } from 'next/server';

// 大纲生成 API - 用 GLM-5-turbo 生成 PPT 大纲结构
export async function POST(request: NextRequest) {
  try {
    const { inputText, slideCount, auto = false } = await request.json();

    if (!inputText || inputText.trim().length === 0) {
      return NextResponse.json({ error: '请输入内容' }, { status: 400 });
    }

    const apiKey = process.env.MYDAMOXING_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI 服务未配置' }, { status: 500 });
    }

    const numCards = slideCount || 10;

    const systemPrompt = `你是一个专业的PPT内容策划师。用户会给你素材（可能是文档、截图描述、需求文字等），你需要：

1. 分析用户需求，识别PPT类型和目标受众
2. 生成结构化的PPT大纲

严格输出JSON格式，不要输出任何其他内容，不要用markdown代码块包裹：
{
  "title": "PPT主标题（简洁有力）",
  "slides": [
    {
      "title": "页面标题（简洁，不超过15字）",
      "content": ["要点1（不超过20字）", "要点2", "要点3"],
      "notes": "演讲者备注（可选，详细补充说明）"
    }
  ]
}

大纲规范：
- 第一页为封面（标题直接用PPT主标题，content放副标题）
- 第二页为目录概览
- 中间页为内容页，每页3-4个要点
- 最后一页为总结/感谢页
- 总共${numCards}页（用户指定auto时根据内容量自动决定，8-15页）
- 每个要点不超过20字
- 内容要专业、精炼、有逻辑
- 如果用户上传了文档/表格/图片描述，要从中提取关键信息`;

    const userPrompt = auto
      ? `请分析以下素材，自动识别需求并生成PPT大纲（全自动模式）：\n\n${inputText}`
      : `请根据以下内容生成PPT大纲（${numCards}页）：\n\n${inputText}`;

    // 带重试的API调用
    let response: Response | undefined;
    let lastError = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch('https://mydamoxing.cn/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'glm-5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 8192,
        }),
      });

      if (response.ok) break;
      lastError = `${response.status} ${await response.text()}`;
      console.warn(`GLM attempt ${attempt + 1} failed: ${lastError}`);
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }

    if (!response || !response.ok) {
      throw new Error(`AI调用失败: ${lastError}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('AI返回内容为空');

    let parsed;
    try {
      let cleaned = content.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('JSON parse error:', e, content);
      throw new Error('大纲格式解析失败');
    }

    // 给每页加id
    const slides = (parsed.slides || []).map((s: any, i: number) => ({
      id: Math.random().toString(36).substring(2, 9),
      title: s.title || `第${i + 1}页`,
      content: s.content || [],
      notes: s.notes,
    }));

    return NextResponse.json({
      title: parsed.title || 'PPT',
      slides,
    });
  } catch (error: any) {
    console.error('Outline error:', error);
    return NextResponse.json(
      { error: error.message || '大纲生成失败' },
      { status: 500 }
    );
  }
}
