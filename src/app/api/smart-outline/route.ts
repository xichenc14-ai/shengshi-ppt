import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getRateLimitConfig } from '@/lib/rate-limit';
import { callKimi } from '@/lib/kimi-client';
import { callMiniMax } from '@/lib/minimax-client';
import { callGLM } from '@/lib/glm-client';

// ===== 主题数据库 =====
const THEME_DATABASE: Record<string, { id: string; nameZh: string; colors: string[]; suitableFor: string[] }> = {
  'consultant': { id: 'consultant', nameZh: '商务蓝', colors: ['#1E40AF', '#3B82F6', '#93C5FD'], suitableFor: ['商务', '汇报', '企业', '金融', '数据'] },
  'icebreaker': { id: 'icebreaker', nameZh: '培训青', colors: ['#0D9488', '#14B8A6', '#5EEAD4'], suitableFor: ['培训', '教育', '课程', '教学', '学习'] },
  'founder': { id: 'founder', nameZh: '路演紫', colors: ['#5B4FE9', '#8B5CF6', '#C4B5FD'], suitableFor: ['路演', '融资', '创业', '产品', '发布'] },
  'aurora': { id: 'aurora', nameZh: '科技蓝紫', colors: ['#6366F1', '#8B5CF6', '#A78BFA'], suitableFor: ['科技', 'AI', '创新', '互联网', '数字化'] },
  'electric': { id: 'electric', nameZh: '活力橙', colors: ['#EA580C', '#F97316', '#FDBA74'], suitableFor: ['创意', '营销', '活动', '品牌'] },
  'chisel': { id: 'chisel', nameZh: '大地棕', colors: ['#78350F', '#A16207', '#FDE68A'], suitableFor: ['教育', '培训', '课程', '传统'] },
  'ashrose': { id: 'ashrose', nameZh: '玫瑰粉', colors: ['#BE185D', '#EC4899', '#F9A8D4'], suitableFor: ['美妆', '时尚', '穿搭', '生活方式'] },
  'blues': { id: 'blues', nameZh: '高级金蓝', colors: ['#1E3A5F', '#C9A96E', '#F5E6CC'], suitableFor: ['年度总结', '年报', '高端', '金融'] },
  'gleam': { id: 'gleam', nameZh: '科技青', colors: ['#0F766E', '#14B8A6', '#99F6E4'], suitableFor: ['数据', '分析', '科技', '图表'] },
  'default-light': { id: 'default-light', nameZh: '极简白', colors: ['#F1F5F9', '#CBD5E1', '#64748B'], suitableFor: ['通用', '简洁', '极简'] },
};

// ===== 场景识别关键词 =====
const SCENE_KEYWORDS: Record<string, { keywords: string[]; themeId: string; tone: string; imageSource: string }> = {
  '商务汇报': { keywords: ['汇报', '报告', '工作', '项目', '季度', '月度', '周报'], themeId: 'consultant', tone: 'professional', imageSource: 'pictographic' },
  '路演融资': { keywords: ['路演', '融资', '创业', '投资', 'BP', '商业计划', '估值'], themeId: 'founder', tone: 'professional', imageSource: 'pictographic' },
  '培训课件': { keywords: ['培训', '课件', '内训', '新人', '入职', '流程', '教学', '课程'], themeId: 'icebreaker', tone: 'casual', imageSource: 'pictographic' },
  '科技AI': { keywords: ['AI', '人工智能', '科技', '数字化', '互联网', '软件', '机器人', '创新'], themeId: 'aurora', tone: 'bold', imageSource: 'pictographic' },
  '年度总结': { keywords: ['年度', '总结', '回顾', '年终', '年报', '成果', '业绩'], themeId: 'blues', tone: 'professional', imageSource: 'pictographic' },
  '数据分析': { keywords: ['数据', '分析', '报表', '统计', '图表', '增长', '指标'], themeId: 'gleam', tone: 'professional', imageSource: 'noImages' },
  '美妆时尚': { keywords: ['美妆', '时尚', '穿搭', '潮流', '彩妆', '护肤', '服装', '搭配'], themeId: 'ashrose', tone: 'casual', imageSource: 'pictographic' },
  '创意营销': { keywords: ['创意', '营销', '品牌', '广告', '活动', '策划', '推广'], themeId: 'electric', tone: 'creative', imageSource: 'pictographic' },
  '产品发布': { keywords: ['产品', '发布', '新品', '功能', '版本', '更新', '上市'], themeId: 'founder', tone: 'bold', imageSource: 'pictographic' },
  '生活方式': { keywords: ['生活', '旅行', '美食', '健康', '运动', '健身', '宠物', '家居'], themeId: 'chisel', tone: 'casual', imageSource: 'pictographic' },
};

// ===== 系统提示词：深度需求分析 =====
const ANALYSIS_SYSTEM_PROMPT = `你是PPT制作专家，负责深度分析用户需求并自动确定最佳制作方案。

## 你的任务

1. **理解用户需求**：分析用户输入的内容类型、目的、受众
2. **识别场景**：判断属于哪种PPT场景（商务汇报/培训课件/路演融资等）
3. **确定参数**：自动选择最佳的主题、配色、页数、图片源、语气
4. **生成大纲**：生成专业级别的PPT大纲，每页内容精心设计

## 输出格式（严格JSON）

{
  "analysis": {
    "inputType": "主题描述|完整文档|上传文件",
    "scene": "商务汇报|培训课件|路演融资|科技AI|年度总结|数据分析|美妆时尚|创意营销|产品发布|生活方式|通用",
    "purpose": "用户目的描述",
    "audience": "目标受众",
    "keyTopics": ["核心主题1", "核心主题2"]
  },
  "config": {
    "themeId": "主题ID",
    "tone": "professional|casual|creative|bold",
    "imageSource": "noImages|pictographic|webFreeToUseCommercially",
    "numCards": 8-15,
    "needAiImages": false
  },
  "outline": {
    "title": "PPT主标题",
    "slides": [
      {
        "type": "cover|toc|content|transition|end",
        "title": "页面标题",
        "content": ["要点1", "要点2", "要点3"],
        "layoutHint": "封面大标题|目录列表|三列卡片|时间轴|对比|四宫格|大文本|要点列表",
        "visualHint": "配图建议|图标建议"
      }
    ]
  }
}

## 规则

1. 页数控制在 8-12 页（除非用户明确要求更多）
2. 每页内容不超过 3-4 个要点
3. 自动选择最合适的主题（根据场景匹配）
4. 图片源默认用 pictographic（免费摘要图）
5. 数据分析类场景用 noImages（纯文字图表）
6. 生成完整、专业的大纲结构`;

// ===== 大纲转 Markdown（带布局指令）=====
function buildMarkdownFromOutline(outline: any): string {
  const slides = outline.slides || [];
  const pages: string[] = [];

  for (const slide of slides) {
    let pageContent = `## ${slide.title}\n`;

    // 根据布局提示添加指令
    if (slide.layoutHint) {
      pageContent += `\n<!-- Gamma布局：${slide.layoutHint} -->\n`;
    }

    // 添加要点内容
    if (slide.content && slide.content.length > 0) {
      // 控制要点数量（3-4个最佳）
      const items = slide.content.slice(0, 4);
      for (const item of items) {
        pageContent += `- ${item}\n`;
      }
    }

    // 添加视觉提示
    if (slide.visualHint) {
      pageContent += `\n<!-- 配图：${slide.visualHint} -->\n`;
    }

    pages.push(pageContent);
  }

  return pages.join('\n---\n');
}

// ===== 构建 additionalInstructions =====
function buildAdditionalInstructions(config: any, analysis: any): string {
  const instructions: string[] = [
    '用中文生成PPT。',
    '全局正文使用大文本，不要小号字，适合中国用户大字号阅读偏好。',
    '不要将列表排成表格形式，超过4个并列项请拆分到多页，每页3-4个用卡片布局。',
    '内容少的页面请用图标或色块填充留白区域。',
    '使用无衬线字体风格。',
    '保持演讲者备注。',
    '整体风格统一，专业但不死板。',
  ];

  // 根据图片源添加指令
  if (config.imageSource === 'pictographic') {
    instructions.push('使用摘要图/插图填充，风格：professional, clean, minimalist.');
  } else if (config.imageSource === 'noImages') {
    instructions.push('不使用任何外部图片，纯文字+图标+色块设计.');
  }

  // 根据场景添加特定指令
  if (analysis.scene === '数据分析') {
    instructions.push('重点使用图表、数据可视化元素.');
  } else if (analysis.scene === '路演融资') {
    instructions.push('封面必须有高质量配图，整体风格要专业大气.');
  } else if (analysis.scene === '培训课件') {
    instructions.push('每页内容简洁，适合教学演示，多用图标辅助理解.');
  }

  return instructions.join('\n');
}

// ===== AI调用：Kimi K2-thinking(深度分析) → K2(标准) → MiniMax → GLM =====
async function callAIWithFallback(systemPrompt: string, userPrompt: string, useThinking = false): Promise<string> {
  // 1️⃣ Kimi K2.5（首选：多模态+长上下文，免费）
  try {
    const result = await callKimi(
      [{ role: 'user', content: userPrompt }],
      { system: systemPrompt, maxTokens: 8192, model: useThinking ? 'Kimi-K2-Thinking' : 'Kimi-K2.5', temperature: useThinking ? 1.0 : 0.7 }
    );
    return result.content;
  } catch (e: any) {
    console.warn('[SmartOutline] Kimi failed, falling back to MiniMax:', e.message);
  }
  // 2️⃣ MiniMax M2.7（备用）
  try {
    return await callMiniMax(
      [{ role: 'user', content: userPrompt }],
      { system: systemPrompt, maxTokens: 8192, temperature: 0.7 }
    );
  } catch (e2: any) {
    console.warn('[SmartOutline] MiniMax failed, falling back to GLM:', e2.message);
  }
  // 3️⃣ GLM-5（兜底：稳定可靠）
  try {
    return await callGLM(systemPrompt, userPrompt, 'outline');
  } catch (e3: any) {
    throw new Error(`AI调用全部失败：Kimi / MiniMax / GLM(${e3.message})`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { inputText, uploadedFiles = [] } = await request.json();

    if (!inputText || inputText.trim().length === 0) {
      return NextResponse.json({ error: '请输入内容' }, { status: 400 });
    }

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const { allowed } = rateLimit(`smart-outline:${ip}`, getRateLimitConfig('/api/outline'));
    if (!allowed) {
      return NextResponse.json({ error: '请求过于频繁' }, { status: 429 });
    }

    // 构建用户提示词
    const userPrompt = uploadedFiles.length > 0
      ? `用户输入：\n${inputText}\n\n上传文件信息：\n${uploadedFiles.map((f: { name: string; type: string; size: number }) => `- ${f.name} (${f.type})`).join('\n')}`
      : `用户输入：\n${inputText}`;

    // 调用 AI 深度分析（省心模式用 thinking 模型深度推理）
    const rawContent = await callAIWithFallback(ANALYSIS_SYSTEM_PROMPT, userPrompt, true);

    // 清理并解析 JSON
    let cleaned = rawContent.trim();
    while (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('[SmartOutline] JSON parse error:', cleaned.substring(0, 500));
      throw new Error('AI返回格式解析失败，请重试');
    }

    const analysis = parsed.analysis || {};
    const config = parsed.config || {};
    const outline = parsed.outline || {};

    // 验证并补全配置
    const themeId = config.themeId || 'consultant';
    const tone = config.tone || 'professional';
    const imageSource = config.imageSource || 'pictographic';
    const numCards = config.numCards || outline.slides?.length || 10;

    // 构建完整的返回结果
    const result = {
      analysis: {
        inputType: analysis.inputType || '主题描述',
        scene: analysis.scene || '通用',
        purpose: analysis.purpose || '',
        audience: analysis.audience || '',
        keyTopics: analysis.keyTopics || [],
      },
      config: {
        themeId,
        themeName: THEME_DATABASE[themeId]?.nameZh || '商务蓝',
        themeColors: THEME_DATABASE[themeId]?.colors || ['#1E40AF', '#3B82F6', '#93C5FD'],
        tone,
        imageSource,
        numCards,
        needAiImages: config.needAiImages || false,
      },
      outline: {
        title: outline.title || 'PPT',
        slides: (outline.slides || []).map((s: any, i: number) => ({
          id: `slide-${i}`,
          type: s.type || 'content',
          title: s.title || `第${i + 1}页`,
          content: s.content || [],
          layoutHint: s.layoutHint || '',
          visualHint: s.visualHint || '',
        })),
      },
      // 生成 Gamma API 需要的完整参数
      gammaPayload: {
        inputText: buildMarkdownFromOutline(outline),
        textMode: 'preserve', // 省心模式用 preserve！
        format: 'presentation',
        numCards,
        themeId,
        additionalInstructions: buildAdditionalInstructions(config, analysis),
        textOptions: {
          amount: 'medium',
          tone,
          language: 'zh-cn',
        },
        imageOptions: {
          source: imageSource,
        },
        cardOptions: {
          dimensions: '16x9',
          cardSplit: 'inputTextBreaks', // 精确分页控制
        },
        exportAs: 'pptx',
      },
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[SmartOutline] Error:', error);
    return NextResponse.json({ error: error.message || '处理失败' }, { status: 500 });
  }
}