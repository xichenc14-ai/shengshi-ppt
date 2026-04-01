import { NextRequest, NextResponse } from 'next/server';

// 场景 → 主题映射（基于技术部研究成果）
const SCENE_THEME_MAP: Record<string, { themeId: string; tone: string; imageMode: string }> = {
  '商务汇报': { themeId: 'consultant', tone: 'professional', imageMode: 'noImages' },
  '路演融资': { themeId: 'founder', tone: 'professional', imageMode: 'webFreeToUseCommercially' },
  '培训课件': { themeId: 'icebreaker', tone: 'casual', imageMode: 'noImages' },
  '创意方案': { themeId: 'electric', tone: 'creative', imageMode: 'aiGenerated' },
  '美妆时尚': { themeId: 'ashrose', tone: 'casual', imageMode: 'webFreeToUseCommercially' },
  '数据分析': { themeId: 'gleam', tone: 'professional', imageMode: 'noImages' },
  '年度总结': { themeId: 'blues', tone: 'professional', imageMode: 'webFreeToUseCommercially' },
  '产品发布': { themeId: 'aurora', tone: 'bold', imageMode: 'aiGenerated' },
  '教育课件': { themeId: 'chisel', tone: 'casual', imageMode: 'noImages' },
  '生活方式': { themeId: 'finesse', tone: 'casual', imageMode: 'webFreeToUseCommercially' },
  '通用': { themeId: 'default-light', tone: 'professional', imageMode: 'noImages' },
};

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

    const modePrompts: Record<string, string> = {
      generate: `你是专业的PPT内容策划师。用户会给一个主题，你需要从零生成完整的PPT大纲，并智能匹配最佳PPT主题和风格。

严格输出JSON，不要用markdown代码块包裹：
{
  "title": "PPT主标题",
  "scene": "场景类型（商务汇报/路演融资/培训课件/创意方案/美妆时尚/数据分析/年度总结/产品发布/教育课件/生活方式/通用）",
  "themeId": "Gamma主题ID（商务=consultant 路演=founder 培训=icebreaker 创意=electric 美妆=ashrose 数据=gleam 年度=blues 发布=aurora 教育=chisel 生活=finesse 通用=default-light）",
  "tone": "professional/casual/creative/bold",
  "imageMode": "noImages/webFreeToUseCommercially/aiGenerated",
  "slides": [
    {"title": "页面标题（≤15字）", "content": ["要点1（≤20字）", "要点2", "要点3"], "notes": "演讲者备注（可选）"}
  ]
}

重要：
- scene/themeId/tone/imageMode 必须根据内容主题智能匹配
- 美妆时尚/穿搭/生活方式 → ashrose/coral-glow + casual + webFreeToUseCommercially
- 科技/产品/创新 → aurora/electric + bold + aiGenerated
- 教育/培训/课程 → icebreaker/chisel + casual + noImages
- 商务/汇报/数据 → consultant/gleam + professional + noImages
- 第一页封面，第二页目录，中间每页3-4要点，最后总结
- 总共${numCards}页`,

      condense: `你是专业的PPT内容策划师。用户会给长文档，你需要浓缩为PPT大纲，并智能匹配最佳主题风格。

严格输出JSON，不要用markdown代码块包裹：
{
  "title": "PPT主标题",
  "scene": "场景类型（商务汇报/路演融资/培训课件/创意方案/美妆时尚/数据分析/年度总结/产品发布/教育课件/生活方式/通用）",
  "themeId": "Gamma主题ID",
  "tone": "professional/casual/creative/bold",
  "imageMode": "noImages/webFreeToUseCommercially/aiGenerated",
  "slides": [{"title": "页面标题", "content": ["要点"], "notes": "备注"}]
}

规则：
- 从文档提取核心信息，每要点≤20字
- scene/themeId/tone/imageMode 根据文档内容智能匹配
- 总共${numCards}页`,

      preserve: `你是专业的PPT内容策划师。用户会给已有内容，你需要整理为标准格式并匹配主题风格。

严格输出JSON，不要用markdown代码块包裹：
{
  "title": "PPT主标题",
  "scene": "场景类型",
  "themeId": "Gamma主题ID",
  "tone": "professional/casual/creative/bold",
  "imageMode": "noImages/webFreeToUseCommercially/aiGenerated",
  "slides": [{"title": "标题", "content": ["要点"], "notes": "备注"}]
}

规则：
- 保留原文结构和内容
- scene/themeId 根据内容智能匹配
- 总共${numCards}页`,
    };

    const systemPrompt = modePrompts[textMode] || modePrompts.generate;

    const userPrompt = auto
      ? `请分析以下素材，自动识别需求并生成PPT大纲：\n\n${inputText}`
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

    let parsed: any;
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

    // 智能匹配：如果 AI 没返回 scene/themeId，根据内容关键词兜底匹配
    const fullText = `${parsed.title || ''} ${(parsed.slides || []).map((s: any) => s.title).join(' ')}`.toLowerCase();
    const detectedScene = parsed.scene || detectScene(fullText);
    const sceneConfig = SCENE_THEME_MAP[detectedScene] || SCENE_THEME_MAP['通用'];

    const slides = (parsed.slides || []).map((s: any, i: number) => ({
      id: Math.random().toString(36).substring(2, 9),
      title: s.title || `第${i + 1}页`,
      content: s.content || [],
      notes: s.notes,
    }));

    return NextResponse.json({
      title: parsed.title || 'PPT',
      slides,
      // 返回匹配的主题信息，前端直接使用
      themeId: parsed.themeId || sceneConfig.themeId,
      tone: parsed.tone || sceneConfig.tone,
      imageMode: parsed.imageMode || sceneConfig.imageMode,
      scene: detectedScene,
    });
  } catch (error: any) {
    console.error('Outline error:', error);
    return NextResponse.json(
      { error: error.message || '大纲生成失败' },
      { status: 500 }
    );
  }
}

// 关键词兜底场景检测
function detectScene(text: string): string {
  const keywords: Record<string, string[]> = {
    '美妆时尚': ['美妆', '时尚', '穿搭', '衣服', '潮流', '彩妆', '护肤', '服装', '搭配', '秀场', '品牌'],
    '生活方式': ['生活', '旅行', '美食', '健康', '运动', '健身', '宠物', '家居', '摄影'],
    '创意方案': ['创意', '设计', '艺术', '品牌', '广告', '营销', '活动策划', '视觉'],
    '产品发布': ['产品', '发布', '上线', '新品', '功能', '版本', '更新'],
    '教育课件': ['教育', '教学', '课程', '学生', '学习', '考试', '培训'],
    '数据分析': ['数据', '分析', '报表', '统计', '图表', '指标', '增长', '转化'],
    '年度总结': ['年度', '总结', '回顾', '年终', '成果', '业绩', '年报'],
    '路演融资': ['路演', '融资', '创业', '投资', 'BP', '商业计划'],
    '商务汇报': ['汇报', '报告', '工作', '项目', '季度', '月度'],
    '培训课件': ['培训', '内训', '新人', '入职', '规章制度', '流程'],
  };

  for (const [scene, words] of Object.entries(keywords)) {
    if (words.some(w => text.includes(w))) return scene;
  }
  return '通用';
}
