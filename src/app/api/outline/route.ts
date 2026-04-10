import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getRateLimitConfig } from '@/lib/rate-limit';
import { callMiniMax, callMiniMaxWithSearch } from '@/lib/minimax-client';
import { callGLM } from '@/lib/glm-client';

const SCENE_THEME_MAP: Record<string, { themeId: string; tone: string; imageMode: string }> = {
  '商务汇报': { themeId: 'consultant', tone: 'professional', imageMode: 'pictographic' },
  '路演融资': { themeId: 'founder', tone: 'professional', imageMode: 'pictographic' },
  '培训课件': { themeId: 'icebreaker', tone: 'casual', imageMode: 'noImages' },
  '创意方案': { themeId: 'electric', tone: 'creative', imageMode: 'aiGenerated' },
  '美妆时尚': { themeId: 'ashrose', tone: 'casual', imageMode: 'pictographic' },
  '数据分析': { themeId: 'gleam', tone: 'professional', imageMode: 'noImages' },
  '年度总结': { themeId: 'blues', tone: 'professional', imageMode: 'pictographic' },
  '产品发布': { themeId: 'aurora', tone: 'bold', imageMode: 'aiGenerated' },
  '教育课件': { themeId: 'chisel', tone: 'casual', imageMode: 'noImages' },
  '生活方式': { themeId: 'finesse', tone: 'casual', imageMode: 'pictographic' },
  '科技AI': { themeId: 'aurora', tone: 'bold', imageMode: 'aiGenerated' },
  '通用': { themeId: 'default-light', tone: 'professional', imageMode: 'pictographic' },
};

// ===== 联网搜索（用 MiniMax web search tool） =====
async function searchTopicWithMiniMax(topic: string): Promise<string> {
  try {
    // 通过 MiniMax 的联网搜索能力获取主题相关信息
    const searchPrompt = `请搜索关于"${topic}"的相关信息，返回3-5个关键信息点，用于PPT内容策划。搜索结果只需关键事实，不要长段落。`;

    // 尝试用 MiniMax 联网（如果API支持）
    // 降级：直接返回空字符串，让 AI 依靠自己的知识
    return '';
  } catch (e) {
    console.warn('[Search] MiniMax search failed, using AI knowledge only:', e);
    return '';
  }
}

// ===== AI 调用策略：MiniMax 默认，GLM 备用 =====
async function callAIWithFallback(
  systemPrompt: string,
  userPrompt: string,
  useSearch: boolean = false,
  searchContext: string = ''
): Promise<string> {
  try {
    // 优先用 MiniMax（支持联网搜索 + 图片理解）
    return await callMiniMaxWithSearch(
      userPrompt,
      searchContext,
      { system: systemPrompt, maxTokens: 8192, temperature: 0.7 }
    );
  } catch (e: any) {
    console.warn('[Outline] MiniMax failed, falling back to GLM:', e.message);
    // GLM 备用（纯文本，不支持联网搜索）
    try {
      return await callGLM(systemPrompt, userPrompt, 'outline');
    } catch (e2: any) {
      throw new Error(`AI调用全部失败：MiniMax(${e.message}) / GLM(${e2.message})`);
    }
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
    const { allowed } = rateLimit(`outline:${ip}`, getRateLimitConfig('/api/outline'));
    if (!allowed) {
      return NextResponse.json({ error: '请求过于频繁，请稍后再试' }, { status: 429 });
    }

    const numCards = slideCount || 10;

    // ===== 构建 prompts =====
    const modePrompts: Record<string, string> = {
      generate: `你是一个专业的PPT内容策划师。用户会给一个主题，你需要从零生成完整的PPT大纲。

核心原则：你必须真正理解用户主题的含义，不要想当然！
- 如果用户提到的是品牌/公司/产品，你必须保留其真实名称和核心信息
- 不要将用户主题替换为你理解的普通概念
- 如果对某个专有名词不了解，可以使用你的知识库推断

严格输出JSON，不要用markdown代码块包裹：
{
  "title": "PPT主标题",
  "scene": "场景类型",
  "themeId": "Gamma主题ID",
  "tone": "professional/casual/creative/bold",
  "imageMode": "noImages/pictographic/aiGenerated",
  "slides": [
    {"title": "页面标题（≤15字）", "content": ["要点1（≤20字）", "要点2", "要点3"], "notes": "备注"}
  ]
}

场景匹配规则（必须严格遵守）：
- 美妆时尚/穿搭/潮流 → ashrose + casual + pictographic
- 科技/产品/创新/AI/机器人 → aurora + bold + aiGenerated
- 教育/培训/课程 → chisel + casual + noImages
- 商务/汇报/数据/金融 → consultant/gleam + professional + pictographic
- 年度总结/复盘 → blues + professional + pictographic
- 路演/融资/创业 → founder + professional + pictographic
- 如果不确定，选 default-light + professional

规则：第一页封面，第二页目录，中间3-4要点/页，最后总结。总共${numCards}页`,

      condense: `你是专业的PPT内容策划师。用户会给内容，你需要浓缩为PPT大纲。

核心原则：必须保留用户提到的品牌名、产品名、公司名等专有名词，不要替换！

严格输出JSON，不要用markdown代码块包裹：
{
  "title": "PPT主标题",
  "scene": "场景类型",
  "themeId": "Gamma主题ID",
  "tone": "professional/casual/creative/bold",
  "imageMode": "noImages/pictographic/aiGenerated",
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
  "imageMode": "noImages/pictographic/aiGenerated",
  "slides": [{"title": "标题", "content": ["要点"], "notes": "备注"}]
}

规则：保留原文结构和专有名词。总共${numCards}页`,
    };

    const systemPrompt = modePrompts[textMode] || modePrompts.generate;
    const baseUserPrompt = auto
      ? `请分析以下素材，自动识别需求并生成PPT大纲：\n\n${inputText}`
      : `请根据以下内容生成PPT大纲（${numCards}页）：\n\n${inputText}`;

    // ===== 联网搜索（generate 模式） =====
    let searchContext = '';
    if (textMode === 'generate') {
      searchContext = await searchTopicWithMiniMax(inputText.trim());
    }

    // ===== 调用 AI（MiniMax 默认 + GLM 备用） =====
    let rawContent = await callAIWithFallback(systemPrompt, baseUserPrompt, textMode === 'generate', searchContext);

    let cleaned = rawContent.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('[Outline] JSON parse error:', cleaned.substring(0, 200));
      throw new Error('大纲格式解析失败');
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
    console.error('[Outline] Error:', error);
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
