import { NextRequest, NextResponse } from 'next/server';
import { Presentation } from '@/lib/types';

// AI生成PPT内容的API Route - 使用 GLM-5-turbo
export async function POST(request: NextRequest) {
  try {
    const { topic, slideCount = 8, style = 'professional' } = await request.json();

    if (!topic || topic.trim().length === 0) {
      return NextResponse.json(
        { error: '请输入PPT主题' },
        { status: 400 }
      );
    }

    const apiKey = process.env.MYDAMOXING_API_KEY;
    if (!apiKey) {
      console.warn('MYDAMOXING_API_KEY not set, returning sample data');
      return NextResponse.json({
        presentation: generateSamplePresentation(topic),
        usedFallback: true,
      });
    }

    // 调用 GLM-5-turbo API
    const systemPrompt = `你是一个专业的PPT内容策划师。用户会给你一个主题，你需要生成完整的PPT内容。

严格输出JSON格式，不要输出任何其他内容，不要用markdown代码块包裹：
{
  "title": "PPT主标题",
  "slides": [
    {
      "type": "title",
      "title": "主标题",
      "subtitle": "副标题（一句话描述）"
    },
    {
      "type": "content",
      "title": "页面标题",
      "content": ["要点1（不超过30字）", "要点2", "要点3"]
    }
  ]
}

PPT结构规范：
1. 第1页：标题页（type: "title"）
2. 第2页：目录概览（type: "content"）
3. 中间页：内容页（type: "content" 或 "two-column"），共${Math.max(3, slideCount - 3)}页
4. 最后页：总结感谢（type: "end"）

内容要求：
- 每页不超过5个要点
- 每个要点不超过30字
- 内容要专业、精炼、有逻辑
- 风格：${style}
- 总共生成${slideCount}页幻灯片`;

    const userPrompt = `请为以下主题生成PPT内容：${topic}`;

    // 调用GLM-5-turbo API（带重试）
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
      console.warn(`GLM-5-turbo attempt ${attempt + 1} failed: ${lastError}`);
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }

    if (!response || !response.ok) {
      throw new Error(`AI API调用失败（已重试3次）: ${lastError}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('AI返回内容为空');
    }

    // 解析JSON
    let parsed;
    try {
      let cleaned = content.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('JSON parse error:', e, content);
      throw new Error('AI返回内容格式错误');
    }

    // 构建Presentation对象
    const presentation: Presentation = {
      id: generateId(),
      title: parsed.title || topic,
      theme: topic,
      templateId: 'ocean',
      slides: (parsed.slides || []).map((s: any, i: number) => ({
        id: generateId(),
        type: s.type || 'content',
        title: s.title || `第${i + 1}页`,
        subtitle: s.subtitle,
        content: s.content || [],
        notes: s.notes,
      })),
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({ presentation });
  } catch (error: any) {
    console.error('Generate error:', error);
    return NextResponse.json(
      { error: error.message || '生成失败，请重试' },
      { status: 500 }
    );
  }
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// 备用示例数据
function generateSamplePresentation(topic: string): Presentation {
  return {
    id: generateId(),
    title: `${topic}`,
    theme: topic,
    templateId: 'ocean',
    slides: [
      {
        id: generateId(),
        type: 'title',
        title: topic,
        subtitle: 'AI智能生成 · 专业演示文稿',
        content: [],
      },
      {
        id: generateId(),
        type: 'content',
        title: '目录',
        content: ['项目背景与目标', '核心方案与策略', '实施计划与时间线', '预期成果与价值'],
      },
      {
        id: generateId(),
        type: 'content',
        title: '背景分析',
        content: [
          '当前市场环境与趋势分析',
          '用户需求与痛点识别',
          '竞争格局与差异化定位',
          '技术可行性评估',
        ],
      },
      {
        id: generateId(),
        type: 'content',
        title: '核心方案',
        content: [
          '创新理念：以用户为中心的设计思维',
          '技术架构：模块化、可扩展的系统设计',
          '运营策略：数据驱动的增长模式',
          '风险控制：完善的应急响应机制',
        ],
      },
      {
        id: generateId(),
        type: 'content',
        title: '实施计划',
        content: [
          '第一阶段（1-2周）：基础搭建与核心功能',
          '第二阶段（3-4周）：功能完善与测试优化',
          '第三阶段（5-6周）：上线推广与用户反馈',
          '持续迭代：基于数据不断优化',
        ],
      },
      {
        id: generateId(),
        type: 'content',
        title: '预期成果',
        content: [
          '提升效率：自动化流程节省30%时间',
          '降低成本：资源优化减少20%开支',
          '用户体验：满意度提升至90%以上',
          '数据增长：月活用户增长50%',
        ],
      },
      {
        id: generateId(),
        type: 'end',
        title: '感谢观看',
        subtitle: '期待与您的合作 · 共创美好未来',
        content: [],
      },
    ],
    createdAt: new Date().toISOString(),
  };
}
