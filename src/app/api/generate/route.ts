import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Presentation } from '@/lib/types';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// 套餐积分配置（与 payment/route.ts 保持一致）
const BASE_CREDIT_PER_PAGE = 2;

function calcCredits(numPages: number, imageSource: string, imageModel?: string, estimatedImages?: number): number {
  let total = numPages * BASE_CREDIT_PER_PAGE;
  if (imageSource === 'aiGenerated') {
    const HIGH_MODELS = ['imagen-3-pro', 'flux-1-pro', 'ideogram-v3-turbo', 'luma-photon-1', 'leonardo-phoenix', 'flux-kontext-pro', 'imagen-4-pro', 'ideogram-v3', 'gemini-2.5-flash-image'];
    const perImage = (imageModel && HIGH_MODELS.includes(imageModel)) ? 10 : 2;
    const count = estimatedImages ?? Math.ceil(numPages / 2);
    total += count * perImage;
  }
  return total;
}

/**
 * 原子化扣积分（与 user/route.ts 的 deduct 逻辑一致）
 */
async function atomicDeductCredits(sb: NonNullable<ReturnType<typeof getSupabase>>, userId: string, amount: number, description: string): Promise<{ success: boolean; balance?: number; error?: string }> {
  try {
    type DeductCreditsRpc = (
      name: 'deduct_credits_atomic',
      params: { p_user_id: string; p_amount: number; p_description: string }
    ) => unknown;

    const { data: rpcResult, error: rpcErr } = await ((sb.rpc as unknown) as DeductCreditsRpc)('deduct_credits_atomic', {
      p_user_id: userId,
      p_amount: amount,
      p_description: description,
    }) as { data: unknown; error: unknown };

    if (!rpcErr) {
      return { success: true, balance: (rpcResult as any)?.new_balance ?? undefined };
    }
  } catch {}

  // Fallback: 乐观锁
  const { data: current, error: qErr } = await sb.from('users').select('credits').eq('id', userId).single();
  if (qErr || !current) return { success: false, error: '用户不存在' };
  const currentCredits = Number(((current as { credits?: number | null }).credits ?? 0));
  if (currentCredits < amount) return { success: false, error: '积分不足' };

  const newBal = currentCredits - amount;
  const usersTable = sb.from('users') as unknown as {
    update: (values: { credits: number }) => {
      eq: (column: string, value: unknown) => {
        eq: (column: string, value: unknown) => Promise<{ error: unknown }>;
      };
    };
  };
  const { error: updErr } = await usersTable.update({ credits: newBal }).eq('id', userId).eq('credits', currentCredits);
  if (updErr) return { success: false, error: '积分扣除失败' };

  try {
    const creditTransactionsTable = sb.from('credit_transactions') as unknown as {
      insert: (values: {
        user_id: string;
        amount: number;
        balance_after: number;
        type: string;
        description: string;
      }) => Promise<{ error: unknown }>;
    };
    await creditTransactionsTable.insert({
      user_id: userId, amount: -amount, balance_after: newBal,
      type: 'generation', description,
    });
  } catch {}

  return { success: true, balance: newBal };
}

/**
 * 回滚积分（与 user/route.ts 的 rollback 逻辑一致）
 */
async function rollbackCredits(sb: NonNullable<ReturnType<typeof getSupabase>>, userId: string, amount: number, reason: string): Promise<void> {
  const { data: current } = await sb.from('users').select('credits').eq('id', userId).single();
  if (!current) return;
  const rollbackCurrentCredits = Number(((current as { credits?: number | null }).credits ?? 0));
  const newBal = rollbackCurrentCredits + amount;
  const rollbackUsersTable = sb.from('users') as unknown as {
    update: (values: { credits: number }) => {
      eq: (column: string, value: unknown) => {
        eq: (column: string, value: unknown) => Promise<{ error: unknown }>;
      };
    };
  };
  await rollbackUsersTable.update({ credits: newBal }).eq('id', userId).eq('credits', rollbackCurrentCredits);
  try {
    const rollbackTransactionsTable = sb.from('credit_transactions') as unknown as {
      insert: (values: {
        user_id: string;
        amount: number;
        balance_after: number;
        type: string;
        description: string;
      }) => Promise<{ error: unknown }>;
    };
    await rollbackTransactionsTable.insert({
      user_id: userId, amount, balance_after: newBal,
      type: 'rollback', description: `回滚-${reason}-返还${amount}积分`,
    });
  } catch {}
}

// AI生成PPT内容的API Route
// 流程: 先生成 → 生成成功则扣积分 → 失败则自动回滚（不扣积分）
export async function POST(request: NextRequest) {
  let userId: string | undefined;
  let creditsToDeduct = 0;
  let creditDeducted = false;
  let sb: ReturnType<typeof getSupabase> | null = null;

  try {
    const body = await request.json();
    const { topic, slideCount = 8, style = 'professional', userId: uid, imageSource, imageModel, estimatedImages } = body;
    userId = uid;

    if (!topic || topic.trim().length === 0) {
      return NextResponse.json({ error: '请输入PPT主题' }, { status: 400 });
    }

    // 计算积分（但不扣）
    creditsToDeduct = calcCredits(slideCount, imageSource, imageModel, estimatedImages);

    // 初始化数据库
    sb = getSupabase();

    // 验证用户积分充足（生成前预检）
    if (sb && userId && creditsToDeduct > 0) {
      const { data: user } = await sb.from('users').select('credits').eq('id', userId).single();
      if (user && (user.credits || 0) < creditsToDeduct) {
        return NextResponse.json(
          { error: '积分不足', needed: creditsToDeduct, balance: user.credits || 0 },
          { status: 402 }
        );
      }
    }

    // ===== 阶段1: 调用 AI 生成内容 =====
    const apiKey = process.env.MYDAMOXING_API_KEY;
    if (!apiKey) {
      console.warn('MYDAMOXING_API_KEY not set, returning sample data');
      const presentation = generateSamplePresentation(topic);
      // fallback 模式不扣积分
      return NextResponse.json({ presentation, usedFallback: true });
    }

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
      // AI 调用失败 → 不扣积分，直接返回错误
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

    // ===== 阶段2: 生成成功 → 扣积分 =====
    if (sb && userId && creditsToDeduct > 0) {
      const desc = `生成PPT-${slideCount}页-${imageSource || 'themeAccent'}${imageModel ? `-${imageModel}` : ''}-共${creditsToDeduct}积分`;
      const deductResult = await atomicDeductCredits(sb, userId, creditsToDeduct, desc);
      if (deductResult.success) {
        creditDeducted = true;
        return NextResponse.json({
          presentation,
          creditsUsed: creditsToDeduct,
          balance: deductResult.balance,
        });
      } else {
        // 扣积分失败 → 生成已成功但无法扣积分
        // 这是极罕见边界情况，记录为严重错误，但仍返回PPT（用户已获得价值）
        console.error(`[Generate] 生成成功但扣积分失败 userId=${userId}, credits=${creditsToDeduct}, error=${deductResult.error}`);
        return NextResponse.json({
          presentation,
          creditsUsed: 0,
          balance: null,
          warning: '积分扣除失败，请联系客服',
        });
      }
    }

    return NextResponse.json({ presentation });

  } catch (error: any) {
    // ===== 生成失败 → 无需回滚（未扣积分） =====
    console.error('[Generate] 生成失败:', error?.message);

    // 如果已扣积分但后续出错，尝试回滚
    if (sb && userId && creditsToDeduct > 0 && creditDeducted) {
      await rollbackCredits(sb, userId, creditsToDeduct, '生成异常');
      return NextResponse.json(
        { error: error.message || '生成失败，请重试（积分已返还）' },
        { status: 500 }
      );
    }

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
