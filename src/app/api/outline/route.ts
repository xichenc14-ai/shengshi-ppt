import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getRateLimitConfig } from '@/lib/rate-limit';
import { callKimi, callKimiWithSearch } from '@/lib/kimi-client';
import { callMiniMax, callMiniMaxWithRetry } from '@/lib/minimax-client';
import { callGLM } from '@/lib/glm-client';
import { THEME_DATABASE } from '@/lib/theme-database';

// Serverless Runtime（v10.9在此模式下成功）
export const runtime = 'nodejs';

// 延长超时至60秒（Vercel Hobby支持maxDuration=60）
export const maxDuration = 60;

// 有效主题ID集合（用于验证AI返回值）
const THEME_DATABASE_IDS = new Set(THEME_DATABASE.map(t => t.id));

const SCENE_THEME_MAP: Record<string, { themeId: string; tone: string; imageMode: string }> = {
  '商务汇报': { themeId: 'consultant', tone: 'professional', imageMode: 'theme-img' },
  '路演融资': { themeId: 'founder', tone: 'professional', imageMode: 'theme-img' },
  '数据分析': { themeId: 'gleam', tone: 'professional', imageMode: 'theme-img' },
  '年度总结': { themeId: 'blues', tone: 'professional', imageMode: 'theme-img' },
  '学术研究': { themeId: 'ash', tone: 'professional', imageMode: 'theme-img' },
  '医疗健康': { themeId: 'commons', tone: 'professional', imageMode: 'theme-img' },
  '房地产': { themeId: 'luxe', tone: 'professional', imageMode: 'theme-img' },
  '科技AI': { themeId: 'aurora', tone: 'bold', imageMode: 'theme-img' },
  '产品发布': { themeId: 'aurora', tone: 'bold', imageMode: 'theme-img' },
  '创意方案': { themeId: 'electric', tone: 'creative', imageMode: 'theme-img' },
  '广告营销': { themeId: 'atmosphere', tone: 'creative', imageMode: 'theme-img' },
  '美妆时尚': { themeId: 'ashrose', tone: 'casual', imageMode: 'theme-img' },
  '生活方式': { themeId: 'finesse', tone: 'casual', imageMode: 'theme-img' },
  '婚礼庆典': { themeId: 'coral-glow', tone: 'casual', imageMode: 'theme-img' },
  '培训课件': { themeId: 'icebreaker', tone: 'casual', imageMode: 'theme-img' },
  '教育课件': { themeId: 'chisel', tone: 'casual', imageMode: 'theme-img' },
  '高端精致': { themeId: 'aurum', tone: 'professional', imageMode: 'theme-img' },
  '中国风': { themeId: 'festival', tone: 'traditional', imageMode: 'theme-img' },
  '清新简约': { themeId: 'howlite', tone: 'casual', imageMode: 'theme-img' },
  '餐饮美食': { themeId: 'clementa', tone: 'casual', imageMode: 'theme-img' },
  '旅游出行': { themeId: 'dune', tone: 'casual', imageMode: 'theme-img' },
  '通用': { themeId: 'consultant', tone: 'professional', imageMode: 'theme-img' },
};

// ===== JSON 解析函数（带多层修复） =====
function tryParseJson(rawContent: string): any | null {
  if (!rawContent || typeof rawContent !== 'string') return null;

  let cleaned = rawContent.trim();

  // 移除 markdown 代码块标记（可能有多层）
  while (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  }

  // 移除可能的前后缀文字
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
  }

  // 尝试多层修复
  const attempts = [
    cleaned, // 原始
    cleaned.replace(/[\x00-\x1F\x7F]/g, ''), // 移除控制字符
  ];

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      // 尝试截断修复：找到最后一个完整对象并闭合
      const last = attempt.lastIndexOf('}');
      if (last > 0) {
        let fixed = attempt.substring(0, last + 1);
        if (!fixed.endsWith(']')) fixed += ']';
        // 计算缺少的闭合花括号
        let openCount = 0;
        let closeCount = 0;
        for (const ch of fixed) {
          if (ch === '{') openCount++;
          if (ch === '}') closeCount++;
        }
        const missing = openCount - closeCount;
        if (missing > 0 && missing < 10) {
          fixed += '}'.repeat(missing);
        }
        try {
          const parsed = JSON.parse(fixed);
          console.log('[Outline] Truncated JSON repaired successfully');
          return parsed;
        } catch {
          // 继续下一个 attempt
        }
      }
    }
  }

  // 所有修复尝试都失败
  console.error('[Outline] JSON parse error. Raw (first 500):', cleaned.substring(0, 500));
  console.error('[Outline] Raw (last 200):', cleaned.substring(cleaned.length - 200));
  return null;
}

// ===== 联网搜索（降级：直接返回空，让AI依靠知识库） =====

export async function POST(request: NextRequest) {
  try {
    const { inputText, slideCount, textMode = 'generate', auto = false } = await request.json();

    if (!inputText || inputText.trim().length === 0) {
      return NextResponse.json({ error: '请输入内容' }, { status: 400 });
    }

    // V7 输入校验：只限制上限，不限制下限（"咖啡" "5页" 都要能处理）
    if (inputText.length > 10000) {
      return NextResponse.json({ error: '内容过长，请精简到10000字以内' }, { status: 400 });
    }

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const { allowed } = rateLimit(`outline:${ip}`, getRateLimitConfig('/api/outline'));
    if (!allowed) {
      return NextResponse.json({ error: '请求过于频繁，请稍后再试' }, { status: 429 });
    }

    const numCards = slideCount || 10;

    // ===== 省心模式智能判断：分析输入类型 =====
    const smartModeAnalysis = analyzeInputType(inputText);
    let finalTextMode = textMode;

    // 如果是 auto 模式（省心模式），根据分析结果自动选择 textMode
    if (auto) {
      finalTextMode = smartModeAnalysis.recommendedMode;
      console.log('[SmartMode] 输入分析:', {
        type: smartModeAnalysis.type,
        length: smartModeAnalysis.length,
        hasStructure: smartModeAnalysis.hasStructure,
        recommendedMode: smartModeAnalysis.recommendedMode,
        reason: smartModeAnalysis.reason
      });
    }

    // ===== 构建 prompts =====
    const modePrompts: Record<string, string> = {
      generate: `你是顶级PPT内容策划师。根据用户主题生成完整PPT大纲。

## 故事线引擎（自动匹配）
1. SCQA（商务汇报/问题分析）: S现状→C冲突→Q问题→A方案
2. 问题-方案（产品发布/提案）: 问题→影响→方案→计划→效果
3. 英雄之旅（品牌故事/年终总结）: 起点→挑战→转折→胜利→展望
4. 时间线（项目进度/历史回顾）: 过去→现在→未来
5. 对比框架（竞品分析/方案对比）: 现状vs目标→方案对比→推荐→行动
6. What Is/What Could Be（变革/转型）: 现实→理想→交替对比→行动号召
7. 挑战-选择-结果（决策案例）: 挑战→选择→结果→启示
8. 黄金圈 Why-How-What（品牌/产品）: 使命→方法→成果

## 数据可视化标注
涉及数据时在notes中标注图表：趋势📈 折线图 | 比较📊 柱状图 | 占比🥧 饼图 | 关系🔵 散点图 | 流程➡️ 流程图

## 起承转合结构
- 起(1-2页): 封面+背景引入
- 承(中间页): 核心内容展开
- 转(倒数第2页): 数据/成果/洞察
- 合(末页): 总结+金句收尾

## 内容规则
- 保留用户主题/品牌名/产品名等核心信息
- 每要点≤25字，每页3-4要点，禁超4
- 禁止编造数据（百分比/金额必须来自原文）
- 封面和结尾各一句金句(写在notes)

## 🎨 智能风格匹配（核心！根据内容自动选最合适的风格）
- 商务/汇报/数据/金融 → consultant(商务蓝) + professional
- 年度总结/复盘/年报 → blues(高端深蓝) + professional
- 路演/融资/创业/BP → founder(路演深蓝) + professional
- 科技/AI/互联网/软件 → aurora(极光紫) + bold
- 产品发布/新品/功能 → aurora(极光紫) + bold
- 教育/培训/课程 → chisel(文艺棕) + casual
- 美妆/穿搭/时尚/护肤 → ashrose(玫瑰灰) + casual
- 创意/广告/营销/策划 → electric(电光紫) + creative
- 高端/奢华/精品/定制 → aurum(金色奢华) + professional
- 中国风/传统/节日/年味 → festival(节日红金) + traditional
- 简约/极简/清新 → howlite(极简白) + casual
- 学术/论文/研究/报告 → ash(几何灰) + professional
- 生活方式/旅行/美食 → finesse(优雅米绿) + casual
- 婚礼/庆典/浪漫 → coral-glow(珊瑚粉) + casual
- 餐饮/食品/烘焙 → clementa(温暖复古) + casual
- 医疗/健康/养生 → commons(灰白绿) + professional
- 房地产/建筑/家居 → luxe(奢侈深棕) + professional
- 数据/分析/统计/报表 → gleam(冷银科技) + professional
- 不确定 → consultant(商务蓝) + professional

## 🖼️ 智能图片模式（根据用户需求关键词）
- 用户提到"搜索图/网图/真实图片" → imageMode: "web"
- 用户提到"AI图/生成图/定制图" → imageMode: "ai"
- 用户提到"无图/纯文字/不需要图" → imageMode: "none"
- 默认（无特殊要求） → imageMode: "theme-img"

## 输出格式
严格输出JSON，不用markdown代码块：
{"title":"PPT主标题","scene":"场景类型","storyline":"故事线名","themeId":"主题ID","tone":"professional/casual/creative/bold/traditional","imageMode":"theme-img/web/ai/none","slides":[{"title":"页面标题≤15字","content":["要点1≤25字","要点2","要点3"],"notes":"备注"}]}

总共${numCards}页`,

      condense: `你是顶级PPT内容策划师。提炼用户内容精华，生成精简PPT大纲。

## 规则
- 识别原文叙事结构，在notes标注故事线类型
- 数据页标注图表(📈折线/📊柱状/🥧饼图/➡️流程图)
- 起承转合：起(1-2页)→承(核心)→转(数据/成果)→合(金句收尾)
- 保留品牌名/产品名等专有名词，一字不改
- 每要点≤20字，每页3-4要点
- 禁止编造原文没有的数据/案例

## 🎨 智能风格匹配
根据内容自动选最佳风格：商务→consultant | 科技→aurora | 教育→chisel | 美妆→ashrose | 创意→electric | 高端→aurum | 中国风→festival | 简约→howlite | 学术→ash | 年度→blues | 路演→founder | 数据→gleam | 生活→finesse

## 🖼️ 智能图片模式
用户提"搜索图/网图"→web | "AI图/生成图"→ai | "无图/纯文字"→none | 默认→theme-img

## 输出格式
严格JSON，不用markdown代码块：
{"title":"PPT主标题","scene":"场景","storyline":"故事线","themeId":"主题ID","tone":"professional/casual/creative/bold/traditional","imageMode":"theme-img/web/ai/none","slides":[{"title":"标题≤15字","content":["要点1≤20字","要点2","要点3"],"notes":"备注"}]}

总共${numCards}页`,

      preserve: `你是PPT内容策划师。将用户内容结构化分页，一字不改原文。

## 核心原则
- 逐字保留原文，禁止删改/合并/拆分句子
- 仅做结构化分页，每页≤4要点，超出拆页加"(续)"
- 保留专有名词/数字/日期完整
- 在notes标注故事线走向和数据图表(📈📊🥧➡️)

## 🎨 智能风格匹配
根据内容自动选最佳风格：商务→consultant | 科技→aurora | 教育→chisel | 美妆→ashrose | 创意→electric | 高端→aurum | 中国风→festival | 简约→howlite | 学术→ash | 年度→blues | 路演→founder | 数据→gleam | 生活→finesse

## 🖼️ 智能图片模式
用户提"搜索图/网图"→web | "AI图/生成图"→ai | "无图/纯文字"→none | 默认→theme-img

## 输出格式
严格JSON，不用markdown代码块：
{"title":"从原文提取的主标题","scene":"场景","themeId":"主题ID","tone":"professional/casual/creative/bold/traditional","imageMode":"theme-img/web/ai/none","slides":[{"title":"从原文提取的标题","content":["原文逐句复制"],"notes":"备注"}]}

总共${numCards}页`,
    };

    const systemPrompt = modePrompts[finalTextMode] || modePrompts.generate;
    const baseUserPrompt = auto
      ? `【智能模式分析结果】
输入类型：${smartModeAnalysis.type}
处理策略：${smartModeAnalysis.reason}
推荐模式：${smartModeAnalysis.recommendedMode}

请根据以上分析，${smartModeAnalysis.processInstruction}

素材内容：
${inputText}`
      : `请根据以下内容生成PPT大纲（${numCards}页）：\n\n${inputText}`;

    // ===== 联网搜索（暂不需要，AI 知识库足够） =====
    const searchContext = '';

    // ===== 调用 AI（带 fallback 链 + 重试机制 + JSON 验证） =====
    // 核心：每个 AI 调用后立即验证 JSON，失败则继续下一个模型
    let parsed: any = null;
    let aiError = '';

    // 1. MiniMax M2.7 (Primary) - 8s 超时，快速失败给 fallback
    if (!parsed) {
      try {
        const rawContent = await callMiniMaxWithRetry(
          [{ role: 'user', content: baseUserPrompt }],
          { system: systemPrompt, maxTokens: 4096, temperature: 0.5, maxRetries: 2, timeoutMs: 8000 }
        );
        if (rawContent) {
          parsed = tryParseJson(rawContent);
          if (!parsed) {
            aiError = 'MiniMax: JSON 解析失败';
            console.warn('[Outline] MiniMax JSON parse failed');
          }
        }
      } catch (e: any) {
        aiError = `MiniMax: ${e.message}`;
        console.warn('[Outline] MiniMax failed:', aiError);
      }
    }

    // 2. Kimi K2.5 (Fallback) - 45s 超时
    if (!parsed) {
      try {
        const kimiResult = await callKimi(
          [{ role: 'user', content: baseUserPrompt }],
          { system: systemPrompt, maxTokens: 4096, temperature: 0.5, timeoutMs: 45000 }
        );
        const rawContent = typeof kimiResult === 'string' ? kimiResult : kimiResult?.content || '';
        if (rawContent) {
          parsed = tryParseJson(rawContent);
          if (!parsed) {
            aiError += ' | Kimi: JSON 解析失败';
            console.warn('[Outline] Kimi JSON parse failed');
          }
        }
      } catch (e2: any) {
        aiError += ` | Kimi: ${e2.message}`;
        console.warn('[Outline] Kimi failed:', e2.message);
      }
    }

    // 3. GLM-5 (Last resort) - 30s 超时
    if (!parsed) {
      try {
        const rawContent = await callGLM(systemPrompt, baseUserPrompt, 'outline');
        if (rawContent) {
          parsed = tryParseJson(rawContent);
          if (!parsed) {
            aiError += ' | GLM: JSON 解析失败';
            console.warn('[Outline] GLM JSON parse failed');
          }
        }
      } catch (e3: any) {
        aiError += ` | GLM: ${e3.message}`;
        console.warn('[Outline] GLM failed:', e3.message);
      }
    }

    // 所有模型都失败了
    if (!parsed) {
      throw new Error(`大纲生成失败: ${aiError || '所有 AI 返回内容无法解析'}`);
    }

    // ===== 构建返回结果 =====
    const fullText = `${parsed.title || ''} ${(parsed.slides || []).map((s: any) => s.title).join(' ')}`.toLowerCase();
    const detectedScene = parsed.scene || detectScene(fullText);
    const sceneConfig = SCENE_THEME_MAP[detectedScene] || SCENE_THEME_MAP['通用'];

    // 验证 AI 返回的 themeId 是否有效，无效则用场景默认
    const aiThemeId = parsed.themeId;
    const validThemeId = aiThemeId && THEME_DATABASE_IDS.has(aiThemeId) ? aiThemeId : sceneConfig.themeId;

    const slides = (parsed.slides || []).map((s: any, i: number) => ({
      id: Math.random().toString(36).substring(2, 9),
      title: s.title || `第${i + 1}页`,
      content: s.content || [],
      notes: s.notes,
    }));

    return NextResponse.json({
      title: parsed.title || 'PPT',
      slides,
      themeId: validThemeId,
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

// ===== 省心模式智能输入分析 =====
function analyzeInputType(input: string): {
  type: string;
  length: number;
  hasStructure: boolean;
  recommendedMode: 'preserve' | 'condense' | 'generate';
  reason: string;
  processInstruction: string;
  needsSearch: boolean;
} {
  const text = input.trim();
  const length = text.length;

  // 检测是否有结构化内容（标题、列表、分段等）
  const hasMarkdownHeaders = /^#+\s/.test(text) || /\n#+\s/.test(text);
  const hasBulletPoints = /^[\-\*]\s/.test(text) || /\n[\-\*]\s/.test(text);
  const hasNumberedLists = /^\d+\.\s/.test(text) || /\n\d+\.\s/.test(text);
  const hasMultipleParagraphs = (text.split('\n\n').length >= 3);
  const hasFileMarkers = text.includes('[文件') || text.includes('[文档') || text.includes('[图片');
  const hasStructure = hasMarkdownHeaders || hasBulletPoints || hasNumberedLists || hasMultipleParagraphs || hasFileMarkers;

  // 检测是否是完整文档（长文本 + 结构化）
  const isFullDocument = length > 800 && hasStructure;

  // 检测是否是简单描述（短文本 + 无结构）
  const isSimpleDescription = length < 200 && !hasStructure;

  // 检测是否需要联网搜索补充信息
  const needsSearch = length < 500 && !hasFileMarkers;

  // 判断处理模式
  let recommendedMode: 'preserve' | 'condense' | 'generate';
  let type: string;
  let reason: string;
  let processInstruction: string;

  if (isFullDocument) {
    // 结构化长文档，无论多长，优先执行无损排版 (preserve)
    // 现代大模型足以消化长文本，切忌擅自精简导致原意篡改
    recommendedMode = 'preserve';
    type = '完整文档（长文本结构化）';
    reason = '用户提供了结构完整的文档，应当忠实保留原文内容和结构';
    processInstruction = '逐字保留用户原文的核心内容，仅做结构化分页，不要擅自删减或扩写';
  } else if (isSimpleDescription) {
    // 简单描述 → AI扩充
    recommendedMode = 'generate';
    type = '简单主题描述';
    reason = '用户只给了简短描述，需要AI从零生成完整内容';
    processInstruction = '根据用户主题，从零生成完整的PPT内容，包含封面、目录、正文、总结';
  } else if (hasFileMarkers) {
    // 上传了文件 → 根据内容量判断
    if (length > 1000) {
      recommendedMode = 'preserve';
      type = '文件内容（完整）';
      reason = '用户上传文件提取的内容，应当保留原文';
      processInstruction = '保留文件提取的内容结构，整理为PPT，不要大幅修改';
    } else {
      recommendedMode = 'generate';
      type = '文件内容（简短）';
      reason = '文件内容较短，需要AI补充丰富';
      processInstruction = '基于文件内容补充相关信息，生成完整PPT';
    }
  } else {
    // 默认：保留原文
    recommendedMode = 'preserve';
    type = '结构化内容';
    reason = '用户提供了有一定结构的内容，优先保留';
    processInstruction = '整理用户内容为PPT格式，保持原文核心结构';
  }

  return {
    type,
    length,
    hasStructure,
    recommendedMode,
    reason,
    processInstruction,
    needsSearch
  };
}