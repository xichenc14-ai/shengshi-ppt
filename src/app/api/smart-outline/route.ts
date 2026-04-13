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

// ===== 系统提示词 V2（Gamma 规范强化） =====
const ANALYSIS_SYSTEM_PROMPT = `你是PPT制作专家，负责深度分析用户需求并生成符合 Gamma AI 规范的专业大纲。

## Gamma 布局触发规则（必须遵守）

1. **大文本强制**：正文用 ### 触发 24pt 大字（禁止小字）
2. **卡片布局**：3-4个并列要点用列表触发三列/四宫格
3. **时间轴**：有序列表 1. 2. 3. 触发流程布局
4. **内容密度**：每页 50-80 字，不超过 4 个要点
5. **封面结尾**：必须有高质量配图

## 输出格式（严格JSON）

{
  "analysis": {
    "inputType": "主题描述",
    "scene": "商务汇报|培训课件|路演融资|科技AI|年度总结|数据分析|美妆时尚|创意营销|产品发布|生活方式|通用",
    "purpose": "用户目的",
    "audience": "目标受众",
    "keyTopics": ["核心主题1", "核心主题2"]
  },
  "config": {
    "themeId": "consultant|icebreaker|founder|aurora|electric|chisel|ashrose|blues|gleam|default-light",
    "tone": "professional|casual|creative|bold",
    "imageSource": "pictographic|noImages|webFreeToUseCommercially|themeAccent",
    "numCards": 8-15,
    "visualMetaphor": "山峰|破晓|树苗|闪电|桥梁|蝴蝶|火箭|芯片|盾牌|齿轮"
  },
  "outline": {
    "title": "PPT主标题",
    "slides": [
      {
        "type": "cover",
        "title": "主标题",
        "content": ["副标题"]
      },
      {
        "type": "toc",
        "title": "目录",
        "content": ["第一部分", "第二部分", "第三部分"]
      },
      {
        "type": "content",
        "title": "核心要点",
        "content": ["要点1(≤20字)", "要点2", "要点3", "要点4"]
      },
      {
        "type": "process",
        "title": "实施步骤",
        "content": ["步骤1", "步骤2", "步骤3"]
      },
      {
        "type": "ending",
        "title": "感谢",
        "content": ["联系方式"]
      }
    ]
  }
}

## 规则

1. 页数控制在 8-12 页
2. 每页不超过 4 个要点
3. 每个要点 ≤ 20 字
4. 数据类用 noImages
5. 其他默认 pictographic`;

// ===== 大纲转 Markdown（V2 - Gamma 规范结构化） =====
// 核心改动：使用 Gamma 布局触发语法
// - cover: # 主标题（封面大标题）
// - toc: ## 标题 + 有序列表（目录）
// - content: ## 标题 + ### 大文本要点 / - **卡片**（3-4列布局）
// - process: ## 标题 + 1. 2. 3.（时间轴布局）
// - ending: # 感谢 + > 引用块（演讲者备注）
function buildMarkdownFromOutline(outline: any): string {
  const slides = outline.slides || [];
  const pages: string[] = [];

  for (const slide of slides) {
    const type = slide.type || 'content';
    const content = slide.content || [];

    switch (type) {
      case 'cover':
        // 封面：# 主标题（触发封面大标题布局）
        pages.push(`# ${slide.title}\n\n${content.slice(0, 2).join(' · ')}`);
        break;

      case 'toc':
        // 目录：有序列表（触发时间轴/列表布局）
        pages.push(`## ${slide.title}\n\n${content.slice(0, 6).map((c: string, i: number) => `${i + 1}. **${c}**`).join('\n')}`);
        break;

      case 'process':
        // 流程/步骤：有序列表（触发时间轴布局）
        pages.push(`## ${slide.title}\n\n${content.slice(0, 4).map((c: string, i: number) => `${i + 1}. **${c}**`).join('\n')}`);
        break;

      case 'ending':
        // 结尾：# 感谢 + 引用块（演讲者备注）
        pages.push(`# ${slide.title}\n\n> ${content.join('；')}`);
        break;

      case 'content':
      default:
        // 内容页：根据要点数量选择布局
        if (content.length >= 3 && content.length <= 4) {
          // 3-4个要点：- **粗体** 触发三列/四宫格卡片布局
          pages.push(`## ${slide.title}\n\n${content.map((c: string) => `- **${c}**`).join('\n')}`);
        } else if (content.length === 2) {
          // 2个要点：### 大文本（触发左右对照布局）
          pages.push(`## ${slide.title}\n\n${content.map((c: string) => `### ${c}`).join('\n\n')}`);
        } else if (content.length === 1) {
          // 1个要点：### 大文本独占
          pages.push(`## ${slide.title}\n\n### ${content[0]}`);
        } else {
          // 5+个要点：拆分为列表
          pages.push(`## ${slide.title}\n\n${content.slice(0, 4).map((c: string) => `### ${c}`).join('\n\n')}`);
        }
        break;
    }

    // 每页之间用 --- 分页（配合 cardSplit: "inputTextBreaks"）
    pages.push('\n---\n');
  }

  return pages.join('\n');
}

// ===== 构建 additionalInstructions（V2 精细化） =====
// 基于 gamma/route.ts 的 INSTRUCTION_TEMPLATES 精简版
function buildAdditionalInstructions(config: any, analysis: any): string {
  const tone = config.tone || 'professional';
  const imageSource = config.imageSource || 'pictographic';
  const scene = analysis.scene || '通用';

  // 通用排版规则
  const baseRules = [
    '用中文生成PPT。',
    '全局正文使用大文本（≥24pt），禁止小字。',
    '不要将列表排成表格形式，超过4个并列项请拆分到多页。',
    '每页3-4个要点用卡片布局。',
    '内容少的页面用图标或色块填充留白区域。',
    '使用无衬线字体风格。',
    '保持演讲者备注。',
    '整体风格统一，专业但不死板。',
    '所有图标和装饰元素必须使用Unicode符号/emoji代替web SVG图标，确保PPTX下载后完整显示。',
  ];

  // 语气风格
  const toneMap: Record<string, string[]> = {
    professional: ['配色：克制优雅，主色深蓝/深灰+1个强调色，大面积留白。', '感觉：麦肯锡/BCG咨询PPT风格。'],
    casual: ['配色：明亮清新，主色蓝/绿+浅色背景。', '感觉：Notion/Figma风格，友好亲切。'],
    creative: ['配色：大丰富，2-3个亮色渐变。', '感觉：Apple发布会风格，前卫震撼。'],
    bold: ['配色：深色主题，深蓝/深灰背景+亮色文字。', '感觉：高端科技公司品牌发布。'],
  };
  baseRules.push(...(toneMap[tone] || toneMap.professional));

  // 图片源指令
  const imgMap: Record<string, string> = {
    pictographic: '使用摘要图/插图填充，风格：professional, clean, minimalist.',
    noImages: '不使用任何外部图片，纯文字+图标+色块设计.',
    webFreeToUseCommercially: '封面和结尾必须配高质量网图，内容页适当配图.',
    themeAccent: '使用主题内置强调图，封面和结尾必须配图.',
  };
  baseRules.push(imgMap[imageSource] || imgMap.pictographic);

  // 场景特定指令
  const sceneMap: Record<string, string> = {
    '数据分析': '重点使用图表、数据可视化元素。',
    '路演融资': '封面必须有高质量配图，整体风格专业大气。',
    '培训课件': '每页内容简洁，适合教学演示，多用图标辅助理解。',
    '科技AI': '使用科技感图标，深色背景+亮色强调。',
  };
  if (sceneMap[scene]) baseRules.push(sceneMap[scene]);

  return baseRules.join('\n');
}

// ===== AI调用：Kimi K2-thinking(深度分析) → MiniMax → GLM =====
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
    const visualMetaphor = config.visualMetaphor || '';

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
        visualMetaphor,
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
      // Gamma API 完整参数（V2：增加 cardSplit 精确分页）
      gammaPayload: {
        inputText: buildMarkdownFromOutline(outline),
        textMode: 'preserve',
        cardSplit: 'inputTextBreaks',  // ✅ 精确分页控制
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
        },
        exportAs: 'pptx',
      },
    };

    console.log('[SmartOutline] scene:', analysis.scene, '| theme:', themeId, '| imageSource:', imageSource, '| slides:', outline.slides?.length);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[SmartOutline] Error:', error);
    return NextResponse.json({ error: error.message || '处理失败' }, { status: 500 });
  }
}
