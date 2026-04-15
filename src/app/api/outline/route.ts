import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getRateLimitConfig } from '@/lib/rate-limit';
import { callKimi, callKimiWithSearch } from '@/lib/kimi-client';
import { callMiniMax, callMiniMaxWithRetry } from '@/lib/minimax-client';
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
      generate: `你是一位顶级PPT内容策划师，精通麦肯锡/BCG/贝恩的演示方法论。你需要为用户生成一份有故事线、有逻辑、有数据的完整PPT大纲。

## 一、故事线引擎（核心）

根据用户主题，自动选择最匹配的故事线结构：

1. **SCQA框架**（商务汇报/问题分析类）：
   - S 背景（现状/市场环境）
   - C 冲突（痛点/挑战/问题）
   - Q 疑问（如何解决？）
   - A 回答（方案/策略/行动）

2. **问题-解决方案**（产品发布/提案类）：
   - 问题定义 → 影响分析 → 解决方案 → 实施计划 → 预期成果

3. **英雄之旅**（品牌故事/年度总结类）：
   - 起点（出发）→ 挑战（困境）→ 转折（突破）→ 胜利（成果）→ 展望（未来）

4. **时间线**（项目进展/历程回顾类）：
   - 过去（基础/起点）→ 现在（进展/成就）→ 未来（规划/目标）

5. **对比框架**（竞品分析/方案对比类）：
   - 现状 vs 目标 → 方案A vs 方案B → 推荐方案 → 行动计划

选择规则：根据用户主题关键词自动匹配最合适的结构，并在notes中说明选择理由。

## 二、数据可视化规则

当内容涉及数据时，必须为该页标注推荐的图表类型（写在notes中）：
- 趋势变化（时间序列）→ 折线图 📈
- 数量比较（多项目对比）→ 柱状图 📊
- 占比/份额（整体与部分）→ 饼图/环形图 🥧
- 关系/分布（多维度）→ 散点图 🔵
- 流程/步骤（阶段递进）→ 流程图 ➡️
- 排名/名次 → 水平柱状图 📋
- 无数据 → 不标注

## 三、逻辑结构（起承转合）

每份PPT必须遵循起承转合结构：
- **起**（第1-2页）：封面 + 背景/问题引入，抓住注意力
- **承**（第3-N-2页）：核心内容展开，层层递进
- **转**（倒数第2页）：数据/成果/关键洞察，制造高潮
- **合**（最后1页）：总结 + 行动项/金句收尾

## 四、金句注入

仅在封面和结尾页各放一句金句（写在notes中），其他页面不需要金句。

## 五、内容规则

- 严格保留用户提供的主题、品牌名、产品名、公司名等核心信息
- 可以补充背景信息、常见案例、合理推断
- 每个要点最多25字，禁止超长堆砌
- 每页3-4个要点，禁止超过4个
- 禁止编造具体数据（百分比、具体金额等必须来自原文或常识）

## 六、输出格式

严格输出JSON，不要用markdown代码块包裹：
{
  "title": "PPT主标题（必须包含用户提供的主题关键词）",
  "scene": "场景类型",
  "storyline": "使用的故事线名称",
  "themeId": "主题ID",
  "tone": "professional/casual/creative/bold",
  "imageMode": "noImages/pictographic/aiGenerated",
  "slides": [
    {"title": "页面标题（≤15字）", "content": ["要点1（≤25字）", "要点2", "要点3"], "notes": "简短备注"}
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

规则：有故事线、有数据图表、精简notes。总共${numCards}页`,

      condense: `你是一位顶级PPT内容策划师。用户会给内容，你需要提炼精华，生成精简的PPT大纲。

## 一、故事线保持

提炼时保持原文的故事线走向：
- 识别原文的叙述结构（问题→方案、过去→现在→未来、背景→冲突→解决等）
- 在notes中标注识别到的故事线类型
- 精简内容但保持叙事弧线完整

## 二、数据可视化标注

当提炼的内容涉及数据时，在notes中标注推荐图表类型：
- 趋势变化 → 折线图 📈
- 数量比较 → 柱状图 📊
- 占比/份额 → 饼图 🥧
- 流程/步骤 → 流程图 ➡️
- 无数据 → 不标注

## 三、起承转合

精简后仍需保持起承转合结构：
- 起：背景/问题（精简为1-2页）
- 承：核心内容（保留关键论点）
- 转：数据/成果（保留关键数字）
- 合：总结/行动（一句话金句收尾）

## 四、内容规则

- 严格保留品牌名、产品名、公司名等专有名词，一字不改
- 删除冗余重复的表达，只保留核心信息
- 每个要点压缩到20字以内
- 每页只保留3-4个核心要点
- 禁止编造任何原文没有的数据、案例或细节
- 结尾页notes中放一句金句即可

严格输出JSON，不要用markdown代码块包裹：
{
  "title": "PPT主标题",
  "scene": "场景类型",
  "storyline": "识别到故事线",
  "themeId": "主题ID",
  "tone": "professional/casual/creative/bold",
  "imageMode": "noImages/pictographic/aiGenerated",
  "slides": [{"title": "页面标题（≤15字）", "content": ["压缩后的要点1（≤20字）", "要点2", "要点3"], "notes": "简短备注"}]
}

规则：提炼核心要点，保持故事线。总共${numCards}页`,

      preserve: `你是专业的PPT内容策划师。用户会提供已有内容，你的唯一任务是将其**结构化分页**，**一字不改**原文。

核心原则（必须严格遵守）：
- **逐字保留**：用户写的每一个字都要出现在输出中，禁止删改、合并、拆分任何句子
- **仅做结构化**：将原文按内容自然段落分配到不同页面
- **禁止精简/扩写**：不压缩原文，不补充新内容
- **保留专有名词**：品牌名、产品名、数字、日期等必须完整保留
- **分页规则**：每个页面最多4个要点，超出则拆页，标题加"(续)"
- **识别故事线**：在notes中标注原文的故事线走向（如适用）
- **数据标注**：如果某页包含数据，在notes中标注推荐图表类型（📈折线图/📊柱状图/🥧饼图/➡️流程图）

严格输出JSON，不要用markdown代码块包裹：
{
  "title": "PPT主标题（从原文提取，不得自行拟定）",
  "scene": "场景类型",
  "themeId": "主题ID",
  "tone": "professional/casual/creative/bold",
  "imageMode": "noImages/pictographic/aiGenerated",
  "slides": [{
    "title": "页面标题（从原文提取，不得自行拟定）",
    "content": ["原文逐句复制（一字不改）"],
    "notes": "简短备注"
  }]
}

规则：忠实分页，一字不改。总共${numCards}页`,
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

    // ===== 调用 AI（带 fallback 链 + 重试机制） =====
    let rawContent = '';
    let aiError = '';

    // 1️⃣ MiniMax M2.7（首选：速度快，质量高）- 带重试
    try {
      rawContent = await callMiniMaxWithRetry(
        [{ role: 'user', content: baseUserPrompt }],
        { system: systemPrompt, maxTokens: 8192, temperature: 0.7, maxRetries: 3, timeoutMs: 30000 }
      );
    } catch (e2: any) {
      aiError = `MiniMax: ${e2.message}`;
      console.warn('[Outline] MiniMax failed:', aiError);
    }

    // 2️⃣ Kimi K2.5（备用：多模态+长上下文）
    if (!rawContent) {
      try {
        const kimiResult = await callKimiWithSearch(
          baseUserPrompt,
          searchContext,
          { system: systemPrompt, maxTokens: 8192, temperature: 0.7 }
        );
        rawContent = kimiResult.content || '';
      } catch (e: any) {
        aiError += ` | Kimi: ${e.message}`;
        console.warn('[Outline] Kimi failed:', e.message);
      }
    }

    // 3️⃣ GLM-5（兜底）
    if (!rawContent) {
      try {
        rawContent = await callGLM(systemPrompt, baseUserPrompt, 'outline');
      } catch (e3: any) {
        throw new Error(`AI调用全部失败：${aiError} | GLM: ${e3.message}`);
      }
    }

    // 清理 AI 返回内容
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

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('[Outline] JSON parse error. Raw (first 500):', cleaned.substring(0, 500));
      console.error('[Outline] Raw (last 200):', cleaned.substring(cleaned.length - 200));
      // 尝试多层修复
      const attempts = [
        cleaned, // 原始
        cleaned.replace(/[\x00-\x1F\x7F]/g, ''), // 移除控制字符
      ];
      let repaired = false;
      for (const attempt of attempts) {
        if (repaired) break;
        try {
          parsed = JSON.parse(attempt);
          repaired = true;
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
              parsed = JSON.parse(fixed);
              repaired = true;
              console.log('[Outline] Truncated JSON repaired successfully');
            } catch {
              // 继续下一个 attempt
            }
          }
        }
      }
      if (!repaired) {
        throw new Error('大纲格式解析失败，请重试或简化输入内容');
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
  
  // 检测是否是长文档需要精简（超长 + 有结构）
  const isLongDocumentNeedsCondense = length > 2000 && hasStructure;
  
  // 检测是否是简单描述（短文本 + 无结构）
  const isSimpleDescription = length < 200 && !hasStructure;
  
  // 检测是否需要联网搜索补充信息
  const needsSearch = length < 500 && !hasFileMarkers;
  
  // 判断处理模式
  let recommendedMode: 'preserve' | 'condense' | 'generate';
  let type: string;
  let reason: string;
  let processInstruction: string;
  
  if (isFullDocument && length < 1500) {
    // 中等长度完整文档 → 保留原文
    recommendedMode = 'preserve';
    type = '完整文档（中等长度）';
    reason = '用户提供了结构完整的文档，应当忠实保留原文内容和结构';
    processInstruction = '保留用户原文的结构和核心内容，整理为PPT页面，不要大幅修改或删减';
  } else if (isLongDocumentNeedsCondense) {
    // 超长文档 → 精简总结
    recommendedMode = 'condense';
    type = '长文档需要精简';
    reason = '文档过长（>' + Math.floor(length/10) + '页），需要提炼核心要点';
    processInstruction = '提取文档的核心要点和关键信息，精简为PPT大纲，每页不超过3-4个要点';
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
