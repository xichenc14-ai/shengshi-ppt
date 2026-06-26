import { DEFAULT_THEME_ID, THEME_DATABASE, type ThemeColorFamily, type ThemeData } from '@/lib/theme-database';

type Tone = 'professional' | 'casual' | 'creative' | 'bold' | 'traditional' | string;

type ThemeIntent = {
  colorFamilies: ThemeColorFamily[];
  styleTags: string[];
  sceneHints: string[];
  preferredThemeIds: string[];
  explicitColorLabel?: string;
  hasExplicitColor: boolean;
  hasExplicitStyle: boolean;
  matchedSignals: string[];
};

export type SmartThemeMatch = {
  themeId: string;
  themeLabel: string;
  reason: string;
  locked: boolean;
};

type IntentRule = {
  signal: string;
  re: RegExp;
  scenes: string[];
  tags: string[];
  themes: string[];
};

const COLOR_RULES: Array<{ family: ThemeColorFamily; label: string; re: RegExp }> = [
  { family: 'blue', label: '蓝色系', re: /商务蓝|蓝色主题|蓝色系|科技蓝|企业蓝|深蓝|海军蓝|宝石蓝|藏蓝|天蓝|淡蓝/ },
  { family: 'pink', label: '粉红系', re: /粉红|粉色|玫红|玫瑰红|少女粉|豆沙粉|樱花粉|珊瑚红|珊瑚粉|橙色|橙棕|红色主题|红色系|中国红|国旗红|喜庆红|大红|正红|朱红|酒红|红金|节庆红/ },
  { family: 'yellowCream', label: '米黄色系', re: /米黄|米色|米绿|优雅米绿|奶油|杏色|金色|暖黄|黄色系|金沙/ },
  { family: 'green', label: '绿色系', re: /绿色|绿色系|自然绿|清新绿|薄荷绿|生态绿|环保绿/ },
  { family: 'neutral', label: '黑白灰系', re: /白色|白色系|灰色|灰白|极简白|简约白|冷银|银灰|黑色|黑金|深色|暗色|夜间|暗夜|高对比/ },
  { family: 'purple', label: '紫色系', re: /紫色|紫粉|科技紫|蓝紫|薰衣草|极光紫/ },
];

const STYLE_RULES: Array<{ tag: string; re: RegExp }> = [
  { tag: '商务', re: /商务|汇报|报告|项目|企业|专业|正式|严谨|方案|总结/ },
  { tag: '科技', re: /科技|AI|人工智能|数字化|互联网|未来|算法|软件|创新|智能/ },
  { tag: '教育', re: /教育|学校|中学|大学|课程|培训|课件|教学|答辩/ },
  { tag: '自然', re: /自然|生态|环保|田园|乡村|文旅|旅行|旅游|城市漫游/ },
  { tag: '创意', re: /创意|新潮|视觉|品牌|营销|发布|海报|策划/ },
  { tag: '温暖', re: /温暖|亲和|生活|咖啡|餐饮|美食|社区|治愈/ },
  { tag: '情感', re: /婚礼|告白|恋爱|爱情|浪漫|相遇|相知|相守|周年|纪念|求婚|订婚/ },
  { tag: '高端', re: /高端|奢华|质感|精品|豪华|轻奢|尊贵/ },
  { tag: '简约', re: /简约|极简|干净|清爽|留白/ },
  { tag: '传统', re: /传统|国风|古风|中式|文化|非遗|党政|历史/ },
  { tag: '活泼', re: /活泼|年轻|轻松|趣味|校园|儿童/ },
  { tag: '理性', re: /数据|研究|分析|指标|图表|学术|论文|金融/ },
];

/**
 * 内容意图画像：把行业/场景、内容元素和表达气质映射到已策展主题。
 * themes 按优先级排列，避免只靠“专业”语气机械落到商务蓝。
 */
const INTENT_RULES: IntentRule[] = [
  { signal: '年度总结', re: /年终|年度|年报|复盘|述职|季度总结|工作总结/, scenes: ['年度总结', '商务汇报'], tags: ['商务', '稳重'], themes: ['dune', 'gold-leaf', 'blues', 'marine'] },
  { signal: '商务汇报', re: /工作汇报|项目汇报|经营汇报|商业计划|企业介绍|公司介绍|管理汇报/, scenes: ['商务汇报'], tags: ['商务', '稳重'], themes: ['dune', 'gold-leaf', 'petrol', 'blue-steel'] },
  { signal: '金融路演', re: /融资|路演|投资|金融|证券|基金|财务|资本|商业模式/, scenes: ['金融路演', '商务汇报'], tags: ['商务', '理性', '高端'], themes: ['marine', 'blues', 'dune', 'chocolate'] },
  { signal: '数据研究', re: /数据分析|研究报告|调研|指标|图表|实验|论文|学术|可视化/, scenes: ['数据分析', '研究报告'], tags: ['理性', '专业'], themes: ['verdigris', 'petrol', 'gleam', 'blue-steel'] },
  { signal: '科技产品', re: /人工智能|AI|大模型|科技|数字化|软件|互联网|机器人|芯片|算法|产品发布/, scenes: ['科技AI', '产品发布'], tags: ['科技', '未来'], themes: ['verdigris', 'aurora', 'blue-steel', 'borealis'] },
  { signal: '教育培训', re: /课程|课件|教学|培训|学校|校园|中学|大学|公开课|答辩/, scenes: ['教育培训', '培训课件'], tags: ['教育', '清新'], themes: ['icebreaker', 'vanilla', 'zephyr', 'keepsake'] },
  { signal: '旅游文旅', re: /旅行|旅游|攻略|行程|景点|城市介绍|文旅|酒店|民宿|度假|游学/, scenes: ['旅游出行', '文旅介绍'], tags: ['自然', '生活'], themes: ['finesse', 'cornfield', 'terracotta', 'leimoon'] },
  { signal: '餐饮咖啡', re: /咖啡|餐饮|美食|菜品|烘焙|甜品|饮品|奶茶|餐厅|茶饮/, scenes: ['餐饮美食', '生活方式'], tags: ['温暖', '生活'], themes: ['finesse', 'leimoon', 'chocolate', 'creme'] },
  { signal: '品牌营销', re: /品牌|营销|推广|广告|新品|发布会|活动策划|传播|社交媒体/, scenes: ['营销提案', '品牌介绍'], tags: ['创意', '品牌'], themes: ['gamma', 'atmosphere', 'rush', 'gold-leaf'] },
  { signal: '美妆时尚', re: /美妆|护肤|彩妆|时尚|服装|珠宝|香氛|女性品牌/, scenes: ['美妆时尚'], tags: ['雅致', '柔和'], themes: ['twilight', 'coral-glow', 'creme', 'peach'] },
  { signal: '婚礼情感', re: /婚礼|婚庆|求婚|爱情|恋爱|纪念日|周年|浪漫|相守/, scenes: ['婚礼庆典', '情感分享'], tags: ['情感', '浪漫'], themes: ['coral-glow', 'twilight', 'peach', 'malibu'] },
  { signal: '医疗健康', re: /医疗|健康|医院|护理|药品|医学|康复|心理|营养/, scenes: ['医疗健康'], tags: ['清新', '可靠'], themes: ['seafoam', 'sage', 'vanilla', 'icebreaker'] },
  { signal: '自然环保', re: /环保|生态|可持续|绿色发展|植物|农业|乡村振兴|碳中和/, scenes: ['环保公益', '乡村文旅'], tags: ['自然', '清新'], themes: ['lux', 'vanilla', 'sage', 'cornfield'] },
  { signal: '传统文化', re: /国风|古风|中式|传统文化|非遗|历史|博物馆|古镇|古村|文化遗产/, scenes: ['文化教育', '品牌故事'], tags: ['传统', '人文'], themes: ['terracotta', 'kraft', 'cornfield', 'linen'] },
  { signal: '高端品牌', re: /高端|轻奢|奢华|精品|豪华|尊贵|典藏/, scenes: ['高端品牌'], tags: ['高端', '质感'], themes: ['gold-leaf', 'dune', 'chocolate', 'marine'] },
  { signal: '生活方式', re: /生活方式|家居|日常|社区|成长|个人分享|兴趣/, scenes: ['生活方式'], tags: ['生活', '温暖'], themes: ['finesse', 'creme', 'vanilla', 'zephyr'] },
];

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export function detectThemeIntent(text: string, scene?: string, tone?: Tone): ThemeIntent {
  const source = `${text || ''} ${scene || ''}`.trim();
  const colorMatches = COLOR_RULES.filter(rule => rule.re.test(source));
  const styleTags = STYLE_RULES.filter(rule => rule.re.test(source)).map(rule => rule.tag);
  const matchedRules = INTENT_RULES.filter(rule => (
    rule.re.test(source)
    || (Boolean(scene) && (scene!.includes(rule.scenes[0]) || rule.scenes[0].includes(scene!)))
  ));
  const toneTags: string[] = [];

  if (tone === 'professional') toneTags.push('稳重', '专业');
  if (tone === 'casual') toneTags.push('温暖', '生活', '活泼');
  if (tone === 'creative') toneTags.push('创意', '年轻');
  if (tone === 'bold') toneTags.push('科技', '未来', '高对比');
  if (tone === 'traditional') toneTags.push('传统', '文化', '人文');

  const preferredThemeIds = matchedRules.flatMap(rule => rule.themes);
  let explicitColorLabel = colorMatches[0]?.label;

  if (/白色简约|白色极简|纯白简约|简约白|极简白|白色风格/.test(source)) preferredThemeIds.unshift('pearl');
  if (/红色主题|红色系|中国红|国旗红|喜庆红|大红|正红|朱红|酒红|红金|节庆红/.test(source)) {
    preferredThemeIds.unshift('rush', 'canaveral');
    explicitColorLabel = '红色系';
  }
  if (/珊瑚红|珊瑚粉|橘粉|橘红|暖橘红/.test(source)) {
    preferredThemeIds.unshift('coral-glow');
    explicitColorLabel = '珊瑚红';
  }
  if (/玫红|玫瑰红|粉色|少女粉|豆沙粉|樱花粉/.test(source)) {
    preferredThemeIds.unshift('twilight');
    explicitColorLabel = '玫瑰粉';
  }
  if (/深蓝|海军蓝|藏蓝/.test(source)) preferredThemeIds.unshift('blues', 'marine');
  if (/天蓝|校园|学校|中学|教育|培训/.test(source) && /蓝/.test(source)) preferredThemeIds.unshift('icebreaker');
  if (/咖啡|田园|文旅|乡村|自然|优雅米绿|米绿/.test(source)) preferredThemeIds.unshift('finesse');
  if (/红色主题|红色系|中国红|国旗红|喜庆红|大红|正红|朱红|酒红|红金|节庆红/.test(source)) {
    preferredThemeIds.unshift('rush');
  }
  if (colorMatches.some(match => match.family === 'blue')) {
    if (/教育|培训|校园|学校|中学|大学/.test(source)) preferredThemeIds.unshift('icebreaker');
    else if (/科技|AI|人工智能|数字化|软件|互联网/.test(source)) preferredThemeIds.unshift('blue-steel');
    else if (!/深蓝|海军蓝|藏蓝/.test(source)) preferredThemeIds.unshift('petrol');
  }

  return {
    colorFamilies: unique(colorMatches.map(rule => rule.family)),
    styleTags: unique([
      ...styleTags,
      ...matchedRules.flatMap(rule => rule.tags),
      ...toneTags,
    ]),
    sceneHints: unique([...(scene ? [scene] : []), ...matchedRules.flatMap(rule => rule.scenes)]),
    preferredThemeIds: unique(preferredThemeIds),
    explicitColorLabel,
    hasExplicitColor: colorMatches.length > 0,
    hasExplicitStyle: styleTags.length > 0 || matchedRules.length > 0,
    matchedSignals: matchedRules.map(rule => rule.signal),
  };
}

function scoreTheme(theme: ThemeData, intent: ThemeIntent): number {
  let score = theme.id === DEFAULT_THEME_ID ? 12 : 0;
  const prefersWhiteTheme = intent.colorFamilies.includes('neutral')
    || intent.preferredThemeIds.includes('pearl');

  if (intent.colorFamilies.length > 0) {
    score += intent.colorFamilies.includes(theme.colorFamily) ? 115 : -75;
  }

  const preferenceRank = intent.preferredThemeIds.indexOf(theme.id);
  if (preferenceRank >= 0) score += Math.max(45, 150 - preferenceRank * 14);
  if (preferenceRank === 0) score += 28;
  if (intent.hasExplicitColor && preferenceRank === 0) score += 110;

  for (const scene of intent.sceneHints) {
    if (theme.scenes.includes(scene)) score += 42;
    else if (theme.scenes.some(item => scene.includes(item) || item.includes(scene))) score += 22;
  }

  for (const tag of intent.styleTags) {
    if (theme.tags?.includes(tag)) score += 24;
    if (theme.style.includes(tag)) score += 16;
    if (theme.nameZh.includes(tag)) score += 8;
  }

  if (theme.colorFamily === 'neutral' && !prefersWhiteTheme) score -= 55;
  if (theme.id === 'pearl' && !prefersWhiteTheme) score -= 40;

  if (theme.id === 'petrol' && !intent.colorFamilies.includes('blue') && preferenceRank < 0) score -= 24;

  return score;
}

export function resolveSmartThemeId(params: {
  text: string;
  scene?: string;
  tone?: Tone;
  fallbackThemeId?: string;
}): SmartThemeMatch {
  const intent = detectThemeIntent(params.text, params.scene, params.tone);
  const fallback = params.fallbackThemeId || DEFAULT_THEME_ID;
  const ranked = THEME_DATABASE
    .map(theme => ({ theme, score: scoreTheme(theme, intent) }))
    .sort((a, b) => b.score - a.score || a.theme.id.localeCompare(b.theme.id));
  const best = ranked[0];
  const selected = best && best.score > 12
    ? best.theme
    : THEME_DATABASE.find(theme => theme.id === fallback)
      || THEME_DATABASE.find(theme => theme.id === DEFAULT_THEME_ID)
      || ranked[0].theme;

  return {
    themeId: selected.id,
    themeLabel: intent.explicitColorLabel || selected.nameZh,
    reason: `主题画像=${intent.matchedSignals.join('+') || '默认雅致米绿'}；匹配=${selected.nameZh}(${selected.id})`,
    locked: intent.hasExplicitColor,
  };
}
