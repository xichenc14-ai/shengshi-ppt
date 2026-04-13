// smart-outline/route.ts — 省心模式 API V3（全面重构）
//
// 架构：AI 一次性完成「需求分析 + 结构规划 + Gamma 脚本生成」
// 核心：让远程大模型直接生成最终的 Gamma Markdown 脚本
//
// V3 变更：
// 1. 使用 gamma-expert-prompt.ts 的专家提示词
// 2. AI 直接输出 gammaScript（不再输出 JSON slides 再转换）
// 3. 前端直接使用 gammaScript，不再调用 buildMdV2 二次转换
// 4. 修复 gammaPayload 嵌套 bug

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getRateLimitConfig } from '@/lib/rate-limit';
import { callKimi } from '@/lib/kimi-client';
import { callMiniMax } from '@/lib/minimax-client';
import { callGLM } from '@/lib/glm-client';
import { buildSmartSystemPrompt } from '@/lib/gamma-expert-prompt';

// ===== AI 调用链：Kimi K2.5 → MiniMax M2.7 → GLM-5 =====
async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  // 1️⃣ Kimi K2.5（首选：多模态+长上下文，免费代理）
  try {
    const result = await callKimi(
      [{ role: 'user', content: userPrompt }],
      { system: systemPrompt, maxTokens: 8192, model: 'Kimi-K2.5', temperature: 0.7 }
    );
    return result.content;
  } catch (e: any) {
    console.warn('[SmartOutline] Kimi failed:', e.message);
  }

  // 2️⃣ MiniMax M2.7（备用）
  try {
    return await callMiniMax(
      [{ role: 'user', content: userPrompt }],
      { system: systemPrompt, maxTokens: 8192, temperature: 0.7 }
    );
  } catch (e2: any) {
    console.warn('[SmartOutline] MiniMax failed:', e2.message);
  }

  // 3️⃣ GLM-5（兜底）
  try {
    return await callGLM(systemPrompt, userPrompt, 'outline');
  } catch (e3: any) {
    throw new Error(`AI 调用全部失败: ${e3.message}`);
  }
}

// ===== 从 AI 输出中安全提取 JSON =====
function extractJSON(raw: string): string {
  let cleaned = raw.trim();
  // 去掉 markdown 代码块包裹
  while (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  }
  // 找到最外层 JSON
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1) {
    return cleaned.substring(jsonStart, jsonEnd + 1);
  }
  return cleaned;
}

// ===== 验证 gammaScript 质量 =====
function validateGammaScript(script: string): { valid: boolean; issues: string[]; pageCount: number } {
  const issues: string[] = [];

  if (!script || script.trim().length < 50) {
    return { valid: false, issues: ['脚本内容过短或为空'], pageCount: 0 };
  }

  // 检查分页符
  const pages = script.split(/\n---\n/).filter(p => p.trim().length > 0);
  const pageCount = pages.length;

  if (pageCount < 3) {
    issues.push(`页数过少(${pageCount}页)，至少需要3页`);
  }

  if (pageCount > 20) {
    issues.push(`页数过多(${pageCount}页)，建议控制在8-15页`);
  }

  // 检查每页是否有实质内容
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i].trim();
    // 去掉 markdown 标记后检查纯文本长度
    const textOnly = page
      .replace(/^#+\s+/gm, '')
      .replace(/^>\s+/gm, '')
      .replace(/\*\*/g, '')
      .replace(/[-*]\s+/g, '')
      .replace(/\d+\.\s+/g, '')
      .trim();

    if (textOnly.length < 5) {
      issues.push(`第${i + 1}页内容过少或为空`);
    }
  }

  // 检查是否有大文本标记
  const hasH3 = /###\s+.+/.test(script);
  if (!hasH3 && pageCount > 3) {
    issues.push('缺少 ### 大文本标记，正文可能以小字显示');
  }

  return {
    valid: issues.length === 0 || (issues.length === 1 && pageCount >= 3),
    issues,
    pageCount,
  };
}

// ===== 修复常见的 gammaScript 问题 =====
function fixGammaScript(script: string): string {
  let fixed = script;

  // 确保 --- 分页符前后有空行
  fixed = fixed.replace(/\n*---\n*/g, '\n\n---\n\n');

  // 确保 # 封面标题存在
  if (!fixed.startsWith('#')) {
    const firstLine = fixed.split('\n')[0];
    fixed = `# ${firstLine}\n\n${fixed.split('\n').slice(1).join('\n')}`;
  }

  // 移除开头和结尾的多余空行
  fixed = fixed.trim();

  return fixed;
}

// ===== 构建 additionalInstructions（基于分析结果） =====
function buildInstructions(config: any): string {
  const tone = config.tone || 'professional';
  const imageSource = config.imageSource || 'pictographic';
  const visualMetaphor = config.visualMetaphor || '';

  // 基础排版规则（精简版，因为 gammaScript 已经包含了布局控制）
  const base = [
    '用中文生成PPT。',
    '全局正文使用大文本（≥24pt），禁止小字。',
    '不要将列表排成表格形式，超过4个并列项请拆分到多页。',
    '每页3-4个要点用卡片布局。',
    '使用无衬线字体风格。',
    '保持演讲者备注（通过 > 引用块）。',
    '所有图标使用Unicode符号/emoji(如✅❌📊📈💡🎯⭐🔑🚀💼)代替web SVG图标，确保PPTX下载后完整显示。',
  ];

  // 语气
  const toneMap: Record<string, string> = {
    professional: '配色：克制优雅，深蓝/深灰+金色强调，大面积留白。麦肯锡/BCG咨询PPT风格。',
    casual: '配色：明亮清新，蓝/绿+浅色背景，圆角元素。Notion/Figma风格。',
    creative: '配色：丰富渐变，粉/紫/橙，大色块。Apple发布会风格。',
    bold: '配色：深色主题，深蓝/深灰背景+亮色文字，渐变光效。高端科技风格。',
  };
  base.push(toneMap[tone] || toneMap.professional);

  // 配图
  const imgMap: Record<string, string> = {
    pictographic: '使用摘要图/插图填充，风格：Minimalist, clean, professional。',
    noImages: '不使用外部图片，纯文字+图标+色块设计。',
    webFreeToUseCommercially: '封面和结尾配高质量网图，内容页适当配图。',
    aiGenerated: '封面和结尾配AI生成图，风格：Minimalist, clean, negative space。',
  };
  base.push(imgMap[imageSource] || imgMap.pictographic);

  // 视觉隐喻
  if (visualMetaphor) {
    base.push(`贯穿全演示的统一意象：${visualMetaphor}。所有配图、图标风格应与此意象一致。`);
  }

  return base.join('\n');
}

// ===== POST =====
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

    // ===== Phase 1: 构建 AI 提示词 =====
    const systemPrompt = buildSmartSystemPrompt();

    // 构建用户输入（包含文件信息）
    let userPrompt = `用户需求：\n${inputText}`;
    if (uploadedFiles.length > 0) {
      userPrompt += `\n\n用户上传了 ${uploadedFiles.length} 个文件：`;
      userPrompt += uploadedFiles
        .map((f: { name: string; type: string; size: number }) => `  - ${f.name} (${f.type}, ${(f.size / 1024).toFixed(1)}KB)`)
        .join('\n');
      userPrompt += '\n\n请根据用户需求和上传文件的内容，生成专业的 PPT。';
    }

    // ===== Phase 2: 调用 AI 生成 =====
    const rawContent = await callAI(systemPrompt, userPrompt);

    // ===== Phase 3: 解析和验证 =====
    const jsonStr = extractJSON(rawContent);
    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.error('[SmartOutline V3] JSON parse error:', jsonStr.substring(0, 500));
      throw new Error('AI 返回格式解析失败，请重试');
    }

    const analysis = parsed.analysis || {};
    const config = parsed.config || {};
    let gammaScript = parsed.gammaScript || '';

    if (!gammaScript || gammaScript.trim().length < 50) {
      throw new Error('AI 生成的脚本内容为空，请重试');
    }

    // 修复脚本常见问题
    gammaScript = fixGammaScript(gammaScript);

    // 验证脚本质量
    const validation = validateGammaScript(gammaScript);
    console.log('[SmartOutline V3] Validation:', validation);

    // 如果验证失败，尝试自动修复
    if (!validation.valid) {
      console.warn('[SmartOutline V3] Script validation failed:', validation.issues);
      // 如果页数过少，不自动修复（让用户看到问题）
    }

    // 统计页数
    const pageCount = validation.pageCount;

    // ===== Phase 4: 构建 Gamma API 参数 =====
    const finalConfig = {
      themeId: config.themeId || 'consultant',
      tone: config.tone || 'professional',
      imageSource: config.imageSource || 'pictographic',
      numCards: Math.max(pageCount, config.numCards || 8),
      visualMetaphor: config.visualMetaphor || '',
      contentStrategy: analysis.contentStrategy || 'preserve',
    };

    // ===== Phase 5: 返回结果 =====
    // 注意：不再返回 gammaPayload（避免嵌套 bug）
    // 前端直接使用 gammaScript + config 构建 Gamma 请求
    const result = {
      analysis: {
        scene: analysis.scene || '通用',
        purpose: analysis.purpose || '',
        audience: analysis.audience || '',
        contentStrategy: finalConfig.contentStrategy,
        keyTopics: analysis.keyTopics || [],
        contentLength: analysis.contentLength || 'medium',
      },
      config: finalConfig,
      gammaScript,  // ✅ 核心产出：完整的 Gamma Markdown 脚本
      pageCount,
      validation: {
        valid: validation.valid,
        issues: validation.issues,
      },
    };

    console.log(`[SmartOutline V3] ✅ scene=${analysis.scene} theme=${finalConfig.themeId} tone=${finalConfig.tone} image=${finalConfig.imageSource} pages=${pageCount} scriptLen=${gammaScript.length}`);

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[SmartOutline V3] Error:', error);
    return NextResponse.json({ error: error.message || '处理失败' }, { status: 500 });
  }
}
