import { NextRequest, NextResponse } from 'next/server';
import { callGLM } from '@/lib/glm-client';
import { rateLimit, getRateLimitConfig } from '@/lib/rate-limit';

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

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const { allowed, remaining } = rateLimit(`outline:${ip}`, getRateLimitConfig('/api/outline'));
    if (!allowed) {
      return NextResponse.json({ error: '请求过于频繁，请稍后再试' }, { status: 429 });
    }

    const numCards = slideCount || 10;

    // ===== 搜索策略 =====
    // generate 模式：先让 AI 生成大纲，AI 自己判断是否需要搜索（通过 needSearch 字段）
    // condense/preserve 模式：用户已有内容，不需要搜索

    // ===== 调用 GLM API =====
    async function callAI(systemPrompt: string, userPrompt: string, taskType: 'outline' | 'search_judge' = 'outline'): Promise<any> {
      const content = await callGLM(systemPrompt, userPrompt, taskType);
      let cleaned = content.trim();
      if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      try {
        return JSON.parse(cleaned);
      } catch (e) {
        console.error('JSON parse error:', e, content);
        throw new Error('大纲格式解析失败');
      }
    }

    // ===== 构建 prompts =====
    const modePrompts: Record<string, string> = {
      generate: `你是一个专业的PPT内容策划师。用户会给一个主题，你需要从零生成完整的PPT大纲。

核心原则：你必须真正理解用户主题的含义，不要想当然！
- 如果用户提到的是品牌/公司/产品，你必须保留其真实名称和核心信息
- 不要将用户主题替换为你理解的普通概念

如果你对用户提到的某个品牌、公司、产品、项目、人名等专有名词不够了解，请在JSON输出的最外层加一个字段 "needSearch": true。如果你已经了解这个主题，不需要搜索，则不加这个字段或设为 false。

注意：只有在你确实不认识或不了解某个专有名词时才标记 needSearch: true。对于常见的主题（如"年终总结"、"产品发布"等通用主题），不需要搜索。

严格输出JSON，不要用markdown代码块包裹：
{
  "title": "PPT主标题",
  "needSearch": false,
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
    const baseUserPrompt = auto
      ? `请分析以下素材，自动识别需求并生成PPT大纲：\n\n${inputText}`
      : `请根据以下内容生成PPT大纲（${numCards}页）：\n\n${inputText}`;

    // ===== 第一次调用：生成大纲 =====
    let parsed = await callAI(systemPrompt, baseUserPrompt);

    // ===== generate 模式：检查 AI 是否标记需要搜索 =====
    if (textMode === 'generate' && parsed.needSearch) {
      console.log('[Outline] AI requested search for:', inputText.substring(0, 50));
      const searchContext = await searchTopic(inputText.trim());
      if (searchContext) {
        console.log('[Outline] Search results:', searchContext.substring(0, 200));
        const searchSection = `\n\n--- 以下是关于「${inputText.substring(0, 50)}」的参考信息（来自搜索结果，用于补充知识）：\n${searchContext}`;
        // 第二次调用：去掉 needSearch 指令，加上搜索结果
        const searchPrompt = systemPrompt.replace(
          /如果你对用户提到的某个品牌、公司、产品、项目、人名等专有名词不够了解，请在JSON输出的最外层加一个字段 "needSearch": true。如果你已经了解这个主题，不需要搜索，则不加这个字段或设为 false。\n\n注意：只有在你确实不认识或不了解某个专有名词时才标记 needSearch: true。对于常见的主题（如"年终总结"、"产品发布"等通用主题），不需要搜索。\n\n/,
          ''
        ).replace(
          /  "needSearch": false,\n/,
          ''
        );
        parsed = await callAI(searchPrompt, baseUserPrompt + searchSection, 'outline');
      } else {
        console.log('[Outline] Search returned empty, using first result');
      }
    }

    // ===== 构建返回结果 =====
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
