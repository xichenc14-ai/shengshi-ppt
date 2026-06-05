import { THEME_DATABASE, type ThemeColorFamily, type ThemeData } from '@/lib/theme-database';

type Tone = 'professional' | 'casual' | 'creative' | 'bold' | 'traditional' | string;

type ThemeIntent = {
  colorFamilies: ThemeColorFamily[];
  styleTags: string[];
  sceneHints: string[];
  preferredThemeIds: string[];
  explicitColorLabel?: string;
  hasExplicitColor: boolean;
  hasExplicitStyle: boolean;
};

export type SmartThemeMatch = {
  themeId: string;
  themeLabel: string;
  reason: string;
  locked: boolean;
};

const COLOR_RULES: Array<{ family: ThemeColorFamily; label: string; re: RegExp }> = [
  { family: 'blue', label: '蓝色系', re: /商务蓝|蓝色主题|蓝色系|科技蓝|企业蓝|深蓝|海军蓝|宝石蓝|藏蓝|天蓝|淡蓝/ },
  { family: 'orangeBrown', label: '橙棕色系', re: /橙色|橙棕|棕色|咖啡色|复古棕|暖棕|大地色|红色主题|红色系|中国红|国旗红|喜庆红|大红|正红|朱红|酒红|红金|节庆红/ },
  { family: 'yellowCream', label: '米黄色系', re: /米黄|米色|米绿|优雅米绿|奶油|杏色|金色|暖黄|黄色系|田园/ },
  { family: 'green', label: '绿色系', re: /绿色|绿色系|自然绿|清新绿|薄荷绿|生态|环保/ },
  { family: 'whiteGray', label: '白灰色系', re: /白色|白色系|灰色|灰白|极简白|简约白|冷银|银灰/ },
  { family: 'black', label: '黑色系', re: /黑色|黑金|深色|暗色|夜间|暗夜|高对比/ },
  { family: 'purplePink', label: '紫粉色系', re: /紫色|紫粉|玫红|玫瑰红|粉色|少女粉|豆沙粉|樱花粉|珊瑚红|珊瑚粉|橘粉|橘红|科技紫/ },
];

const STYLE_RULES: Array<{ tag: string; re: RegExp }> = [
  { tag: '商务', re: /商务|汇报|报告|项目|企业|专业|正式|严谨/ },
  { tag: '科技', re: /科技|AI|人工智能|数字化|互联网|未来|算法|软件|创新/ },
  { tag: '教育', re: /教育|学校|中学|大学|课程|培训|课件|教学/ },
  { tag: '自然', re: /自然|生态|环保|田园|乡村|文旅|旅行|旅游|城市/ },
  { tag: '创意', re: /创意|新潮|视觉|品牌|营销|发布|海报/ },
  { tag: '温暖', re: /温暖|亲和|生活|咖啡|餐饮|美食|社区/ },
  { tag: '奢华', re: /高端|奢华|质感|精品|豪华/ },
  { tag: '简约', re: /简约|极简|干净|清爽|留白/ },
  { tag: '传统', re: /传统|国风|古风|中式|文化|非遗|党政/ },
  { tag: '活泼', re: /活泼|年轻|轻松|趣味|校园/ },
];

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export function detectThemeIntent(text: string, scene?: string, tone?: Tone): ThemeIntent {
  const source = `${text || ''} ${scene || ''} ${tone || ''}`;
  const colorMatches = COLOR_RULES.filter((rule) => rule.re.test(source));
  const styleTags = STYLE_RULES.filter((rule) => rule.re.test(source)).map((rule) => rule.tag);
  const toneTags: string[] = [];
  const preferredThemeIds: string[] = [];
  let explicitColorLabel = colorMatches[0]?.label;

  if (/白色简约|白色极简|纯白简约|简约白|极简白|白色风格/.test(source)) preferredThemeIds.push('howlite');
  if (/红色主题|红色系|中国红|国旗红|喜庆红|大红|正红|朱红|酒红|红金|节庆红/.test(source)) {
    preferredThemeIds.push('atmosphere');
    explicitColorLabel = '红色系';
  }
  if (/珊瑚红|珊瑚粉|橘粉|橘红|暖橘红/.test(source)) {
    preferredThemeIds.push('coral-glow');
    explicitColorLabel = '珊瑚红';
  }
  if (/玫红|玫瑰红|粉色|少女粉|豆沙粉|樱花粉/.test(source)) {
    preferredThemeIds.push('ashrose');
    explicitColorLabel = '玫瑰粉';
  }
  if (/深蓝|海军蓝|藏蓝/.test(source)) preferredThemeIds.push('blues');
  if (/天蓝|校园|学校|中学|教育|培训/.test(source) && /蓝/.test(source)) preferredThemeIds.push('cornflower');
  if (/咖啡|田园|文旅|乡村|自然|优雅米绿|米绿/.test(source)) preferredThemeIds.push('finesse');

  if (tone === 'professional') toneTags.push('商务', '专业');
  if (tone === 'casual') toneTags.push('温暖', '生活', '活泼');
  if (tone === 'creative') toneTags.push('创意', '年轻');
  if (tone === 'bold') toneTags.push('科技', '未来');
  if (tone === 'traditional') toneTags.push('传统', '文化');

  return {
    colorFamilies: unique(colorMatches.map((rule) => rule.family)),
    styleTags: unique([...styleTags, ...toneTags]),
    sceneHints: scene ? [scene] : [],
    preferredThemeIds: unique(preferredThemeIds),
    explicitColorLabel,
    hasExplicitColor: colorMatches.length > 0,
    hasExplicitStyle: styleTags.length > 0,
  };
}

function scoreTheme(theme: ThemeData, intent: ThemeIntent): number {
  let score = 0;

  if (intent.colorFamilies.length > 0) {
    score += intent.colorFamilies.includes(theme.colorFamily) ? 80 : -60;
  }

  if (intent.preferredThemeIds.includes(theme.id)) score += 120;

  for (const scene of intent.sceneHints) {
    if (theme.scenes.includes(scene)) score += 28;
    if (theme.scenes.some((item) => scene.includes(item) || item.includes(scene))) score += 12;
  }

  for (const tag of intent.styleTags) {
    if (theme.tags?.includes(tag)) score += 18;
    if (theme.style.includes(tag)) score += 12;
    if (theme.nameZh.includes(tag)) score += 10;
  }

  // Strong product preferences gathered from repeated user feedback.
  if (theme.id === 'finesse' && intent.styleTags.some((tag) => ['自然', '温暖', '生活'].includes(tag))) score += 16;
  if (theme.id === 'consultant' && intent.styleTags.some((tag) => ['商务', '专业'].includes(tag))) score += 16;
  if (theme.id === 'cornflower' && intent.styleTags.some((tag) => ['教育', '活泼'].includes(tag))) score += 16;
  if (theme.id === 'blues' && intent.styleTags.some((tag) => ['商务', '科技', '奢华'].includes(tag))) score += 12;

  return score;
}

export function resolveSmartThemeId(params: {
  text: string;
  scene?: string;
  tone?: Tone;
  fallbackThemeId?: string;
}): SmartThemeMatch | null {
  const intent = detectThemeIntent(params.text, params.scene, params.tone);
  const fallback = params.fallbackThemeId || 'consultant';

  if (!intent.hasExplicitColor && !intent.hasExplicitStyle && !params.scene && !params.tone) {
    return null;
  }

  const ranked = THEME_DATABASE
    .map((theme) => ({ theme, score: scoreTheme(theme, intent) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best || best.score <= 0) {
    return {
      themeId: fallback,
      themeLabel: intent.explicitColorLabel || '智能匹配',
      reason: `智能主题匹配=${fallback}`,
      locked: intent.hasExplicitColor,
    };
  }

  return {
    themeId: best.theme.id,
    themeLabel: intent.explicitColorLabel || best.theme.nameZh,
    reason: `智能主题匹配=${best.theme.nameZh}(${best.theme.id}) score=${best.score}`,
    locked: intent.hasExplicitColor,
  };
}
