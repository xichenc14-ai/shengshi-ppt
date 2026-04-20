import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getRateLimitConfig, getClientIP, isIPBlocked } from '@/lib/rate-limit';
import { selectBestKey, updateKeyBalance, recordKeyFailure } from '@/lib/gamma-key-pool';
import { SCENE_CONFIGS, INSTRUCTION_TEMPLATES, DARK_THEMES, GAMMA_UA, buildImageOptions, appendIconInstructions } from '@/lib/gamma-config';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';

// POST: 创建 Gamma 生成任务
export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  if (isIPBlocked(ip)) {
    return NextResponse.json({ error: '请求受限' }, { status: 403 });
  }
  const { allowed } = rateLimit(`gamma:${ip}`, getRateLimitConfig('/api/gamma'));
  if (!allowed) {
    return NextResponse.json({ error: '生成请求过于频繁,请稍后再试' }, { status: 429 });
  }

  // 限制 inputText 长度(防超大payload攻击)
  try {
    const body = await request.json();
    const {
      inputText,
      // 🚨 V8.2:textMode 不再从请求读取,Gamma 固定使用 preserve
      // 原因:大纲已由 outline API 预处理,Gamma 只负责排版
      // 用户选的扩充/缩减/保持,只影响 outline API,不影响 Gamma
      format = 'presentation',
      numCards = 8,
      exportAs = 'pdf',
      themeId,
      scene = 'biz',
      tone,
      imageMode = 'auto',
      slides,
      visualMetaphor,
      // 省心模式传的完整参数
      additionalInstructions,
      imageOptions,
      cardOptions,
      cardSplit,
      textOptions,
    } = body;

    // 🚨 V8.2 核心原则:Gamma API 固定使用 preserve 模式
    // 无论用户选什么模式(扩充/缩减/保持),Gamma 只接收 preserve
    // 因为大纲已经由 outline API 预处理好了,Gamma 只负责排版渲染
    const textMode = 'preserve';

    // 支持结构化 slides 数据或纯文本 inputText
    let finalInputText: string;
    if (inputText && inputText.trim()) {
      // 优先使用 inputText(已由前端 buildMdV2 处理过的高质量 markdown)
      finalInputText = inputText.trim();
      // 短内容自动增强结构
      if (finalInputText.length < 100) {
        finalInputText = `# ${finalInputText}\n\n---\n`;
      } else if (!finalInputText.includes('---') && slides && slides.length > 1) {
        finalInputText = finalInputText.split(/\n\n+/).filter((p: string) => p.trim()).join('\n\n---\n\n');
      }
    } else if (slides && Array.isArray(slides) && slides.length > 0) {
      // 兜底:从结构化 slides 构建 markdown
      const markdown = slides.map((s: any) => {
        const content = (s.content || []).map((c: string) => `- ${c}`).join('\n');
        return `## ${s.title}\n\n${content}`;
      }).join('\n\n---\n\n');
      finalInputText = `# ${slides[0]?.title || 'PPT'}\n\n${markdown}`;
    } else if (inputText) {
      finalInputText = inputText.trim();
      // 短内容自动增强结构
      if (finalInputText.length < 100) {
        finalInputText = `# ${finalInputText}\n\n---\n`;
      } else if (!finalInputText.includes('---')) {
        finalInputText = finalInputText.split(/\n\n+/).filter((p: string) => p.trim()).join('\n\n---\n\n');
      }
    } else {
      return NextResponse.json({ error: '请输入内容' }, { status: 400 });
    }

    if (!finalInputText || !finalInputText.trim()) {
      return NextResponse.json({ error: '请输入内容' }, { status: 400 });
    }

    // 🚨 V8.3 修复:短内容增强时,确保不以空标题开头
    if (finalInputText.length < 100) {
      // 如果 inputText 没有 # 开头,加一个标题
      if (!finalInputText.startsWith('#')) {
        finalInputText = `# PPT\n\n${finalInputText}\n\n---\n`;
      } else {
        finalInputText = `${finalInputText}\n\n---\n`;
      }
    } else if (!finalInputText.includes('---') && slides && slides.length > 1) {
      finalInputText = finalInputText.split(/\n\n+/).filter((p: string) => p.trim()).join('\n\n---\n\n');
    }

    // 🚨 V8: 使用Key池智能选择（替代单一环境变量）
    const selectedKey = selectBestKey();
    const apiKey = selectedKey.key;
    console.log('[Gamma] 使用Key:', selectedKey.label, '| 余额:', selectedKey.remaining);

    const sceneConfig = SCENE_CONFIGS[scene] || SCENE_CONFIGS.biz;
    const finalThemeId = themeId || sceneConfig.themeId;
    const finalTone = tone || sceneConfig.tone;

    // ===== 图片模式处理 =====
    // 如果已传入完整的 imageOptions(省心模式),直接使用
    // 否则根据 imageMode 字符串生成
    let finalImageOptions: Record<string, any>;
    if (imageOptions && typeof imageOptions === 'object' && imageOptions.source) {
      // 省心模式:直接使用传入的 imageOptions
      finalImageOptions = imageOptions;
    } else {
      // 使用共享的 buildImageOptions 工具函数
      finalImageOptions = buildImageOptions(imageMode || 'theme-img', finalThemeId);
    }

    const instructions = INSTRUCTION_TEMPLATES[finalTone] || INSTRUCTION_TEMPLATES.professional;
    // P0修复:追加全局视觉隐喻(如果提供)
    const metaphorAppend = visualMetaphor
      ? `\n\n【全局视觉隐喻】\n贯穿全演示的统一意象:${visualMetaphor}。\n所有配图、图标、色块风格应与此意象一致,配图描述中必须体现该意象关键词。`
      : '';
    // 如果已传入 additionalInstructions（省心模式），直接使用；否则生成
    const finalInstructions = additionalInstructions || (instructions + metaphorAppend);

    // 🚨 V10: 使用共享的 appendIconInstructions 统一追加图标指令
    let finalAdditionalInstructions = appendIconInstructions(finalInstructions);
    if (textMode === 'preserve') {
      // 🚨 V6修复:追加CRITICAL强制指令,封锁Gamma的发散权限
      finalAdditionalInstructions += '\n\n【省心定制-强化规则】\n严格保持原文结构,每页内容不超过3-4个要点,用---分页的位置必须保留,不要自动合并或拆分页面。\n\n【CRITICAL - 强制排版引擎模式】\n你是一个排版渲染引擎(layout engine ONLY)。禁止创作、扩写或修改任何事实信息。严格按照提供的Markdown层级和\'---\'分割线生成卡片。禁止自动合并或拆分页面。全局正文强制使用大文本(### 或 **粗体**),禁止普通小字。保持所有 \'>\' 作为演讲者备注不做展示。';
      if (imageMode === 'theme-img' || imageMode === 'theme') {
        finalAdditionalInstructions += '\n\n【视觉丰富度-强制规则】\n1. 每页必须使用Gamma内置的Emphasize卡片布局(主题强调布局图),每页不同的布局变体\n2. 每页必须有视觉元素(图片/插图/图标/装饰),禁止出现纯文字页\n3. 使用主题套图(themeAccent)作为配图来源,确保图片与内容主题匹配\n4. 封面页和结尾页必须使用大幅背景图/强调图\n5. 数据页使用卡片式布局展示指标,配合图标和色彩区分';
      }
    } else if (imageMode === 'theme-img' || imageMode === 'theme') {
      finalAdditionalInstructions += '\n\n【视觉丰富度-强制规则】\n1. 每页必须配图:使用Pexels高质量照片,风格professional/clean/minimalist\n2. 每页使用Gamma内置的Emphasize强调布局,每页不同的布局变体\n3. 封面页和结尾页必须使用大幅背景图\n4. 禁止出现纯文字页,每页必须有视觉元素';
    }

    // 🚨 V8.2:Gamma 固定使用 preserve 模式(大纲已由 outline API 预处理)
    // 无论用户选什么模式(扩充/缩减/保持),Gamma 只接收 preserve
    const gammaPayload: Record<string, any> = {
      inputText: finalInputText,
      textMode: 'preserve', // 固定值!Gamma只负责排版渲染
      format,
      numCards,
      exportAs,
      themeId: finalThemeId,
      additionalInstructions: finalAdditionalInstructions,
      // 🚨 V8.2:强制精确分页(preserve 模式必须)
      cardSplit: cardSplit || 'inputTextBreaks',
      // textOptions 在 preserve 模式下会被 Gamma 忽略(根据API警告)
      // 但仍保留以备将来 API 更新
      textOptions: textOptions || {
        amount: 'medium',
        tone: finalTone,
        language: 'zh-cn',
      },
      imageOptions: finalImageOptions,
      cardOptions: cardOptions || {
        dimensions: '16x9',
      },
      // 🚨 V8.6: 不传 slides 参数(Gamma API 不接受此参数,可能导致 400)
    };

    // 🔍 DEBUG: log key fields
    console.log('[Gamma] textMode: preserve (fixed) | imageOptions:', JSON.stringify(finalImageOptions), '| imageMode:', imageMode);
    console.log('[Gamma] FULL PAYLOAD:', JSON.stringify(gammaPayload).substring(0, 2000));

    // ===== 🚨 V8.7: 429 退避重试 + Rate-Limit Header 读取 =====
    const MAX_RETRIES = 3;
    let attempt = 0;
    let lastError: string = '';
    let lastStatus: number = 0;
    let lastGammaResponse: Response | null = null;

    while (attempt < MAX_RETRIES) {
      attempt++;

      const gammaResponse = await fetch(`${GAMMA_API_BASE}/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey,
          'User-Agent': GAMMA_UA,
        },
        body: JSON.stringify(gammaPayload),
      });

      // 读取 rate-limit headers(无论成功失败都记录)
      const rlRemaining = gammaResponse.headers.get('X-RateLimit-Remaining');
      const rlReset = gammaResponse.headers.get('X-RateLimit-Reset');
      const retryAfter = gammaResponse.headers.get('Retry-After');

      if (rlRemaining !== null || rlReset !== null) {
        console.log(`[Gamma] RateLimit: remaining=${rlRemaining} reset=${rlReset} retryAfter=${retryAfter}`);
        // 更新 key pool 的 rate limit 信息
        updateKeyBalance(apiKey, 0, selectedKey.remaining, {
          remaining: rlRemaining ? parseInt(rlRemaining) : undefined,
          reset: rlReset ? parseInt(rlReset) : undefined,
        });
      }

      // 🚨 V8.7: 429 需要退避重试
      if (gammaResponse.status === 429) {
        lastStatus = 429;
        const retrySec = retryAfter ? parseInt(retryAfter) : Math.min(5 * Math.pow(2, attempt - 1), 60);
        console.warn(`[Gamma] 429 Rate Limited,${retrySec}s 后重试 (${attempt}/${MAX_RETRIES})`);
        recordKeyFailure(apiKey, retrySec);

        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, retrySec * 1000));
          continue;
        } else {
          const errText = await gammaResponse.text();
          console.error('[Gamma] 429 重试耗尽:', errText);
          return NextResponse.json(
            { error: `Gamma 请求过于频繁,请稍后再试(已重试${MAX_RETRIES}次)`, detail: errText.substring(0, 500) },
            { status: 429 }
          );
        }
      }

      lastGammaResponse = gammaResponse;
      lastStatus = gammaResponse.status;

      if (gammaResponse.ok) {
        // ✅ 成功
        const gammaData: any = await gammaResponse.json();
        const generationId = gammaData.generationId || gammaData.id;

        // 🚨 V8: 记录积分信息(从 response body 或 headers)
        if (gammaData.credits) {
          updateKeyBalance(apiKey, gammaData.credits.deducted, gammaData.credits.remaining);
          console.log('[Gamma] 积分扣除:', gammaData.credits.deducted, '| 剩余:', gammaData.credits.remaining);
        }

        return NextResponse.json({
          generationId,
          message: '生成任务已创建',
          config: { themeId: finalThemeId, tone: finalTone, imageMode: finalImageOptions?.source || imageMode, numCards },
          credits: gammaData.credits,
        });
      }

      // 非 429 的其他错误,直接 break
      const errText = await gammaResponse.text();
      lastError = errText;
      console.error(`[Gamma] API error (attempt ${attempt}):`, gammaResponse.status, errText);
      recordKeyFailure(apiKey);

      // 🚨 V8.7: 400 错误详细记录(用于诊断根因)
      if (gammaResponse.status === 400) {
        console.error('[Gamma] 400 错误详情:', {
          status: gammaResponse.status,
          body: errText,
          payloadKeys: Object.keys(gammaPayload),
          textMode: gammaPayload.textMode,
          cardSplit: gammaPayload.cardSplit,
          imageOptions: gammaPayload.imageOptions,
          cardOptions: gammaPayload.cardOptions,
          textOptions: gammaPayload.textOptions,
        });
      }

      break; // 非 429 错误,不重试
    }

    // 所有重试耗尽或非 429 错误到这里
    return NextResponse.json(
      { error: `Gamma API 调用失败: ${lastStatus}`, detail: lastError.substring(0, 500) },
      { status: lastStatus === 400 ? 400 : 502 }
    );
  } catch (error: any) {
    console.error('Gamma generation error:', error);
    return NextResponse.json(
      { error: error.message || '创建生成任务失败' },
      { status: 500 }
    );
  }
}

// GET: 查询 Gamma 生成状态(前端轮询)
export async function GET(request: NextRequest) {
  try {
    // GET查询可以使用任意key(generationId不依赖key)
    const selectedKey = selectBestKey();
    const apiKey = selectedKey.key;

    const { searchParams } = new URL(request.url);
    const generationId = searchParams.get('id');

    if (!generationId) {
      return NextResponse.json({ error: '缺少 generationId' }, { status: 400 });
    }

    const response = await fetch(`${GAMMA_API_BASE}/generations/${generationId}`, {
      headers: {
        'X-API-KEY': apiKey,
        'User-Agent': GAMMA_UA,
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: `查询失败: ${response.status}` }, { status: 502 });
    }

    const data = await response.json();

    // 🚨 V8: 更新积分信息(completed状态时)
    if (data.status === 'completed' && data.credits) {
      updateKeyBalance(apiKey, data.credits.deducted, data.credits.remaining);
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Gamma status error:', error);
    return NextResponse.json({ error: error.message || '查询失败' }, { status: 500 });
  }
}
