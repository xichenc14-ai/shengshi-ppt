import { NextRequest, NextResponse } from 'next/server';

// 大纲生成 API - 用 GLM-5-turbo 生成 PPT 大纲结构
export async function POST(request: NextRequest) {
  try {
    const { inputText, slideCount, textMode = 'generate', auto = false } = await request.json();

    if (!inputText || inputText.trim().length === 0) {
      return NextResponse.json({ error: '请输入内容' }, { status: 400 });
    }

    const apiKey = process.env.MYDAMOXING_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI 服务未配置' }, { status: 500 });
    }

    const numCards = slideCount || 10;

    // 根据 textMode 生成不同的 system prompt
    const modePrompts: Record<string, string> = {
      generate: `你是专业的PPT内容策划师。用户会给一个主题，你需要从零生成完整的PPT大纲。

严格输出JSON，不要用markdown代码块包裹：
{
  "title": "PPT主标题",
  "slides": [
    {"title": "页面标题（≤15字）", "content": ["要点1（≤20字）", "要点2", "要点3"], "notes": "演讲者备注（可选）"}
  ]
}

规则：
- 第一页为封面（content放副标题）
- 第二页为目录概览
- 中间页每页3-4个要点
- 最后一页为总结/感谢
- 总共${numCards}页
- 内容专业精炼有逻辑`,

      condense: `你是专业的PPT内容策划师。用户会给长文档/报告，你需要浓缩为PPT大纲。

严格输出JSON，不要用markdown代码块包裹：
{
  "title": "PPT主标题（从内容中提取核心主题）",
  "slides": [
    {"title": "页面标题（≤15字）", "content": ["要点1（≤20字）", "要点2", "notes": "原文关键数据/引用（可选）"}
  ]
}

规则：
- 从文档中提取核心信息，不是简单复制
- 每个要点是一句话概括，不超过20字
- 总共${numCards}页（根据内容量决定）
- 第一页封面，最后一页总结
- 中间页按文档逻辑组织
- notes字段放原文中的关键数据或引用`,

      preserve: `你是专业的PPT内容策划师。用户会给已有的PPT大纲或内容，你需要整理为标准格式。

严格输出JSON，不要用markdown代码块包裹：
{
  "title": "PPT主标题",
  "slides": [
    {"title": "页面标题", "content": ["要点1", "要点2", "要点3"], "notes": "备注（可选）"}
  ]
}

规则：
- 尽量保留原文内容和结构
- 如果内容超过${numCards}页，智能合并或拆分
- 如果内容不足${numCards}页，不要凭空编造
- 每页保持3-4个要点
- 只是做格式标准化，不改变内容含义`,
    };

    const systemPrompt = modePrompts[textMode] || modePrompts.generate;

    const userPrompt = auto
      ? `请分析以下素材，自动识别需求并生成PPT大纲（全自动模式）：\n\n${inputText}`
      : `请根据以下内容生成PPT大纲（${numCards}页，${textMode}模式）：\n\n${inputText}`;

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
