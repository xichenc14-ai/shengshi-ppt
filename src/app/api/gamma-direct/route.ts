import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getRateLimitConfig, getClientIP, isIPBlocked } from '@/lib/rate-limit';
import { selectBestKey, updateKeyBalance, recordKeyFailure } from '@/lib/gamma-key-pool';
import { SCENE_CONFIGS, INSTRUCTION_TEMPLATES, GAMMA_UA, buildImageOptions, appendIconInstructions } from '@/lib/gamma-config';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';

const MAX_RETRIES = 3;

// POST: 直通模式 - 调用 Gamma API 并等待完成,直接返回下载链接
export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  if (isIPBlocked(ip)) {
    return NextResponse.json({ error: '请求受限' }, { status: 403 });
  }
  const { allowed } = rateLimit(`gamma_direct:${ip}`, getRateLimitConfig('/api/gamma-direct'));
  if (!allowed) {
    return NextResponse.json({ error: '生成请求过于频繁,请稍后再试' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const {
      inputText,
      themeId,
      numCards = 8,
      tone = 'professional',
      textMode = 'preserve',
      imageSource = 'webFreeToUseCommercially',
      exportAs = 'pdf',
      visualMetaphor,
    } = body;

    if (!inputText?.trim()) {
      return NextResponse.json({ error: '请输入内容' }, { status: 400 });
    }

    // 🚨 V8: 使用Key池智能选择
    const selectedKey = selectBestKey();
    const apiKey = selectedKey.key;
    console.log('[Gamma Direct] 使用Key:', selectedKey.label, '| 余额:', selectedKey.remaining);

    const finalThemeId = themeId || SCENE_CONFIGS.biz.themeId;

    // 构建最终文本
    let finalInputText = inputText.trim();
    if (finalInputText.length < 100) {
      finalInputText = `# ${finalInputText}\n\n---\n`;
    } else if (!finalInputText.includes('---')) {
      finalInputText = finalInputText.split(/\n\n+/).filter((p: string) => p.trim()).join('\n\n---\n\n');
    }

    // 图片选项：使用共享的 buildImageOptions
    const imageOptions = buildImageOptions(imageSource, finalThemeId);

    const instructions = INSTRUCTION_TEMPLATES[tone] || INSTRUCTION_TEMPLATES.professional;
    const metaphorAppend = visualMetaphor
      ? `\n\n【全局视觉隐喻】\n贯穿全演示的统一意象:${visualMetaphor}。\n所有配图、图标、色块风格应与此意象一致,配图描述中必须体现该意象关键词。`
      : '';
    const themeAppend = (imageSource === 'theme' || imageSource === 'theme-img')
      ? `\n\n【主题套图-Pexels高质量照片】\n请为每一页配Pexels高质量照片,照片风格:professional, clean, minimalist, business context。每页使用不同的照片和Gamma内置的Emphasize强调布局,保持视觉丰富度。`
      : '';
    const finalInstructions = appendIconInstructions(instructions + metaphorAppend + themeAppend);

    // Gamma API 只支持 generate/preserve
    const gammaTextMode = textMode === 'generate' ? 'generate' : 'preserve';

    // 🚨 V10: 根据 textMode 构建不同的 CRITICAL 指令
    const criticalMap: Record<string, string> = {
      preserve: `\n\n【CRITICAL - 严格保持原文模式】
你是一个纯排版渲染引擎（layout engine ONLY）。
- 禁止创作、扩写、修改、删减任何用户提供的文字内容
- 禁止改变用户提供的标题/要点/结构的任何字句
- 严格按照提供的 Markdown 层级和 --- 分割线生成卡片
- 禁止自动合并或拆分 --- 指定的页面边界
- 全局正文强制使用大文本（### 或 **粗体**），禁止普通小字正文
- 所有 '>' 引用块严格作为演讲者备注，不做正文展示
- 如需填充视觉空白，只使用图标/色块/布局，不添加任何文字内容`,
      condense: `\n\n【CRITICAL - 精简模式】
你是一个内容精简引擎。
- 保留用户提供的所有核心要点（标题/关键句），不得删除任何要点
- 只精简冗余表述（如同义重复、过渡句、修饰词）
- 保持原有的 Markdown 层级和 --- 分割线不变
- 每页只放3-4个核心要点，禁止增加新要点
- 全局正文强制使用大文本（### 或 **粗体**），禁止普通小字正文
- 禁止合并或拆分 --- 指定的页面边界
- 所有 '>' 引用块严格作为演讲者备注，不做正文展示`,
      generate: `\n\n【CRITICAL - 扩充模式】
你是一个内容扩充引擎。
- 保留用户提供的所有核心要点（标题/关键句），不得删除或替换要点
- 可以在每个要点下添加简短说明（每条1-2句话），丰富内容
- 保持原有的 Markdown 层级和 --- 分割线不变
- 每页只放3-4个核心要点，禁止无限制扩充
- 全局正文强制使用大文本（### 或 **粗体**），禁止普通小字正文
- 禁止合并或拆分 --- 指定的页面边界
- 所有 '>' 引用块严格作为演讲者备注，不做正文展示`,
    };
    const criticalInstruction = criticalMap[textMode] || criticalMap.preserve;

    const gammaPayload = {
      inputText: finalInputText,
      textMode: gammaTextMode,
      format: 'presentation',
      numCards,
      exportAs,
      themeId: finalThemeId,
      cardSplit: 'inputTextBreaks',
      additionalInstructions: finalInstructions + '\n\n【PPTX兼容性-图标规范】\n所有图标和装饰元素必须使用Unicode符号/emoji代替web SVG图标。' + criticalInstruction,
      textOptions: { amount: 'medium', tone, language: 'zh-cn' },
      imageOptions,
      cardOptions: { dimensions: '16x9' },
    };

    // 🚨 V10: 添加 429 退避重试机制（与 gamma/route.ts 保持一致）
    let lastStatus = 0;
    let lastError = '';

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      // 429 之后选择新的 key 重试
      if (attempt > 1) {
        const newKey = selectBestKey();
        if (newKey.key !== apiKey) {
          console.log(`[Gamma Direct] 重试 ${attempt}: 切换到 Key: ${newKey.label}`);
        }
      }

      const createRes = await fetch(`${GAMMA_API_BASE}/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey,
          'User-Agent': GAMMA_UA,
        },
        body: JSON.stringify(gammaPayload),
      });

      // 读取 Rate-Limit headers
      const rlRemaining = createRes.headers.get('X-RateLimit-Remaining');
      const rlReset = createRes.headers.get('X-RateLimit-Reset');
      if (rlRemaining !== null) {
        console.log(`[Gamma Direct] RateLimit: remaining=${rlRemaining}, reset=${rlReset}`);
      }

      if (createRes.status === 429) {
        lastStatus = 429;
        const retryAfter = createRes.headers.get('Retry-After');
        const retrySec = retryAfter ? parseInt(retryAfter) : Math.min(5 * Math.pow(2, attempt - 1), 60);
        console.warn(`[Gamma Direct] 429 Rate Limited，${retrySec}s 后重试 (${attempt}/${MAX_RETRIES})`);
        recordKeyFailure(apiKey, retrySec);

        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, retrySec * 1000));
          continue;
        } else {
          const errText = await createRes.text();
          return NextResponse.json(
            { error: `Gamma 请求过于频繁，请稍后再试（已重试${MAX_RETRIES}次）`, detail: errText.substring(0, 500) },
            { status: 429 }
          );
        }
      }

      if (createRes.ok) {
        const createData = await createRes.json();
        const generationId = createData.generationId || createData.id;

        if (createData.credits) {
          updateKeyBalance(apiKey, createData.credits.deducted, createData.credits.remaining);
          console.log('[Gamma Direct] 积分扣除:', createData.credits.deducted, '| 剩余:', createData.credits.remaining);
        }

        return NextResponse.json({
          generationId,
          message: '直通生成任务已创建',
          credits: createData.credits,
        });
      }

      // 非 429 错误
      lastStatus = createRes.status;
      lastError = await createRes.text();
      console.error(`[Gamma Direct] API error (attempt ${attempt}):`, createRes.status, lastError);
      recordKeyFailure(apiKey);
      break;
    }

    return NextResponse.json(
      { error: `Gamma API 调用失败: ${lastStatus}`, detail: lastError.substring(0, 500) },
      { status: lastStatus === 400 ? 400 : 502 }
    );
  } catch (error: any) {
    console.error('Gamma direct error:', error);
    return NextResponse.json({ error: error.message || '生成失败' }, { status: 500 });
  }
}
