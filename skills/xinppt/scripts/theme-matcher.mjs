// Shared, deterministic theme decision core. The bundled skill gets an identical generated copy.
export const THEME_MATCHER_VERSION = '2026-09-28.4';

const COLOR_RULES = [
  { id: 'blackGold', label: '黑金', re: /黑金|黑底金字|黑底金色/g },
  { id: 'red', label: '红色', re: /中国红|正红|大红|喜庆红|红色|朱红|酒红|红金/g },
  { id: 'pink', label: '粉色', re: /粉色|粉红|玫红|玫瑰粉|少女粉|樱花粉|豆沙粉/g },
  { id: 'blue', label: '蓝色', re: /深蓝|海军蓝|藏蓝|科技蓝|宝石蓝|天蓝|浅蓝|蓝色系|蓝色/g },
  { id: 'green', label: '绿色', re: /深绿|墨绿|薄荷绿|青绿|绿色/g },
  { id: 'purple', label: '紫色', re: /紫色|蓝紫|薰衣草紫|极光紫/g },
  { id: 'gold', label: '金色', re: /金色|金箔|香槟金/g },
  { id: 'cream', label: '米色', re: /米白|米色|奶油色|杏色|浅砂/g },
  { id: 'white', label: '白底', re: /白底|纯白|白色|极简白/g },
  { id: 'dark', label: '深色', re: /深色|暗色|黑色|黑底|夜间|暗夜/g },
];

const INTENT_RULES = [
  { id: '年度总结', re: /年终|年度|年报|复盘|述职|季度总结|工作总结/, scenes: ['商务汇报'], tags: ['商务'], preferred: ['gold-leaf', 'pearl'] },
  { id: '金融路演', re: /融资|路演|投资|证券|基金|资本|商业模式/, scenes: ['商务汇报'], tags: ['理性', '高端'], preferred: ['marine', 'gold-leaf'] },
  { id: '数据研究', re: /数据分析|研究报告|调研|指标|图表|实验|论文|学术|可视化/, scenes: ['研究报告'], tags: ['理性', '专业'], preferred: ['pearl', 'icebreaker'] },
  { id: '科技产品', re: /人工智能|\bAI\b|大模型|科技|数字化|软件|互联网|机器人|芯片|算法|产品发布/i, scenes: ['科技AI', '产品发布'], tags: ['科技', '未来'], preferred: ['icebreaker', 'atmosphere'] },
  { id: '教育培训', re: /课程|课件|教学|培训|学校|校园|中学|大学|公开课|答辩/, scenes: ['教育课件', '培训课件'], tags: ['教育', '清新'], preferred: ['icebreaker', 'finesse'] },
  { id: '旅游文旅', re: /旅行|旅游|攻略|行程|景点|城市介绍|文旅|酒店|民宿|度假/, scenes: ['旅游出行'], tags: ['自然', '生活'], preferred: ['finesse', 'lux'] },
  { id: '餐饮生活', re: /咖啡|餐饮|美食|菜品|烘焙|甜品|饮品|奶茶/, scenes: ['餐饮美食', '生活方式'], tags: ['温暖', '生活'], preferred: ['finesse', 'twilight'] },
  { id: '品牌营销', re: /品牌(?:营销|推广|传播|发布|策划)|营销|推广|广告|新品|发布会|活动策划|传播/, scenes: ['创意方案', '产品发布'], tags: ['创意', '品牌'], preferred: ['atmosphere', 'gold-leaf'] },
  { id: '美妆时尚', re: /美妆|护肤|彩妆|时尚|服装|珠宝|香氛/, scenes: ['美妆时尚'], tags: ['温暖', '创意'], preferred: ['twilight', 'atmosphere'] },
  { id: '婚礼情感', re: /婚礼|婚庆|求婚|爱情|恋爱|纪念日|周年|浪漫/, scenes: ['婚礼庆典'], tags: ['温暖', '活力'], preferred: ['twilight', 'finesse'] },
  { id: '医疗健康', re: /医疗|健康|医院|护理|药品|医学|康复|心理|营养/, scenes: ['医疗健康'], tags: ['清新', '专业'], preferred: ['icebreaker', 'pearl'] },
  { id: '自然环保', re: /环保|生态|可持续|绿色发展|植物|农业|乡村振兴|碳中和/, scenes: ['环保公益'], tags: ['自然', '清新'], preferred: ['lux', 'finesse'] },
  { id: '传统文化', re: /国风|古风|中式|传统文化|非遗|历史|博物馆|诗词|书法|茶道|水墨|汉服/, scenes: ['文化教育'], tags: ['传统'], preferred: ['finesse', 'marine'] },
  { id: '高端品牌', re: /高端|轻奢|奢华|精品|尊贵|典藏/, scenes: ['高端品牌'], tags: ['质感', '雅致'], preferred: ['gold-leaf', 'marine'] },
  { id: '商务汇报', re: /工作汇报|项目汇报|经营汇报|季度经营|经营报告|经营分析|财务报告|商业计划|企业介绍|公司介绍|企业品牌介绍|公司品牌介绍|管理汇报|商业提案/, scenes: ['商务汇报'], tags: ['商务', '专业'], preferred: ['gold-leaf', 'icebreaker'] },
  { id: '精美视觉', re: /精美|高级|大气|审美|艺术|设计感|作品集|画册|图册|精致/, scenes: ['高端品牌'], tags: ['高端', '质感'], preferred: ['gold-leaf', 'lux', 'twilight'] },
  { id: '清新可爱', re: /清新可爱|可爱|少女|亲子|儿童|幼儿|卡通|甜美/, scenes: ['生活方式'], tags: ['活泼', '温暖'], preferred: ['twilight', 'atmosphere', 'finesse'] },
];

const STYLE_RULES = [
  { id: '商务', re: /商务|汇报|报告|正式|严谨|专业/ },
  { id: '科技', re: /科技|人工智能|数字化|未来|智能/ },
  { id: '教育', re: /教育|教学|课程|培训|课件/ },
  { id: '自然', re: /自然|生态|环保|田园|文旅/ },
  { id: '创意', re: /创意|新潮|视觉|品牌|营销|发布/ },
  { id: '温暖', re: /温暖|亲和|生活|咖啡|餐饮|治愈/ },
  { id: '高端', re: /高端|奢华|质感|精品|轻奢/ },
  { id: '简约', re: /简约|极简|干净|清爽|留白|克制/ },
  { id: '传统', re: /传统|国风|古风|中式|非遗/ },
  { id: '活泼', re: /活泼|年轻|轻松|儿童|校园/ },
  { id: '理性', re: /数据|研究|分析|指标|图表|金融/ },
];

const COLOR_PROFILES = {
  pearl: ['white', 'cream'], twilight: ['pink', 'white'], lux: ['green', 'dark'],
  atmosphere: ['purple', 'pink', 'white'], finesse: ['cream', 'green', 'white'],
  icebreaker: ['blue', 'white'], marine: ['blue', 'dark'], 'gold-leaf': ['gold', 'white', 'cream'],
  rush: ['red', 'pink', 'white'], canaveral: ['red', 'pink', 'dark'], blues: ['blue', 'dark'],
  vortex: ['dark'], verdigris: ['green', 'dark'], petrol: ['blue', 'dark'],
  'blue-steel': ['blue', 'white'], 'coral-glow': ['pink', 'white'],
};

// Routing hypotheses for the curated set; export quality still requires visual review.
const CURATED_FIT = {
  pearl: { audiences: ['board', 'expert'], densities: ['dense', 'medium'] },
  icebreaker: { audiences: ['expert', 'student', 'public'], densities: ['dense', 'medium'] },
  marine: { audiences: ['board', 'investor'], densities: ['visual', 'medium'] },
  'gold-leaf': { audiences: ['board', 'investor'], densities: ['medium', 'visual'] },
  finesse: { audiences: ['student', 'public'], densities: ['medium', 'visual'] },
  lux: { audiences: ['investor', 'public'], densities: ['visual'] },
  twilight: { audiences: ['public', 'child'], densities: ['visual', 'medium'] },
  atmosphere: { audiences: ['public', 'child'], densities: ['visual', 'medium'] },
};

const AUDIENCE_RULES = [
  { id: 'board', re: /董事会|管理层|高管|领导汇报|决策层/ },
  { id: 'investor', re: /投资人|投资者|投资机构|融资路演|股东/ },
  { id: 'expert', re: /专家|同行|研究员|学术|科研|医生|医师/ },
  { id: 'child', re: /儿童|幼儿|小学生|亲子/ },
  { id: 'student', re: /学生|中学|大学|课堂|学员/ },
  { id: 'public', re: /公众|大众|消费者|游客|客户/ },
];

function detectDensity(text, explicitDensity) {
  if (['dense', 'medium', 'visual'].includes(explicitDensity)) return explicitDensity;
  if (/数据密集|多图表|复杂图表|大量表格|详细报告|财务报表|技术评审|学术报告/.test(text)) return 'dense';
  if (/照片为主|图片为主|画册|作品集|视觉展示|极少文字|少文字|大图展示/.test(text)) return 'visual';
  return '';
}

const NEGATIVE_PREFIX = /(?:不要|别用|禁止|禁用|排除|避免|不使用|不选|不能用|拒绝)/;
const NO_REQUIREMENT_PREFIX = /(?:不要求|无需|不用特意|不必|没要求|不指定)/;
const DESIGN_CONTEXT = /(?:主题|风格|配色|主色|底色|背景|色系|强调色)/;
const EXPLICIT_VERB = /(?:请|帮我)?(?:使用|用|采用|选择|指定|套用|换成|改为)/;

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function unique(values) { return [...new Set(values)]; }
function hexLuminance(hex) {
  const match = /^#([\da-f]{6})$/i.exec(hex || '');
  if (!match) return 1;
  const parts = [0, 2, 4].map(i => parseInt(match[1].slice(i, i + 2), 16) / 255)
    .map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return parts[0] * 0.2126 + parts[1] * 0.7152 + parts[2] * 0.0722;
}

function themeColors(theme) {
  return COLOR_PROFILES[theme.id] || unique([
    theme.colorFamily === 'yellowCream' ? 'cream' : theme.colorFamily === 'neutral' ? 'white' : theme.colorFamily,
    hexLuminance(theme.colors?.[0]) < 0.24 ? 'dark' : 'white',
  ]);
}

function findNamedTheme(text, themes) {
  const lower = text.toLowerCase();
  const names = themes.flatMap(theme => [theme.nameZh, theme.originalNameZh, theme.id, theme.name]
    .filter(value => typeof value === 'string' && value.length >= 2)
    .map(value => ({ theme, value })));
  names.sort((a, b) => b.value.length - a.value.length);
  for (const { theme, value } of names) {
    const match = lower.match(new RegExp(`${EXPLICIT_VERB.source}.{0,10}${escapeRegex(value.toLowerCase())}(?:\\b|主题|风格|$)?`, 'i'));
    if (match) return { theme, evidence: match[0] };
  }
  return null;
}

function extractColors(text) {
  const positive = [], banned = [], neutralized = [], evidence = [];
  for (const rule of COLOR_RULES) {
    rule.re.lastIndex = 0;
    for (const match of text.matchAll(rule.re)) {
      const before = text.slice(Math.max(0, match.index - 12), match.index);
      const after = text.slice(match.index + match[0].length, match.index + match[0].length + 8);
      const clause = before.split(/[，。；,;\n]/).pop() || '';
      if (NO_REQUIREMENT_PREFIX.test(clause)) { neutralized.push(rule.id); continue; }
      if (NEGATIVE_PREFIX.test(clause)) { banned.push(rule.id); evidence.push(`排除${rule.label}:${clause}${match[0]}`); continue; }
      const design = DESIGN_CONTEXT.test(`${before}${after}`) || /色系$|深蓝|海军蓝|藏蓝|黑金|白底|深色|浅蓝/.test(match[0]);
      if (design && !neutralized.includes(rule.id)) {
        positive.push(rule.id); evidence.push(`偏好${rule.label}:${match[0]}`);
        if (rule.id === 'blue' && /深蓝|海军蓝|藏蓝/.test(match[0])) positive.push('dark');
      }
    }
  }
  return { preferred: unique(positive.filter(color => !neutralized.includes(color) && !banned.includes(color))),
    banned: unique(banned), neutralized: unique(neutralized), evidence };
}

function positiveText(text) {
  return text.replace(/(?:不要|别用|禁止|禁用|排除|避免|不使用|不选|不能用|拒绝|不要求|无需|不用特意|不必|没要求|不指定)[^，。；,;\n]{0,24}/g, ' ');
}

function bannedStyles(text) {
  const clauses = text.match(/(?:不要|别用|禁止|禁用|排除|避免|不使用|不选|不能用|拒绝)[^，。；,;\n]{0,24}/g) || [];
  return unique(STYLE_RULES.filter(rule => clauses.some(clause => rule.re.test(clause))).map(rule => rule.id));
}

export function extractThemeIntent({ text = '', contextText = '', scene = '', tone = '', audience = '', density = '', themes = [] }) {
  const source = String(text).trim();
  const clean = positiveText(source);
  const semanticText = `${clean} ${String(contextText).trim()}`;
  const colors = extractColors(source);
  const excludedTags = bannedStyles(source);
  const named = findNamedTheme(clean, themes);
  const signals = INTENT_RULES.filter(rule => rule.re.test(`${semanticText} ${scene}`));
  const preferenceSignals = scene
    ? [...signals].sort((a, b) => Number(b.scenes.includes(scene)) - Number(a.scenes.includes(scene)))
    : signals;
  const tags = STYLE_RULES.filter(rule => rule.re.test(`${semanticText} ${scene}`)).map(rule => rule.id);
  const audiences = unique([
    ...AUDIENCE_RULES.filter(rule => rule.re.test(`${semanticText} ${audience}`)).map(rule => rule.id),
    ...(AUDIENCE_RULES.some(rule => rule.id === audience) ? [audience] : []),
  ]);
  if (tone === 'professional') tags.push('专业');
  if (tone === 'casual') tags.push('温暖');
  if (tone === 'creative') tags.push('创意');
  if (tone === 'bold') tags.push('科技');
  if (tone === 'traditional') tags.push('传统');
  return {
    colors, explicitTheme: named?.theme.id || null, explicitEvidence: named?.evidence || null,
    primaryScene: String(scene).trim(),
    scenes: unique([scene, ...signals.flatMap(rule => rule.scenes)].filter(Boolean)),
    tags: unique([...tags, ...signals.flatMap(rule => rule.tags)]).filter(tag => !excludedTags.includes(tag)),
    audiences,
    density: detectDensity(semanticText, density),
    bannedTags: excludedTags,
    preferredThemes: preferenceSignals.flatMap(rule => rule.preferred),
    signals: signals.map(rule => rule.id),
    evidence: [...colors.evidence, ...(named ? [`指定主题:${named.evidence}`] : [])],
    hasHardColor: /白底|黑底|黑金|深色|蓝色系|绿色系|粉色系|红色系|紫色系/.test(source) || colors.preferred.some(color => new RegExp(`(?:${EXPLICIT_VERB.source}).{0,12}(?:${COLOR_RULES.find(rule => rule.id === color)?.re.source || ''}).{0,8}(?:${DESIGN_CONTEXT.source})|(?:${COLOR_RULES.find(rule => rule.id === color)?.re.source || ''}).{0,5}(?:${DESIGN_CONTEXT.source})`).test(source)),
  };
}

function violates(theme, intent) {
  const palette = themeColors(theme);
  if (intent.colors.banned.some(color => palette.includes(color))) return '命中禁用配色';
  if (intent.bannedTags.some(tag => theme.tags?.includes(tag) || theme.style?.includes(tag))) return '命中禁用风格';
  if (intent.colors.preferred.includes('blackGold') && !(palette.includes('dark') && palette.includes('gold'))) return '不满足黑金配色';
  if (intent.hasHardColor && intent.colors.preferred.length > 0 &&
      !intent.colors.preferred.some(color => palette.includes(color) || (color === 'blackGold' && palette.includes('dark') && palette.includes('gold')))) {
    return '不满足指定配色';
  }
  return null;
}

function score(theme, intent) {
  const parts = {};
  const palette = themeColors(theme);
  parts.color = Math.min(24, intent.colors.preferred.filter(color => palette.includes(color)).length * 18);
  const inferredScenes = intent.scenes.filter(scene => scene !== intent.primaryScene);
  parts.scene = intent.primaryScene
    ? (theme.scenes?.includes(intent.primaryScene) ? 30 : 0)
      + Math.min(12, inferredScenes.reduce((sum, scene) => sum + (theme.scenes?.includes(scene) ? 12 : 0), 0))
    : Math.min(30, inferredScenes.reduce((sum, scene) => sum + (theme.scenes?.includes(scene) ? 18 : 0), 0));
  parts.style = Math.min(20, intent.tags.reduce((sum, tag) => sum + (theme.tags?.includes(tag) ? 7 : theme.style?.includes(tag) ? 4 : 0), 0));
  const preferenceRank = intent.preferredThemes.indexOf(theme.id);
  parts.intent = Math.min(36, intent.preferredThemes.filter(id => id === theme.id).length * 18 + (preferenceRank === 0 ? 10 : 0));
  const fit = CURATED_FIT[theme.id];
  parts.audience = fit && intent.audiences.length ?
    (intent.audiences.some(audience => fit.audiences.includes(audience)) ? 14 : -8) : 0;
  parts.density = fit && intent.density ?
    (fit.densities.includes(intent.density) ? 16 : -12) : 0;
  parts.readability = !intent.colors.preferred.includes('dark') && palette.includes('dark') &&
    (intent.tags.includes('理性') || intent.signals.includes('医疗健康') || intent.signals.includes('教育培训') ||
      intent.signals.includes('旅游文旅') || intent.colors.preferred.includes('red')) ? -12 : 0;
  parts.default = theme.id === 'pearl' && intent.signals.length === 0 && intent.colors.preferred.length === 0 ? 8 : 0;
  return { total: Object.values(parts).reduce((sum, value) => sum + value, 0), parts };
}

export function matchTheme({ text = '', contextText = '', scene = '', tone = '', audience = '', density = '', explicitThemeId = '', fallbackThemeId = 'pearl', catalog }) {
  const themes = catalog?.themes || [];
  if (!themes.length) throw new Error('主题目录为空');
  const recommendedIds = catalog.recommendedIds || [];
  const intent = extractThemeIntent({ text, contextText, scene, tone, audience, density, themes });
  if (explicitThemeId && intent.explicitTheme && explicitThemeId !== intent.explicitTheme) {
    return { status: 'conflict', conflict: `手选主题 ${explicitThemeId} 与明文指定主题 ${intent.explicitTheme} 不一致`, intent, version: THEME_MATCHER_VERSION };
  }
  const explicit = explicitThemeId || intent.explicitTheme;
  if (explicit) {
    const selected = themes.find(theme => theme.id === explicit);
    if (!selected) return { status: 'conflict', conflict: `指定主题 ${explicit} 不在已验证主题目录中`, intent, version: THEME_MATCHER_VERSION };
    const issue = violates(selected, intent);
    if (issue) return { status: 'conflict', conflict: `指定主题 ${selected.nameZh} 与当前配色要求冲突：${issue}`, intent, version: THEME_MATCHER_VERSION };
    return { status: 'selected', themeId: selected.id, themeLabel: selected.nameZh,
      source: 'explicit', locked: true, confidence: 'high', reason: `明确指定 ${selected.nameZh}`,
      candidates: [{ id: selected.id, score: 100, parts: { explicit: 100 } }], intent, version: THEME_MATCHER_VERSION };
  }
  const ranked = themes.filter(theme => !theme.isDeprecated).map(theme => {
    const issue = violates(theme, intent);
    const scored = score(theme, intent);
    return { theme, issue, ...scored };
  }).filter(item => !item.issue).sort((a, b) => b.total - a.total ||
    recommendedIds.indexOf(a.theme.id) - recommendedIds.indexOf(b.theme.id) || a.theme.id.localeCompare(b.theme.id));
  if (!ranked.length) return { status: 'conflict', conflict: '没有满足全部指定配色与排除条件的主题', intent, version: THEME_MATCHER_VERSION };
  const curated = ranked.filter(item => recommendedIds.includes(item.theme.id) &&
    (item.total >= 12 || (intent.signals.length === 0 && intent.colors.preferred.length === 0)));
  const selected = curated[0] || ranked[0] || ranked.find(item => item.theme.id === fallbackThemeId);
  const pool = curated.length ? curated : ranked;
  const margin = selected.total - (pool.find(item => item.theme.id !== selected.theme.id)?.total || 0);
  const confidence = selected.total >= 30 && margin >= 10 ? 'high' : selected.total >= 12 ? 'medium' : 'low';
  return { status: 'selected', themeId: selected.theme.id, themeLabel: selected.theme.nameZh,
    source: curated.length ? 'recommended' : 'expanded', locked: intent.hasHardColor,
    confidence, reason: `${curated.length ? '精选主题优先' : '扩展主题'}：${intent.signals.join('、') || intent.colors.preferred.join('、') || '通用'} → ${selected.theme.nameZh}`,
    candidates: pool.slice(0, 3).map(item => ({ id: item.theme.id, score: item.total, parts: item.parts })),
    intent, version: THEME_MATCHER_VERSION };
}
