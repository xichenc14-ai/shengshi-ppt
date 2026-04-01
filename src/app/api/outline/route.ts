import { NextRequest, NextResponse } from 'next/server';

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
  '科技AI': { themeId: 'aurora', tone: 'bold', imageMode: 'aiGenerated' },
  '通用': { themeId: 'default-light', tone: 'professional', imageMode: 'noImages' },
};

// 用 web_search 搜索主题关键词，获取真实信息
async function searchTopic(topic: string): Promise<string> {
  try {
    // 提取关键词用于搜索
    const keywords = topic.replace(/[，、|,、]/g, ' ').split(/\s+/).filter(w => w.length >= 2).slice(0, 5);
    const searchQuery = keywords.join(' ');
    
    const res = await fetch('https://www.google.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      body: `q=${encodeURIComponent(searchQuery)}&hl=zh-CN&num=8&gl=cn`,
    });

    if (!res.ok) return '';

    const text = await res.text();
    // 提取搜索结果摘要
    const matches = text.match(/<div[^>]*class="[^"]*BNeawe7s5nbre3[^"]*"[^>]*>(.*?)<\/div>/g);
    if (matches && matches.length > 0) {
      return matches.map(m => m.replace(/<[^>]*>/g, '').trim()).filter(m => m.length > 20).join('\n');
    }
    return '';
  } catch (e: unknown) {
    console.warn('Search failed:', e instanceof Error ? e.message : 'unknown');
    return '';
  }
}

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

    // ===== 第一步：搜索主题关键词，获取真实信息 =====
    console.log('[Outline] Searching topic:', inputText.substring(0, 50));
    const searchContext = await searchTopic(inputText.trim());
    console.log('[Outline] Search results:', searchContext.substring(0, 200));

    // ===== 第二步：基于搜索结果生成大纲 =====
    const searchSection = searchContext
      ? `\n\n--- 以下是关于「${inputText.substring(0, 50)}」的真实信息（来自搜索结果）：\n${searchContext}`
      : '';

    const modePrompts: Record<string, string> = {
      generate: `你是一个专业的PPT内容策划师。用户会给一个主题，你需要从零生成完整的PPT大纲。

核心原则：你必须真正理解用户主题的含义，不要想当然！
- 如果用户提到的是品牌/公司/产品，你必须保留其真实名称和核心信息
- 不要将用户主题替换为你理解的普通概念

严格输出JSON，不要用markdown代码块包裹：
{
  "title": "PPT主标题",
  "scene": "场景类型",
  "themeId": "Gamma主题ID",
  "tone": "professional/casual/creative/bold",
  "imageMode": "noImages/webFreeToUseCommercially/aiGenerated",
  "slides": [
    {"title": "页面标题（≤15字）", "content": ["要点1（≤20字）", "要点2", "要点3"], "notes": "备注"}
  ]
}

场景匹配规则（必须严格遵守）：
- 美妆时尚/穿搭/生活方式 → ashrose + casual + web配图
- 科技/产品/创新/AI/机器人 → aurora + bold + AI配图
- 教育/培训/课程 → chisel + casual + 无图
- 商务/汇报/数据/金融 → consultant/gleam + professional + 无图
- 品牌/公司/产品 → 根据行业匹配对应主题
- 如果不确定，选 default-light + professional

规则：第一页封面，第二页目录，中间3-4要点/页，最后总结。总共${numCards}页`,

      condense: `你是专业的PPT内容策划师。用户会给内容，你需要浓缩为PPT大纲。

核心原则：必须保留用户提到的品牌名、产品名、公司名等专有名词，不要替换！
如果用户提到的是品牌/公司/产品，你必须保留其真实名称和核心信息

严格输出JSON，不要用markdown代码块包裹：
{
  "title": "PPT主标题",
  "scene": "场景类型",
  "themeId": "Gamma主题ID",
  "tone": "professional/casual/creative/bold",
  "imageMode": "noImages/webFreeToUseCommercially/aiGenerated",
  "slides": [{"title": "页面标题", "content": ["要点"], "notes": "备注"}]
}

规则：提取核心信息，保留专有名词。总共${numCards}页`,

      preserve: `你是专业的PPT内容策划师。用户会给已有内容，你需要整理为标准格式。

核心原则：必须保留用户提到的品牌名、产品名、公司名等专有名词，不要替换！

严格输出JSON，不要用markdown代码块包裹：
{
  "title": "PPT主标题",
  "scene": "场景类型",
  "themeId": "Gamma主题ID",
  "tone": "professional/casual/creative/bold",
  "imageMode": "noImages/webFreeToUseCommercially/aiGenerated",
  "slides": [{"title": "标题", "content": ["要点"], "notes": "备注"}]
}

规则：保留原文结构和专有名词。总共${numCards}页`,
    };

    const systemPrompt = modePrompts[textMode] || modePrompts.generate;
    const userPrompt = auto
      ? `请分析以下素材，自动识别需求并生成PPT大纲：\n\n${inputText}${searchSection}`
      : `请根据以下内容生成PPT大纲（${numCards}页）：\n\n${inputText}${searchSection}`;

    // 带重试
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

    if (!response || !response.ok) throw new Error(`AI调用失败: ${lastError}`);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('AI返回内容为空');

    let parsed: any;
    try {
      let cleaned = content.trim();
      if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('JSON parse error:', e, content);
      throw new Error('大纲格式解析失败');
    }

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
      themeId: parsed.themeId || sceneConfig.themeId,
      tone: parsed.tone || sceneConfig.tone,
      imageMode: parsed.imageMode || sceneConfig.imageMode,
      scene: detectedScene,
    });
  } catch (error: any) {
    console.error('Outline error:', error);
    return NextResponse.json({ error: error.message || '大纲生成失败' }, { status: 500 });
  }
}

function detectScene(text: string): string {
  const keywords: Record<string, string[]> = {
    '美妆时尚': ['美妆', '时尚', '穿搭', '潮流', '彩妆', '护肤', '服装', '搭配'],
    '生活方式': ['生活', '旅行', '美食', '健康', '运动', '健身', '宠物', '家居'],
    '创意方案': ['创意', '设计', '品牌', '广告', '营销', '活动策划'],
    '产品发布': ['产品', '发布', '新品', '功能', '版本', '更新'],
    '教育课件': ['教育', '教学', '课程', '学习', '考试', '培训'],
    '数据分析': ['数据', '分析', '报表', '统计', '图表', '增长'],
    '年度总结': ['年度', '总结', '回顾', '年终', '成果', '业绩', '年报'],
    '路演融资': ['路演', '融资', '创业', '投资', 'BP', '商业计划'],
    '商务汇报': ['汇报', '报告', '工作', '项目', '季度', '月度'],
    '培训课件': ['培训', '内训', '新人', '入职', '流程'],
    '科技AI': ['科技', 'AI', '机器人', '人工智能', '自动化', '软件', '互联网'],
  };
  for (const [scene, words] of Object.entries(keywords)) {
    if (words.some(w => text.includes(w))) return scene;
  }
  return '通用';
}
