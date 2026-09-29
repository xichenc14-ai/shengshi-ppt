#!/usr/bin/env node

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { matchTheme } from './theme-matcher.mjs';
import { postGenerationWithCurl } from './gamma-post.mjs';

const API_BASE = 'https://public-api.gamma.app/v1.0';
const DEFAULT_CONFIG_PATH = join(homedir(), '.config', 'xinppt', 'config.json');
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 240000;
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const VISUAL_RULES = readFileSync(resolve(SCRIPT_DIR, '../references/visual-instructions.txt'), 'utf8').trim();
const THEME_CATALOG = JSON.parse(readFileSync(resolve(SCRIPT_DIR, '../assets/theme-catalog.json'), 'utf8'));
const ALLOWED_IMAGE_SOURCES = new Set([
  'aiGenerated', 'giphy', 'noImages', 'pexels', 'pictographic', 'placeholder',
  'themeAccent', 'webAllImages', 'webFreeToUse', 'webFreeToUseCommercially',
]);
const ALLOWED_TONES = new Set(['professional', 'casual', 'creative', 'bold', 'traditional']);
const ALLOWED_AMOUNTS = new Set(['brief', 'medium', 'detailed', 'extensive']);

function usage(exitCode = 0) {
  const message = `XinPPT local Gamma runner

Usage:
  xinppt.mjs preflight
  xinppt.mjs validate --outline FILE --config FILE
  xinppt.mjs prepare --outline FILE --config FILE --output-dir DIR
  xinppt.mjs create --outline FILE --config FILE --output-dir DIR
  xinppt.mjs create --input FILE --config FILE --output-dir DIR  (legacy)
  xinppt.mjs resume --job FILE
  xinppt.mjs verify --job FILE
  xinppt.mjs inspect --job FILE

Secrets are read from GAMMA_API_KEY, XINPPT_CONFIG, or ${DEFAULT_CONFIG_PATH}.`;
  console[exitCode ? 'error' : 'log'](message);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith('--')) throw new Error(`未知参数: ${token}`);
    const value = rest[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`参数 ${token} 缺少值`);
    options[token.slice(2)] = value;
    i += 1;
  }
  return { command, options };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function loadSecretConfig() {
  const configPath = process.env.XINPPT_CONFIG ? resolve(process.env.XINPPT_CONFIG) : DEFAULT_CONFIG_PATH;
  let fileConfig = {};
  try {
    fileConfig = await readJson(configPath);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw new Error(`无法读取私密配置 ${configPath}: ${error.message}`);
  }
  const apiKey = String(process.env.GAMMA_API_KEY || fileConfig.gammaApiKey || '').trim();
  if (!apiKey) {
    throw new Error(`未配置 Gamma API key。请设置 GAMMA_API_KEY，或在 ${configPath} 写入 {"gammaApiKey":"..."} 并将文件权限设为 600。`);
  }
  return { apiKey, source: process.env.GAMMA_API_KEY ? 'environment' : 'config-file' };
}

async function apiRequest(apiKey, method, path, body, timeoutMs = 60000) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (cause) {
    const error = new Error(`Gamma API ${method} ${path} 未收到 HTTP 响应: ${cause.message}`);
    error.code = cause.cause?.code || cause.code || cause.name || 'FETCH_FAILED';
    throw error;
  }
  let raw;
  try { raw = await response.text(); }
  catch (cause) {
    const error = new Error(`Gamma API ${method} ${path} 响应正文中断: HTTP ${response.status} ${cause.message}`);
    error.status = response.status;
    error.code = cause.cause?.code || cause.code || cause.name || 'BODY_READ_FAILED';
    error.requestId = response.headers?.get?.('x-request-id') || '';
    throw error;
  }
  let data;
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw.slice(0, 500) }; }
  if (!response.ok) {
    const message = data?.error?.message || data?.message || data?.error || `HTTP ${response.status}`;
    const error = new Error(`Gamma API ${method} ${path} 失败: ${response.status} ${String(message)}`);
    error.status = response.status;
    error.requestId = response.headers?.get?.('x-request-id') || '';
    error.retryAfter = response.headers?.get?.('retry-after') || '';
    throw error;
  }
  return data;
}

function createFailureAdvice(status, code = '') {
  if (['ENOENT', 'EACCES'].includes(code)) return '本机无法启动 curl；请求未发往 Gamma，检查 curl 安装或执行权限。';
  if (!status) return '未收到 Gamma 的 HTTP 状态或生成 ID；保留任务记录，不自动重新提交。';
  if (status === 400) return 'Gamma 已拒绝请求参数；依据返回的字段错误修改 payload.json 后再提交。';
  if (status === 401) return 'Gamma API key 无效或已失效；检查本机私密配置。';
  if (status === 402) return 'Gamma 工作区额度不足；检查 Gamma 账户额度。';
  if (status === 403) return 'Gamma 拒绝访问；检查账户权限、套餐和所选功能。';
  if (status === 408) return 'Gamma 请求超时；创建结果不确定，不自动重新提交。';
  if (status === 429) return 'Gamma 限流；查看 Retry-After，稍后再提交。';
  if (status >= 500) return 'Gamma 服务端或网关错误；保留请求 ID，避免立即重复创建。';
  return 'Gamma 已返回错误；依据其状态码和原始错误消息处理。';
}

async function listAvailableThemes(apiKey) {
  const themes = [];
  let after = '';
  for (let page = 0; page < 20; page += 1) {
    const params = new URLSearchParams({ limit: '50' });
    if (after) params.set('after', after);
    let response;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        response = await apiRequest(apiKey, 'GET', `/themes?${params}`);
        break;
      } catch (error) {
        if (attempt === 1 || /失败: (?:400|401|403)/.test(error.message)) throw error;
        await new Promise((done) => setTimeout(done, 500));
      }
    }
    if (!Array.isArray(response.data) || typeof response.hasMore !== 'boolean') {
      throw new Error('Gamma 主题列表格式异常，无法确认主题是否可用');
    }
    themes.push(...response.data);
    if (!response.hasMore) return themes;
    after = String(response.nextCursor || '');
    if (!after) throw new Error('Gamma 主题列表缺少下一页游标');
  }
  throw new Error('Gamma 主题列表分页超出上限，无法确认主题是否可用');
}

async function confirmThemeAvailable(apiKey, themeId) {
  const themes = await listAvailableThemes(apiKey);
  if (!themes.some((theme) => theme.id === themeId)) {
    throw new Error(`主题 ${themeId} 当前不在此 Gamma 账户的可用主题列表中，已停止提交`);
  }
  return { checkedAt: new Date().toISOString(), available: true, workspaceThemeCount: themes.length };
}

function splitSlides(markdown) {
  const slides = [];
  let lines = [];
  let fence;
  for (const line of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (marker) {
      if (!fence) fence = { char: marker[1][0], length: marker[1].length };
      else if (marker[1][0] === fence.char && marker[1].length >= fence.length && !marker[2].trim()) fence = undefined;
      lines.push(line);
    } else if (!fence && /^\s*---\s*$/.test(line)) {
      const slide = lines.join('\n').trim();
      if (slide) slides.push(slide);
      lines = [];
    } else lines.push(line);
  }
  const finalSlide = lines.join('\n').trim();
  if (finalSlide) slides.push(finalSlide);
  return slides;
}

const VISUAL_TYPES = new Set([
  'iconGrid', 'timeline', 'process', 'cycle', 'comparison', 'matrix', 'funnel', 'pyramid',
  'dashboard', 'chart', 'diagram', 'quote', 'imageHero', 'text',
]);

function normalizeOutline(input) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.slides)) {
    throw new Error('outline.json 必须是包含 slides 数组的 JSON 对象');
  }
  const slides = input.slides.map((raw, index) => {
    if (!raw || typeof raw !== 'object') throw new Error(`第 ${index + 1} 页格式无效`);
    const title = String(raw.title || '').trim();
    if (!title) throw new Error(`第 ${index + 1} 页缺少 title`);
    const content = (Array.isArray(raw.content) ? raw.content : Array.isArray(raw.bullets) ? raw.bullets : [])
      .map((item) => String(item || '').trim()).filter(Boolean);
    const visualType = String(raw.visualType || (content.length ? 'iconGrid' : 'text')).trim();
    if (!VISUAL_TYPES.has(visualType)) throw new Error(`第 ${index + 1} 页 visualType 不支持: ${visualType}`);
    const suppliedHints = Array.isArray(raw.iconHints)
      ? raw.iconHints.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 5)
      : [];
    const iconHints = suppliedHints.length ? suppliedHints : content.map((point) => point.slice(0, 12)).slice(0, 4);
    return {
      title,
      content,
      kind: String(raw.kind || '').trim(),
      visualType,
      layoutIntent: String(raw.layoutIntent || `使用 Gamma 原生 ${visualType} 视觉结构呈现本页，不要退化为纯文字堆叠`).trim(),
      iconHints,
      chartSpec: raw.chartSpec && typeof raw.chartSpec === 'object' && !Array.isArray(raw.chartSpec) ? raw.chartSpec : null,
      diagramSpec: raw.diagramSpec && typeof raw.diagramSpec === 'object' && !Array.isArray(raw.diagramSpec) ? raw.diagramSpec : null,
      subtitle: String(raw.subtitle || '').trim(),
    };
  });
  const title = String(input.title || slides[0]?.title || '').trim();
  if (!title) throw new Error('outline.json 缺少演示文稿标题');
  return { ...input, title, subtitle: String(input.subtitle || '').trim(), slides };
}

function outlineToMarkdown(input) {
  const outline = normalizeOutline(input);
  const sections = outline.slides.map((slide, index) => {
    const lines = [];
    if (index === 0 && (slide.kind === 'cover' || slide.title === outline.title)) {
      lines.push(`# ${outline.title}`);
      const subtitle = slide.subtitle || outline.subtitle;
      if (subtitle) lines.push('', subtitle);
      if (slide.content.length) lines.push('', ...slide.content.map((point) => `### ${point}`));
    } else {
      lines.push(`## ${slide.title}`);
      if (slide.subtitle) lines.push('', slide.subtitle);
      if (slide.content.length) {
        const isSequence = ['process', 'timeline', 'cycle', 'funnel'].includes(slide.visualType);
        lines.push('', ...slide.content.map((point, pointIndex) => isSequence
          ? `${pointIndex + 1}. **${point}**`
          : `### ${point}`));
      }
    }
    const visualParts = [
      `可视化类型=${slide.visualType}`,
      `布局意图=${slide.layoutIntent}`,
      ...(slide.iconHints.length ? [`图标语义=${slide.iconHints.join('、')}`] : []),
      ...(slide.chartSpec?.type ? [`图表建议=${slide.chartSpec.type}${slide.chartSpec.title ? `｜${slide.chartSpec.title}` : ''}${slide.chartSpec.source ? `｜来源:${slide.chartSpec.source}` : ''}`] : []),
      ...(slide.diagramSpec?.type ? [`逻辑图建议=${slide.diagramSpec.type}${Array.isArray(slide.diagramSpec.nodes) && slide.diagramSpec.nodes.length ? `｜${slide.diagramSpec.nodes.slice(0, 6).join('→')}` : ''}`] : []),
    ];
    lines.push('', `> *(Gamma可视化约束：${visualParts.join('；')}。优先映射为 Gamma 原生布局、图表、时间线、流程、矩阵或图标卡片；不要退化成纯文字堆叠。)*`);
    return lines.join('\n');
  });
  return sections.join('\n\n---\n\n');
}

function outlineFromMarkdown(markdown) {
  const sections = splitSlides(markdown);
  const slides = sections.map((section, index) => {
    const lines = section.split(/\r?\n/);
    const headingAt = lines.findIndex((line) => /^\s{0,3}#{1,6}\s+/.test(line));
    const title = headingAt >= 0 ? lines[headingAt].replace(/^\s{0,3}#{1,6}\s+/, '').trim() : `第 ${index + 1} 页`;
    const content = lines.map((line) => line.match(/^\s{0,3}(?:[-*+]\s+|\d+[.)]\s+)(.+)$/)?.[1]?.trim()).filter(Boolean);
    return {
      title,
      content,
      kind: index === 0 && /^\s{0,3}#\s+/.test(lines[headingAt] || '') ? 'cover' : '',
      visualType: content.length ? 'iconGrid' : 'text',
      layoutIntent: content.length ? '按原文要点顺序呈现' : '保持原有页面结构',
      iconHints: content.slice(0, 4).map((point) => point.slice(0, 12)),
    };
  });
  return normalizeOutline({ title: slides[0]?.title || 'XinPPT', slides });
}

function validatePresentationConfig(input) {
  const config = {
    title: typeof input.title === 'string' ? input.title.trim() : '',
    themeId: String(input.themeId || 'auto').trim(),
    themePrompt: typeof input.themePrompt === 'string' ? input.themePrompt.trim() : '',
    themeScene: typeof input.themeScene === 'string' ? input.themeScene.trim() : '',
    tone: String(input.tone || 'professional').trim(),
    audience: String(input.audience || 'general').trim(),
    language: String(input.language || 'zh-cn').trim(),
    textAmount: String(input.textAmount || 'medium').trim(),
    imageSource: String(input.imageSource || 'themeAccent').trim(),
    imageModel: typeof input.imageModel === 'string' ? input.imageModel.trim() : '',
    imageStyle: typeof input.imageStyle === 'string' ? input.imageStyle.trim() : '',
    dimensions: String(input.dimensions || '16x9').trim(),
    externalAccess: String(input.externalAccess || 'view').trim(),
    additionalInstructions: typeof input.additionalInstructions === 'string' ? input.additionalInstructions.trim() : '',
  };
  if (!config.themeId) throw new Error('themeId 不能为空');
  if (!ALLOWED_TONES.has(config.tone)) throw new Error(`不支持的 tone: ${config.tone}`);
  if (!ALLOWED_AMOUNTS.has(config.textAmount)) throw new Error(`不支持的 textAmount: ${config.textAmount}`);
  if (!ALLOWED_IMAGE_SOURCES.has(config.imageSource)) throw new Error(`不支持的 imageSource: ${config.imageSource}`);
  if (!['16x9', '4x3', 'fluid'].includes(config.dimensions)) throw new Error(`不支持的 dimensions: ${config.dimensions}`);
  if (!['noAccess', 'view', 'comment', 'edit'].includes(config.externalAccess)) throw new Error(`不支持的 externalAccess: ${config.externalAccess}`);
  return config;
}

function resolveTheme(config, outline) {
  const decision = matchTheme({
    text: config.themePrompt,
    contextText: outline.title,
    scene: config.themeScene || String(outline.scene || ''),
    tone: config.tone,
    audience: config.audience,
    density: ['detailed', 'extensive'].includes(config.textAmount) ? 'dense' : '',
    explicitThemeId: config.themeId === 'auto' ? '' : config.themeId,
    catalog: THEME_CATALOG,
  });
  if (decision.status !== 'selected') throw new Error(`主题匹配冲突: ${decision.conflict}`);
  return { config: { ...config, themeId: decision.themeId }, decision };
}

function buildPayload(markdown, config) {
  const slides = splitSlides(markdown);
  if (!slides.length) throw new Error('input.md 没有有效幻灯片内容');
  if (slides.length > 75) throw new Error('Gamma 单次生成不能超过 75 页');
  const imageOptions = { source: config.imageSource };
  if (config.imageSource === 'aiGenerated' && config.imageModel) imageOptions.model = config.imageModel;
  if (config.imageSource === 'aiGenerated' && config.imageStyle) imageOptions.style = config.imageStyle;
  const additionalInstructions = [VISUAL_RULES, config.additionalInstructions].filter(Boolean).join('\n\n');
  if (additionalInstructions.length > 5000) throw new Error('视觉规则与自定义说明超过 Gamma 的 5000 字符上限');
  return {
    payload: {
      inputText: slides.join('\n\n---\n\n'),
      ...(config.title ? { title: config.title } : {}),
      textMode: 'preserve', format: 'presentation', numCards: slides.length, cardSplit: 'inputTextBreaks',
      exportAs: 'pptx',
      additionalInstructions,
      themeId: config.themeId,
      cardOptions: { dimensions: config.dimensions },
      textOptions: { amount: config.textAmount, tone: config.tone, audience: config.audience, language: config.language },
      imageOptions,
      sharingOptions: { externalAccess: config.externalAccess },
    },
    slideCount: slides.length,
  };
}

async function atomicWriteJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
}

async function saveJob(path, job) {
  const safe = { ...job, updatedAt: new Date().toISOString() };
  delete safe.apiKey;
  await atomicWriteJson(path, safe);
}

function normalizeStatus(value) {
  const status = String(value || '').toLowerCase();
  if (['completed', 'complete', 'ready'].includes(status)) return 'completed';
  if (['failed', 'error'].includes(status)) return 'failed';
  if (['processing', 'in_progress'].includes(status)) return 'processing';
  return 'pending';
}

function recordGenerationFailure(job, data, fallback) {
  job.status = 'generation-failed';
  job.error = String(data?.error?.message || data?.message || data?.error || fallback);
  job.errorCode = String(data?.error?.code || data?.code || 'GAMMA_GENERATION_FAILED');
  job.errorAt = new Date().toISOString();
}

async function trackedStatusRequest(apiKey, jobPath, job, path) {
  try { return await apiRequest(apiKey, 'GET', path); }
  catch (error) {
    job.lastApiError = {
      stage: 'status-query', httpStatus: error.status || null, code: error.code || '',
      message: error.message, requestId: error.requestId || '',
      retryAfter: error.retryAfter || '', at: new Date().toISOString(),
    };
    await saveJob(jobPath, job);
    throw error;
  }
}

async function pollGeneration(apiKey, jobPath, job) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    const data = await trackedStatusRequest(apiKey, jobPath, job, `/generations/${encodeURIComponent(job.generationId)}`);
    job.generationStatus = normalizeStatus(data.status);
    if (typeof data.gammaId === 'string' && data.gammaId.trim()) job.gammaId = data.gammaId.trim();
    if (typeof data.gammaUrl === 'string') job.gammaUrl = data.gammaUrl;
    if (typeof data.exportUrl === 'string') job.generationExportUrl = data.exportUrl;
    if (job.generationStatus === 'failed') recordGenerationFailure(job, data, 'Gamma 生成失败');
    await saveJob(jobPath, job);
    console.log(`[XinPPT] generation=${job.generationStatus}`);
    if (job.generationStatus === 'completed') return job;
    if (job.generationStatus === 'failed') throw new Error(job.error);
    await new Promise((done) => setTimeout(done, POLL_INTERVAL_MS));
  }
  throw new Error(`生成仍在进行，稍后运行 resume --job ${jobPath}`);
}

async function pollExport(apiKey, jobPath, job) {
  if (!job.exportId) throw new Error('旧任务缺少已知 exportId；不会重新创建独立导出');
  const startedAt = Date.now();
  while (!job.exportUrl && Date.now() - startedAt < POLL_TIMEOUT_MS) {
    const data = await trackedStatusRequest(apiKey, jobPath, job, `/exports/${encodeURIComponent(job.exportId)}`);
    job.exportStatus = normalizeStatus(data.status);
    if (typeof data.exportUrl === 'string') job.exportUrl = data.exportUrl;
    if (job.exportStatus === 'failed') recordGenerationFailure(job, data, 'Gamma PPTX 导出失败');
    await saveJob(jobPath, job);
    console.log(`[XinPPT] export=${job.exportStatus}`);
    if (job.exportStatus === 'failed') throw new Error(job.error);
    if (!job.exportUrl) await new Promise((done) => setTimeout(done, POLL_INTERVAL_MS));
  }
  if (!job.exportUrl) throw new Error(`导出仍在进行，稍后运行 resume --job ${jobPath}`);
  return job;
}

async function pollGenerationExportUrl(apiKey, jobPath, job) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    const data = await trackedStatusRequest(apiKey, jobPath, job, `/generations/${encodeURIComponent(job.generationId)}`);
    job.generationStatus = normalizeStatus(data.status);
    if (typeof data.gammaId === 'string' && data.gammaId.trim()) job.gammaId = data.gammaId.trim();
    if (typeof data.gammaUrl === 'string') job.gammaUrl = data.gammaUrl;
    if (typeof data.exportUrl === 'string' && data.exportUrl.trim()) {
      job.generationExportUrl = data.exportUrl.trim();
      job.exportUrl = data.exportUrl.trim();
      job.exportStatus = 'completed';
    }
    if (job.generationStatus === 'failed') recordGenerationFailure(job, data, 'Gamma 生成/导出失败');
    await saveJob(jobPath, job);
    if (job.generationStatus === 'failed') throw new Error(job.error);
    if (job.exportUrl) return job;
    await new Promise((done) => setTimeout(done, POLL_INTERVAL_MS));
  }
  job.exportStatus = 'missing-url';
  await saveJob(jobPath, job);
  throw new Error(`生成任务尚未提供 PPTX exportUrl；可稍后安全运行 resume --job ${jobPath}`);
}

function validPptx(buffer) {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b
    && [0x03, 0x05, 0x07].includes(buffer[2])
    && buffer.includes(Buffer.from('[Content_Types].xml'))
    && buffer.includes(Buffer.from('ppt/presentation.xml'));
}

function auditPptx(artifactPath, expectedSlides) {
  const processResult = spawnSync('python3', [resolve(SCRIPT_DIR, 'audit_pptx.py'), artifactPath, String(expectedSlides)], {
    encoding: 'utf8', timeout: 30000,
  });
  if (processResult.error) throw new Error(`无法检查 PPTX: ${processResult.error.message}`);
  let audit;
  try { audit = JSON.parse(processResult.stdout); }
  catch { throw new Error(`PPTX 检查未返回有效结果: ${processResult.stderr || processResult.stdout}`); }
  if (processResult.status !== 0 || !audit.valid) {
    throw new Error(`PPTX 图片/页数检查失败: ${(audit.errors || []).join('；') || processResult.stderr}`);
  }
  return audit;
}

async function verifyArtifact(jobPath, job) {
  const artifactPath = job.artifactPath;
  const audit = auditPptx(artifactPath, job.slideCount);
  audit.generationStrategy = 'website-native-shapes';
  if (job.visualCompatibility) audit.visualCompatibility = job.visualCompatibility;
  await atomicWriteJson(join(dirname(jobPath), 'audit.json'), audit);
  job.artifactBytes = (await readFile(artifactPath)).length;
  job.status = 'completed';
  await saveJob(jobPath, job);
  return job;
}

async function downloadArtifact(jobPath, job) {
  if (job.artifactPath) {
    try {
      const existing = await readFile(job.artifactPath);
      if (validPptx(existing)) {
        return verifyArtifact(jobPath, job);
      }
    } catch { /* Retry only the download, never the generation. */ }
  }
  const response = await fetch(job.exportUrl, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`PPTX 下载失败: HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!validPptx(buffer)) throw new Error('下载结果不是有效的 PPTX 文件');
  const artifactPath = join(dirname(jobPath), `${job.safeTitle || 'xinppt'}.pptx`);
  const diagnosticDir = join(dirname(jobPath), 'diagnostics');
  await mkdir(diagnosticDir, { recursive: true });
  const originalPath = join(diagnosticDir, 'gamma-original.pptx');
  await writeFile(originalPath, buffer);
  const compatibility = spawnSync('python3', [resolve(SCRIPT_DIR, 'prefer_raster_fallback.py'), originalPath, artifactPath], {
    encoding: 'utf8', timeout: 30000,
  });
  if (compatibility.status !== 0 || compatibility.error) {
    throw new Error(`PPTX 离线图标兼容处理失败: ${compatibility.error?.message || compatibility.stderr || compatibility.stdout}`);
  }
  try { job.visualCompatibility = JSON.parse(compatibility.stdout); }
  catch { throw new Error(`PPTX 离线图标兼容处理未返回有效结果: ${compatibility.stdout}`); }
  job.artifactPath = artifactPath;
  await verifyArtifact(jobPath, job);
  console.log(`[XinPPT] 完成: ${artifactPath} (${job.artifactBytes} bytes)`);
  return job;
}

async function continueJob(apiKey, jobPath, job) {
  if (!job.generationId) throw new Error('job.json 缺少 generationId，不能安全恢复');
  if (job.status === 'completed' && job.artifactPath) return downloadArtifact(jobPath, job);
  if (job.generationStatus !== 'completed') await pollGeneration(apiKey, jobPath, job);
  if (job.exportMode === 'generation') {
    if (!job.exportUrl && job.generationExportUrl) {
      job.exportUrl = job.generationExportUrl;
      job.exportStatus = 'completed';
      await saveJob(jobPath, job);
    }
    if (!job.exportUrl) await pollGenerationExportUrl(apiKey, jobPath, job);
  } else {
    if (job.exportStatus === 'create-uncertain' && !job.exportId) {
      throw new Error('独立导出请求结果不确定；需要先核查 Gamma，再手动恢复');
    }
    if (!job.exportUrl) await pollExport(apiKey, jobPath, job);
  }
  return downloadArtifact(jobPath, job);
}

async function preflight() {
  const secret = await loadSecretConfig();
  const themes = await listAvailableThemes(secret.apiKey);
  const availableIds = new Set(themes.map((theme) => theme.id));
  const missingRecommended = THEME_CATALOG.recommendedIds.filter((id) => !availableIds.has(id));
  console.log(`[XinPPT] Gamma 连接正常；密钥来源=${secret.source}；可用主题=${themes.length}；不可用精选主题=${missingRecommended.join('、') || '无'}`);
}

async function validate(options) {
  if ((!options.input && !options.outline) || !options.config) usage(2);
  const outline = options.outline
    ? normalizeOutline(await readJson(resolve(options.outline)))
    : outlineFromMarkdown(await readFile(resolve(options.input), 'utf8'));
  const markdown = options.outline ? outlineToMarkdown(outline) : await readFile(resolve(options.input), 'utf8');
  const { config, decision } = resolveTheme(validatePresentationConfig(await readJson(resolve(options.config))), outline);
  const { payload, slideCount } = buildPayload(markdown, config);
  console.log(JSON.stringify({
    valid: true,
    slideCount,
    title: payload.title || outline.title || '',
    themeId: payload.themeId,
    themeDecision: { source: decision.source, confidence: decision.confidence, reason: decision.reason, version: decision.version },
    tone: payload.textOptions.tone,
    imageSource: payload.imageOptions.source,
    dimensions: payload.cardOptions.dimensions,
    visualPages: outline.slides.filter((slide) => slide.content.length > 0 && slide.visualType !== 'text').length,
  }, null, 2));
}

async function prepare(options) {
  if ((!options.input && !options.outline) || !options.config || !options['output-dir']) usage(2);
  const sourcePath = resolve(options.outline || options.input);
  const configPath = resolve(options.config);
  const outputDir = resolve(options['output-dir']);
  const jobPath = join(outputDir, 'job.json');
  try {
    const existing = await readJson(jobPath);
    if (existing.generationId || ['create-uncertain', 'submitting'].includes(existing.status)) {
      throw new Error(`该输出目录已有 Gamma 任务 (${existing.status})；不得覆盖或重复提交。`);
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const sourceText = await readFile(sourcePath, 'utf8');
  const outline = options.outline ? normalizeOutline(JSON.parse(sourceText)) : outlineFromMarkdown(sourceText);
  const markdown = options.outline ? outlineToMarkdown(outline) : sourceText;
  const { config, decision } = resolveTheme(validatePresentationConfig(await readJson(configPath)), outline);
  if (!config.title) config.title = outline.title;
  const { payload, slideCount } = buildPayload(markdown, config);
  const safeTitle = (config.title || basename(sourcePath, options.outline ? '.json' : '.md') || 'xinppt')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 100);
  await mkdir(outputDir, { recursive: true });
  const inputPath = join(outputDir, 'input.md');
  const outlinePath = join(outputDir, 'outline.json');
  await writeFile(inputPath, `${markdown.trim()}\n`);
  await atomicWriteJson(outlinePath, outline);
  await atomicWriteJson(join(outputDir, 'config.json'), config);
  await atomicWriteJson(join(outputDir, 'theme-decision.json'), decision);
  await atomicWriteJson(join(outputDir, 'payload.json'), payload);
  const job = {
    version: 3, status: 'prepared', exportMode: 'generation', createdAt: new Date().toISOString(), inputPath, outlinePath,
    sourcePath, configPath, slideCount, safeTitle, effectiveConfig: config, themeDecision: decision,
  };
  await saveJob(jobPath, job);
  console.log(`[XinPPT] 已准备 ${slideCount} 页: ${inputPath}`);
  return { job, jobPath };
}

async function create(options) {
  if ((!options.input && !options.outline) || !options.config || !options['output-dir']) usage(2);
  const sourcePath = resolve(options.outline || options.input);
  const configPath = resolve(options.config);
  const outputDir = resolve(options['output-dir']);
  const jobPath = join(outputDir, 'job.json');
  try {
    const existing = await readJson(jobPath);
    if (existing.generationId || ['create-uncertain', 'submitting'].includes(existing.status)) {
      throw new Error(`该输出目录已有任务记录 (${existing.status})。请使用 resume 或选择新的输出目录，避免重复创建。`);
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const sourceText = await readFile(sourcePath, 'utf8');
  const outline = options.outline ? normalizeOutline(JSON.parse(sourceText)) : outlineFromMarkdown(sourceText);
  const markdown = options.outline ? outlineToMarkdown(outline) : sourceText;
  const { config, decision } = resolveTheme(validatePresentationConfig(await readJson(configPath)), outline);
  if (!config.title) config.title = outline.title;
  const { payload, slideCount } = buildPayload(markdown, config);
  const safeTitle = (config.title || basename(sourcePath, options.outline ? '.json' : '.md') || 'xinppt')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 100);
  await mkdir(outputDir, { recursive: true });
  const inputPath = join(outputDir, 'input.md');
  const outlinePath = join(outputDir, 'outline.json');
  await writeFile(inputPath, `${markdown.trim()}\n`);
  await atomicWriteJson(outlinePath, outline);
  await atomicWriteJson(join(outputDir, 'config.json'), config);
  await atomicWriteJson(join(outputDir, 'theme-decision.json'), decision);
  await atomicWriteJson(join(outputDir, 'payload.json'), payload);
  const job = {
    version: 3, status: 'submitting', exportMode: 'generation', createdAt: new Date().toISOString(), inputPath, outlinePath,
    sourcePath, configPath, slideCount, safeTitle, effectiveConfig: config, themeDecision: decision,
    createTransport: 'curl',
  };
  const secret = await loadSecretConfig();
  decision.availability = await confirmThemeAvailable(secret.apiKey, config.themeId);
  await atomicWriteJson(join(outputDir, 'theme-decision.json'), decision);
  await saveJob(jobPath, job);
  let created;
  let createResponse;
  try {
    createResponse = await postGenerationWithCurl(API_BASE, secret.apiKey, payload);
    created = createResponse.data;
  } catch (error) {
    const httpStatus = Number.isInteger(error.status) && error.status >= 100 ? error.status : null;
    job.status = ['ENOENT', 'EACCES'].includes(error.code) ? 'create-local-error'
      : httpStatus && httpStatus >= 400 && httpStatus < 500 && httpStatus !== 408
        ? 'create-rejected' : 'create-uncertain';
    job.error = error.message;
    job.errorCode = error.code || (httpStatus ? `HTTP_${httpStatus}` : 'NO_HTTP_RESPONSE');
    job.errorAt = new Date().toISOString();
    job.errorAdvice = createFailureAdvice(httpStatus, error.code);
    job.createResponse = {
      httpStatus, requestId: error.requestId || '', retryAfter: error.retryAfter || '',
      gammaCode: error.gammaCode || '', receivedAt: httpStatus ? job.errorAt : null,
    };
    await saveJob(jobPath, job);
    throw new Error(`${error.message}。${job.errorAdvice}${error.requestId ? ` Gamma request ID: ${error.requestId}` : ''}`);
  }
  job.createResponse = {
    httpStatus: createResponse.httpStatus, requestId: createResponse.requestId || '',
    receivedAt: new Date().toISOString(),
  };
  if (created?.warnings) job.createWarnings = created.warnings;
  job.generationId = String(created?.generationId || created?.id || '').trim();
  if (!job.generationId) {
    job.status = 'create-uncertain';
    job.errorCode = 'MISSING_GENERATION_ID';
    job.error = 'Gamma 创建请求返回成功状态，但响应缺少 generationId';
    job.errorAdvice = '已保存 HTTP 状态和 Gamma request ID；没有生成 ID 时不能调用状态接口或重新提交。';
    await saveJob(jobPath, job);
    throw new Error(`${job.error}。${job.errorAdvice}`);
  }
  job.status = 'submitted';
  job.generationStatus = normalizeStatus(created.status);
  if (typeof created.gammaId === 'string') job.gammaId = created.gammaId;
  if (typeof created.exportUrl === 'string') job.generationExportUrl = created.exportUrl;
  await saveJob(jobPath, job);
  console.log(`[XinPPT] submitted generationId=${job.generationId} slides=${slideCount}`);
  return continueJob(secret.apiKey, jobPath, job);
}

async function resume(options) {
  if (!options.job) usage(2);
  const jobPath = resolve(options.job);
  const job = await readJson(jobPath);
  const secret = await loadSecretConfig();
  return continueJob(secret.apiKey, jobPath, job);
}

async function inspect(options) {
  if (!options.job) usage(2);
  const job = await readJson(resolve(options.job));
  delete job.apiKey;
  console.log(JSON.stringify(job, null, 2));
}

async function verify(options) {
  if (!options.job) usage(2);
  const jobPath = resolve(options.job);
  const job = await readJson(jobPath);
  if (!job.artifactPath) throw new Error('任务没有可检查的 PPTX 文件');
  const artifact = await readFile(job.artifactPath);
  if (!validPptx(artifact)) throw new Error('PPTX 文件无效');
  await verifyArtifact(jobPath, job);
  console.log(`[XinPPT] 检查完成: ${job.artifactPath}`);
}

try {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (!command || command === 'help' || command === '--help') usage(0);
  if (command === 'preflight') await preflight();
  else if (command === 'validate') await validate(options);
  else if (command === 'prepare') await prepare(options);
  else if (command === 'create') await create(options);
  else if (command === 'resume') await resume(options);
  else if (command === 'verify') await verify(options);
  else if (command === 'inspect') await inspect(options);
  else usage(2);
} catch (error) {
  console.error(`[XinPPT] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
