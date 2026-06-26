/**
 * Gamma 主题库
 *
 * 主题清单以 2026-06-26 Excel《Gamma主题实际api生成样本——推荐+6色系分类清单》为准。
 * 灰色/隐藏行不进入正式展示；前端名称使用表格里的“建议主题名”。
 */

export type ThemeColorFamily = 'yellowCream' | 'blue' | 'green' | 'purple' | 'pink' | 'neutral';

export interface ThemeData {
  id: string;
  name: string;
  nameZh: string;
  originalNameZh?: string;
  colors: string[];
  palette?: string[];
  gradient?: { from: string; to: string; angle: number };
  category: ThemeColorFamily;
  colorFamily: ThemeColorFamily;
  categoryZh: string;
  emoji: string;
  style: string;
  scenes: string[];
  tags?: string[];
  previewImage?: string;
  isRecommended?: boolean;
  isDeprecated?: boolean;
  replacedBy?: string;
  isLocked?: boolean;
}

type ThemeSeed = {
  id: string;
  name: string;
  nameZh: string;
  originalNameZh?: string;
  colors: [string, string, string];
  category: ThemeColorFamily;
  style: string;
  scenes: string[];
  tags: string[];
  previewImage: string;
  isRecommended?: boolean;
};

type CategoryMeta = { name: string; emoji: string; colors: string[] };

const CATEGORY_META: Record<ThemeColorFamily, CategoryMeta> = {
  yellowCream: { name: "米黄色系", emoji: "米", colors: ["#F9F6F0", "#D8A94A", "#6B4E2E"] },
  blue: { name: "蓝色系", emoji: "蓝", colors: ["#0F2D5C", "#3B82F6", "#D7E8FF"] },
  green: { name: "绿色系", emoji: "绿", colors: ["#0B4F3A", "#22C55E", "#DFF7EC"] },
  purple: { name: "紫色系", emoji: "紫", colors: ["#2E1065", "#8B5CF6", "#EDE9FE"] },
  pink: { name: "粉红系", emoji: "粉", colors: ["#FCE7F3", "#EC4899", "#7F1D1D"] },
  neutral: { name: "黑白灰中性色", emoji: "灰", colors: ["#FFFFFF", "#9CA3AF", "#111827"] },
};

export const CATEGORY_ORDER: ThemeColorFamily[] = ['yellowCream', 'blue', 'green', 'purple', 'pink', 'neutral'];
export const MAX_THEMES_PER_CATEGORY = 8;

export const CATEGORY_THEME_DISPLAY_ORDER: Record<ThemeColorFamily, string[]> = {
  yellowCream: ["creme", "dune", "chocolate", "cornfield", "gold-leaf", "linen", "finesse", "terracotta"],
  blue: ["stratos", "lunaria", "petrol", "blues", "zephyr", "icebreaker", "blue-steel", "keepsake"],
  green: ["seafoam", "lux", "sage", "verdigris", "fluo", "vanilla", "alien", "borealis"],
  purple: ["spectrum", "prism", "gamma", "lavender", "atmosphere", "aurora", "velvet-tides", "daydream"],
  pink: ["twilight", "coral-glow", "peach", "atacama", "malibu", "rush", "leimoon", "canaveral"],
  neutral: ["pearl", "vortex", "mercury", "oatmeal", "chimney-dust", "gleam", "marine", "kraft"],
};

const SEEDS: ThemeSeed[] = [
  { id: "creme", name: "Creme", nameZh: "奶油流沙", originalNameZh: "奶油", colors: ["#E4DCD1", "#BAAB9B", "#1F2937"] as [string, string, string], category: 'yellowCream', style: "奶油米色纹理图", scenes: ["商务汇报", "高端品牌", "生活方式"], tags: ["温暖", "质感", "雅致"], previewImage: "/theme-previews/creme.jpg" },
  { id: "dune", name: "Dune", nameZh: "沙丘流金", originalNameZh: "沙丘", colors: ["#D9CDC1", "#81614D", "#1F2937"] as [string, string, string], category: 'yellowCream', style: "白底，沙金色纹理图", scenes: ["商务汇报", "高端品牌", "生活方式"], tags: ["温暖", "质感", "雅致"], previewImage: "/theme-previews/dune.jpg" },
  { id: "chocolate", name: "Chocolate", nameZh: "巧克暖棕", originalNameZh: "巧克力", colors: ["#716162", "#685557", "#F8FAFC"] as [string, string, string], category: 'yellowCream', style: "棕色背景，巧克力图案", scenes: ["商务汇报", "高端品牌", "生活方式"], tags: ["温暖", "质感", "雅致"], previewImage: "/theme-previews/chocolate.jpg" },
  { id: "cornfield", name: "Cornfield", nameZh: "玉田秋色", originalNameZh: "玉米田", colors: ["#DCD1AF", "#8F7B3A", "#1F2937"] as [string, string, string], category: 'yellowCream', style: "米黄背景，植物黄绿图", scenes: ["商务汇报", "高端品牌", "生活方式"], tags: ["温暖", "质感", "雅致"], previewImage: "/theme-previews/cornfield.jpg" },
  { id: "gold-leaf", name: "GoldLeaf", nameZh: "金箔流白", originalNameZh: "金箔", colors: ["#E7E5DF", "#A49A85", "#1F2937"] as [string, string, string], category: 'yellowCream', style: "白底，金色纹理图", scenes: ["商务汇报", "高端品牌", "生活方式"], tags: ["温暖", "质感", "雅致"], previewImage: "/theme-previews/gold-leaf.jpg", isRecommended: true },
  { id: "linen", name: "Linen", nameZh: "亚麻暖白", originalNameZh: "亚麻布", colors: ["#EFEBE5", "#D7D1C7", "#1F2937"] as [string, string, string], category: 'yellowCream', style: "米白背景，布料感", scenes: ["商务汇报", "高端品牌", "生活方式"], tags: ["温暖", "质感", "雅致"], previewImage: "/theme-previews/linen.jpg" },
  { id: "finesse", name: "Finesse", nameZh: "优雅浅砂", originalNameZh: "优雅", colors: ["#ECE0C9", "#C7B28D", "#1F2937"] as [string, string, string], category: 'yellowCream', style: "米白底，深绿标题和元素", scenes: ["商务汇报", "高端品牌", "生活方式"], tags: ["温暖", "质感", "雅致"], previewImage: "/theme-previews/finesse.jpg", isRecommended: true },
  { id: "terracotta", name: "Terracotta", nameZh: "赤陶暖砂", originalNameZh: "赤陶", colors: ["#F2E9E4", "#CEAFA4", "#1F2937"] as [string, string, string], category: 'yellowCream', style: "白底，赤陶图案", scenes: ["商务汇报", "高端品牌", "生活方式"], tags: ["温暖", "质感", "雅致"], previewImage: "/theme-previews/terracotta.jpg" },
  { id: "stratos", name: "Stratos", nameZh: "平流深蓝", originalNameZh: "平流层", colors: ["#13285C", "#3490DE", "#F8FAFC"] as [string, string, string], category: 'blue', style: "深蓝背景，亮蓝强调图", scenes: ["商务汇报", "科技AI", "研究报告"], tags: ["专业", "科技", "稳重"], previewImage: "/theme-previews/stratos.jpg" },
  { id: "lunaria", name: "Lunaria", nameZh: "月华幽蓝", originalNameZh: "月华", colors: ["#0E1141", "#080E3E", "#F8FAFC"] as [string, string, string], category: 'blue', style: "深蓝背景，月夜感", scenes: ["商务汇报", "科技AI", "研究报告"], tags: ["专业", "科技", "稳重"], previewImage: "/theme-previews/lunaria.jpg" },
  { id: "petrol", name: "Petrol", nameZh: "石油蓝雾", originalNameZh: "石油蓝", colors: ["#BCCBCF", "#4C748A", "#1F2937"] as [string, string, string], category: 'blue', style: "米白底，蓝灰雾面强调图", scenes: ["商务汇报", "科技AI", "研究报告"], tags: ["专业", "科技", "稳重"], previewImage: "/theme-previews/petrol.jpg" },
  { id: "blues", name: "Blues", nameZh: "布鲁深蓝", originalNameZh: "布鲁斯蓝", colors: ["#091F39", "#225C95", "#F8FAFC"] as [string, string, string], category: 'blue', style: "深蓝背景，蓝色纹理图", scenes: ["商务汇报", "科技AI", "研究报告"], tags: ["专业", "科技", "稳重"], previewImage: "/theme-previews/blues.jpg" },
  { id: "zephyr", name: "Zephyr", nameZh: "和风云蓝", originalNameZh: "和风", colors: ["#D2E9F5", "#53A5D2", "#1F2937"] as [string, string, string], category: 'blue', style: "白底，蓝色云雾图", scenes: ["商务汇报", "科技AI", "研究报告"], tags: ["专业", "科技", "稳重"], previewImage: "/theme-previews/zephyr.jpg" },
  { id: "icebreaker", name: "Icebreaker", nameZh: "破冰晴蓝", originalNameZh: "破冰蓝", colors: ["#D2DCED", "#7D97C7", "#1F2937"] as [string, string, string], category: 'blue', style: "白底，冰川浅蓝强调图", scenes: ["商务汇报", "科技AI", "研究报告"], tags: ["专业", "科技", "稳重"], previewImage: "/theme-previews/icebreaker.jpg", isRecommended: true },
  { id: "blue-steel", name: "BlueSteel", nameZh: "蓝钢锋面", originalNameZh: "蓝钢", colors: ["#4E5E76", "#426291", "#F8FAFC"] as [string, string, string], category: 'blue', style: "深蓝灰背景，钢蓝几何图", scenes: ["商务汇报", "科技AI", "研究报告"], tags: ["专业", "科技", "稳重"], previewImage: "/theme-previews/blue-steel.jpg" },
  { id: "keepsake", name: "Keepsake", nameZh: "纪念微蓝", originalNameZh: "纪念物", colors: ["#DDEAED", "#A8CEDB", "#1F2937"] as [string, string, string], category: 'blue', style: "白底，浅蓝柔和图", scenes: ["商务汇报", "科技AI", "研究报告"], tags: ["专业", "科技", "稳重"], previewImage: "/theme-previews/keepsake.jpg" },
  { id: "seafoam", name: "Seafoam", nameZh: "海沫青岚", originalNameZh: "海沫绿", colors: ["#D2E8E6", "#8BD3C9", "#1F2937"] as [string, string, string], category: 'green', style: "白底，青绿色海沫图", scenes: ["环保公益", "医疗健康", "生活方式"], tags: ["自然", "清新", "科技"], previewImage: "/theme-previews/seafoam.jpg" },
  { id: "lux", name: "Lux", nameZh: "绿曜流纹", originalNameZh: "光耀", colors: ["#2C4846", "#113332", "#F8FAFC"] as [string, string, string], category: 'green', style: "深绿色背景，绿白大理石图", scenes: ["环保公益", "医疗健康", "生活方式"], tags: ["自然", "清新", "科技"], previewImage: "/theme-previews/lux.jpg", isRecommended: true },
  { id: "sage", name: "Sage", nameZh: "鼠尾青岚", originalNameZh: "鼠尾草", colors: ["#D1D8D6", "#374B48", "#1F2937"] as [string, string, string], category: 'green', style: "白底，灰绿色山雾图", scenes: ["环保公益", "医疗健康", "生活方式"], tags: ["自然", "清新", "科技"], previewImage: "/theme-previews/sage.jpg" },
  { id: "verdigris", name: "Verdigris", nameZh: "铜绿波层", originalNameZh: "铜绿", colors: ["#1B4146", "#4DAB8D", "#F8FAFC"] as [string, string, string], category: 'green', style: "深青绿背景，绿蓝波形图", scenes: ["环保公益", "医疗健康", "生活方式"], tags: ["自然", "清新", "科技"], previewImage: "/theme-previews/verdigris.jpg" },
  { id: "fluo", name: "Fluo", nameZh: "荧光青柠", originalNameZh: "荧光", colors: ["#555F29", "#C4DF53", "#F8FAFC"] as [string, string, string], category: 'green', style: "黑底，荧光绿图像", scenes: ["环保公益", "医疗健康", "生活方式"], tags: ["自然", "清新", "科技"], previewImage: "/theme-previews/fluo.jpg" },
  { id: "vanilla", name: "Vanilla", nameZh: "香草青纹", originalNameZh: "香草", colors: ["#BFCBBA", "#2B584E", "#1F2937"] as [string, string, string], category: 'green', style: "奶油底，绿色纹理图", scenes: ["环保公益", "医疗健康", "生活方式"], tags: ["自然", "清新", "科技"], previewImage: "/theme-previews/vanilla.jpg" },
  { id: "alien", name: "Alien", nameZh: "异星荧潮", originalNameZh: "异星", colors: ["#293B24", "#648B2D", "#F8FAFC"] as [string, string, string], category: 'green', style: "深底，荧光绿流体图", scenes: ["环保公益", "医疗健康", "生活方式"], tags: ["自然", "清新", "科技"], previewImage: "/theme-previews/alien.jpg" },
  { id: "borealis", name: "Borealis", nameZh: "北极极光", originalNameZh: "北极光", colors: ["#0F3044", "#28828C", "#F8FAFC"] as [string, string, string], category: 'green', style: "深蓝背景，青蓝极光图", scenes: ["环保公益", "医疗健康", "生活方式"], tags: ["自然", "清新", "科技"], previewImage: "/theme-previews/borealis.jpg" },
  { id: "spectrum", name: "Spectrum", nameZh: "光谱霓彩", originalNameZh: "光谱", colors: ["#CED0E4", "#7E8BC0", "#1F2937"] as [string, string, string], category: 'purple', style: "白底，紫蓝光谱图", scenes: ["创意方案", "产品发布", "科技AI"], tags: ["创意", "未来", "年轻"], previewImage: "/theme-previews/spectrum.jpg" },
  { id: "prism", name: "Prism", nameZh: "棱镜柔辉", originalNameZh: "棱镜", colors: ["#DAD5F2", "#9C8BE2", "#1F2937"] as [string, string, string], category: 'purple', style: "白底，淡紫蓝渐变", scenes: ["创意方案", "产品发布", "科技AI"], tags: ["创意", "未来", "年轻"], previewImage: "/theme-previews/prism.jpg" },
  { id: "gamma", name: "Gamma", nameZh: "伽马流霞", originalNameZh: "伽马", colors: ["#EBBDCB", "#B73E8E", "#1F2937"] as [string, string, string], category: 'purple', style: "白底，紫橙渐变图", scenes: ["创意方案", "产品发布", "科技AI"], tags: ["创意", "未来", "年轻"], previewImage: "/theme-previews/gamma.jpg" },
  { id: "lavender", name: "Lavender", nameZh: "薰衣紫雾", originalNameZh: "薰衣草", colors: ["#DCDAFD", "#9794FD", "#1F2937"] as [string, string, string], category: 'purple', style: "白底，淡紫图像", scenes: ["创意方案", "产品发布", "科技AI"], tags: ["创意", "未来", "年轻"], previewImage: "/theme-previews/lavender.jpg" },
  { id: "atmosphere", name: "Atmosphere", nameZh: "氛围柔彩", originalNameZh: "氛围", colors: ["#F5D6D5", "#DB8AAE", "#1F2937"] as [string, string, string], category: 'purple', style: "白底，粉紫弧形图", scenes: ["创意方案", "产品发布", "科技AI"], tags: ["创意", "未来", "年轻"], previewImage: "/theme-previews/atmosphere.jpg", isRecommended: true },
  { id: "aurora", name: "Aurora", nameZh: "极光紫幕", originalNameZh: "极光", colors: ["#331B53", "#8D56B1", "#F8FAFC"] as [string, string, string], category: 'purple', style: "深紫背景，极光渐变", scenes: ["创意方案", "产品发布", "科技AI"], tags: ["创意", "未来", "年轻"], previewImage: "/theme-previews/aurora.jpg" },
  { id: "velvet-tides", name: "VelvetTides", nameZh: "绒潮紫夜", originalNameZh: "天鹅绒潮汐", colors: ["#0E0C1B", "#201C38", "#F8FAFC"] as [string, string, string], category: 'purple', style: "深紫背景，蓝紫流体图", scenes: ["创意方案", "产品发布", "科技AI"], tags: ["创意", "未来", "年轻"], previewImage: "/theme-previews/velvet-tides.jpg" },
  { id: "daydream", name: "Daydream", nameZh: "白日绮梦", originalNameZh: "白日梦", colors: ["#C2BADB", "#6A4F99", "#F8FAFC"] as [string, string, string], category: 'purple', style: "粉蓝云雾图，整体偏蓝", scenes: ["创意方案", "产品发布", "科技AI"], tags: ["创意", "未来", "年轻"], previewImage: "/theme-previews/daydream.jpg" },
  { id: "twilight", name: "Twilight", nameZh: "暮光云霞", originalNameZh: "暮光", colors: ["#E9E4E6", "#BFB5C3", "#1F2937"] as [string, string, string], category: 'pink', style: "白底，粉色云霞图", scenes: ["营销提案", "美妆时尚", "生活方式"], tags: ["活力", "温暖", "创意"], previewImage: "/theme-previews/twilight.jpg", isRecommended: true },
  { id: "coral-glow", name: "CoralGlow", nameZh: "珊瑚粉潮", originalNameZh: "珊瑚微光", colors: ["#F3DCDF", "#DB96A2", "#1F2937"] as [string, string, string], category: 'pink', style: "白底，珊瑚粉水波图", scenes: ["营销提案", "美妆时尚", "生活方式"], tags: ["活力", "温暖", "创意"], previewImage: "/theme-previews/coral-glow.jpg" },
  { id: "peach", name: "Peach", nameZh: "蜜桃柔晕", originalNameZh: "蜜桃", colors: ["#FCE8DF", "#F3B097", "#1F2937"] as [string, string, string], category: 'pink', style: "白底，桃粉柔波图", scenes: ["营销提案", "美妆时尚", "生活方式"], tags: ["活力", "温暖", "创意"], previewImage: "/theme-previews/peach.jpg" },
  { id: "atacama", name: "Atacama", nameZh: "阿塔绯夜", originalNameZh: "阿塔卡马", colors: ["#3E182E", "#AB0260", "#F8FAFC"] as [string, string, string], category: 'pink', style: "深底，紫红流光图", scenes: ["营销提案", "美妆时尚", "生活方式"], tags: ["活力", "温暖", "创意"], previewImage: "/theme-previews/atacama.jpg" },
  { id: "malibu", name: "Malibu", nameZh: "马里粉岸", originalNameZh: "马里布", colors: ["#F9BEE6", "#EE69BC", "#1F2937"] as [string, string, string], category: 'pink', style: "白底，粉色流体图", scenes: ["营销提案", "美妆时尚", "生活方式"], tags: ["活力", "温暖", "创意"], previewImage: "/theme-previews/malibu.jpg" },
  { id: "rush", name: "Rush", nameZh: "疾驰赤潮", originalNameZh: "疾驰红", colors: ["#E1B3B5", "#D05055", "#F8FAFC"] as [string, string, string], category: 'pink', style: "白底，红色流体图", scenes: ["营销提案", "美妆时尚", "生活方式"], tags: ["活力", "温暖", "创意"], previewImage: "/theme-previews/rush.jpg" },
  { id: "leimoon", name: "Leimoon", nameZh: "柠月暖杏", originalNameZh: "柠月", colors: ["#FDEFEC", "#F5BEAF", "#1F2937"] as [string, string, string], category: 'pink', style: "白底，杏橙图案", scenes: ["营销提案", "美妆时尚", "生活方式"], tags: ["活力", "温暖", "创意"], previewImage: "/theme-previews/leimoon.jpg" },
  { id: "canaveral", name: "Canaveral", nameZh: "卡纳暖焰", originalNameZh: "卡纳维拉尔", colors: ["#623433", "#E06459", "#F8FAFC"] as [string, string, string], category: 'pink', style: "深底，橙红渐变图", scenes: ["营销提案", "美妆时尚", "生活方式"], tags: ["活力", "温暖", "创意"], previewImage: "/theme-previews/canaveral.jpg" },
  { id: "pearl", name: "Pearl", nameZh: "珍珠柔白", originalNameZh: "珍珠白", colors: ["#E0E0E2", "#A4A3A7", "#1F2937"] as [string, string, string], category: 'neutral', style: "白底，灰白浮雕图", scenes: ["通用", "研究报告", "商务汇报"], tags: ["简约", "专业", "克制"], previewImage: "/theme-previews/pearl.jpg", isRecommended: true },
  { id: "vortex", name: "Vortex", nameZh: "漩涡流烟", originalNameZh: "漩涡黑", colors: ["#161616", "#131314", "#F8FAFC"] as [string, string, string], category: 'neutral', style: "黑底，灰黑烟雾图", scenes: ["通用", "研究报告", "商务汇报"], tags: ["简约", "专业", "克制"], previewImage: "/theme-previews/vortex.jpg" },
  { id: "mercury", name: "Mercury", nameZh: "水银流光", originalNameZh: "水银灰", colors: ["#E1E4EA", "#8A9BAF", "#1F2937"] as [string, string, string], category: 'neutral', style: "白底，银灰流体图", scenes: ["通用", "研究报告", "商务汇报"], tags: ["简约", "专业", "克制"], previewImage: "/theme-previews/mercury.jpg" },
  { id: "oatmeal", name: "Oatmeal", nameZh: "燕麦素白", originalNameZh: "燕麦", colors: ["#E6E6E2", "#ACADA2", "#1F2937"] as [string, string, string], category: 'neutral', style: "白底，浅灰折面图", scenes: ["通用", "研究报告", "商务汇报"], tags: ["简约", "专业", "克制"], previewImage: "/theme-previews/oatmeal.jpg" },
  { id: "chimney-dust", name: "ChimneyDust", nameZh: "烟尘暗灰", originalNameZh: "烟囱尘灰", colors: ["#414145", "#46484D", "#F8FAFC"] as [string, string, string], category: 'neutral', style: "深灰底，灰色立体图", scenes: ["通用", "研究报告", "商务汇报"], tags: ["简约", "专业", "克制"], previewImage: "/theme-previews/chimney-dust.jpg" },
  { id: "gleam", name: "Gleam", nameZh: "微光浅影", originalNameZh: "微光", colors: ["#D9DADE", "#8A8D96", "#1F2937"] as [string, string, string], category: 'neutral', style: "白底，灰白柔光图", scenes: ["通用", "研究报告", "商务汇报"], tags: ["简约", "专业", "克制"], previewImage: "/theme-previews/gleam.jpg" },
  { id: "marine", name: "Marine", nameZh: "深海远岚", originalNameZh: "海洋深蓝", colors: ["#494F62", "#4A556F", "#F8FAFC"] as [string, string, string], category: 'neutral', style: "深海蓝背景，山海蓝图像", scenes: ["通用", "研究报告", "商务汇报"], tags: ["简约", "专业", "克制"], previewImage: "/theme-previews/marine.jpg" },
  { id: "kraft", name: "Kraft", nameZh: "牛皮素纸", originalNameZh: "牛皮纸", colors: ["#D7D2CB", "#9F9891", "#1F2937"] as [string, string, string], category: 'neutral', style: "米灰纸感纹理", scenes: ["通用", "研究报告", "商务汇报"], tags: ["简约", "专业", "克制"], previewImage: "/theme-previews/kraft.jpg" },
];

export const THEME_DATABASE: ThemeData[] = SEEDS.map((theme) => {
  const meta = CATEGORY_META[theme.category];
  return { ...theme, colorFamily: theme.category, categoryZh: meta.name, emoji: meta.emoji, palette: [theme.colors[1], theme.colors[2], theme.colors[0]] };
});

const UNIQUE_THEME_IDS = new Set<string>();
for (const theme of THEME_DATABASE) {
  if (UNIQUE_THEME_IDS.has(theme.id)) throw new Error(`duplicate theme id in THEME_DATABASE: ${theme.id}`);
  UNIQUE_THEME_IDS.add(theme.id);
}

export const COLOR_CATEGORIES: Array<{ id: ThemeColorFamily; name: string; emoji: string; count: number; colors: string[] }> = CATEGORY_ORDER.map((id) => {
  const meta = CATEGORY_META[id];
  const count = THEME_DATABASE.filter((theme) => theme.category === id).length;
  if (count !== MAX_THEMES_PER_CATEGORY) throw new Error(`category ${id} has ${count} themes (required ${MAX_THEMES_PER_CATEGORY})`);
  return { id, name: meta.name, emoji: meta.emoji, colors: meta.colors, count };
});

export function getThemesByCategory(category: string): ThemeData[] {
  const themes = THEME_DATABASE.filter((theme) => theme.category === category);
  const displayOrder = CATEGORY_THEME_DISPLAY_ORDER[category as ThemeColorFamily];
  if (!displayOrder) return themes;
  const rank = new Map(displayOrder.map((id, index) => [id, index]));
  return themes.sort((a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER));
}

export function getThemeById(id: string): ThemeData | undefined {
  const normalizedId = id.trim().toLowerCase();
  return THEME_DATABASE.find((theme) => theme.id === normalizedId);
}

export const RECOMMENDED_THEME_IDS = ["pearl", "twilight", "lux", "atmosphere", "finesse", "icebreaker", "marine", "gold-leaf"] as const;
export const DEFAULT_THEME_ID = RECOMMENDED_THEME_IDS[0];

export function getRecommendedThemes(): ThemeData[] {
  return RECOMMENDED_THEME_IDS.map((id) => getThemeById(id)).filter((theme): theme is ThemeData => Boolean(theme));
}

export function recommendTheme(scene: string): ThemeData | undefined {
  const sceneThemes = THEME_DATABASE.filter((theme) => theme.scenes.includes(scene));
  return sceneThemes[0] || THEME_DATABASE[0];
}

export const FIXED_CATEGORY_THEME_IDS: Record<ThemeColorFamily, string[]> = CATEGORY_ORDER.reduce((acc, id) => {
  acc[id] = getThemesByCategory(id).map((theme) => theme.id);
  return acc;
}, {} as Record<ThemeColorFamily, string[]>);

export const UNMATCHED_THEMES: Array<{ id: string; nameZh: string; background: string; suggestedFamily: ThemeColorFamily }> = [];

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const value = hex.replace('#', '').slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(value)) return null;
  return { r: Number.parseInt(value.slice(0, 2), 16), g: Number.parseInt(value.slice(2, 4), 16), b: Number.parseInt(value.slice(4, 6), 16) };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn), delta = max - min;
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

export function getThemeCategoryByBackground(background: string): ThemeColorFamily {
  const rgb = hexToRgb(background);
  if (!rgb) return 'neutral';
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const spread = Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b);
  if ((l <= 0.16 && spread <= 28) || spread <= 12 || s <= 0.08) return 'neutral';
  if (h >= 235 && h < 315) return 'purple';
  if (h >= 315 || h < 18) return 'pink';
  if (h >= 18 && h < 75) return 'yellowCream';
  if (h >= 75 && h < 170) return 'green';
  if (h >= 170 && h < 235) return 'blue';
  return 'neutral';
}
