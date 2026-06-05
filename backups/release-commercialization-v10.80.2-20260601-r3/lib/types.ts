// PPT数据模型定义

export interface Presentation {
  id: string;
  title: string;
  theme: string;
  templateId: string;
  slides: Slide[];
  createdAt: string;
}

export interface Slide {
  id: string;
  type: 'title' | 'content' | 'two-column' | 'image' | 'end';
  title: string;
  subtitle?: string;
  content: string[];
  notes?: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    textLight: string;
  };
  font: string;
}

// 预设模板
export const templates: Template[] = [
  {
    id: 'ocean',
    name: '海洋蓝',
    description: '清新专业，适合商务汇报',
    colors: {
      primary: '#1e40af',
      secondary: '#3b82f6',
      accent: '#60a5fa',
      background: '#ffffff',
      text: '#1e293b',
      textLight: '#64748b',
    },
    font: 'system-ui',
  },
  {
    id: 'forest',
    name: '森林绿',
    description: '自然沉稳，适合教育培训',
    colors: {
      primary: '#166534',
      secondary: '#22c55e',
      accent: '#4ade80',
      background: '#ffffff',
      text: '#1e293b',
      textLight: '#64748b',
    },
    font: 'system-ui',
  },
  {
    id: 'sunset',
    name: '日落橙',
    description: '活力热情，适合创意提案',
    colors: {
      primary: '#ea580c',
      secondary: '#f97316',
      accent: '#fb923c',
      background: '#ffffff',
      text: '#1e293b',
      textLight: '#64748b',
    },
    font: 'system-ui',
  },
  {
    id: 'dark',
    name: '暗夜黑',
    description: '高端大气，适合科技展示',
    colors: {
      primary: '#7c3aed',
      secondary: '#8b5cf6',
      accent: '#a78bfa',
      background: '#0f172a',
      text: '#f1f5f9',
      textLight: '#94a3b8',
    },
    font: 'system-ui',
  },
  {
    id: 'rose',
    name: '玫瑰红',
    description: '优雅浪漫，适合品牌宣传',
    colors: {
      primary: '#e11d48',
      secondary: '#f43f5e',
      accent: '#fb7185',
      background: '#ffffff',
      text: '#1e293b',
      textLight: '#64748b',
    },
    font: 'system-ui',
  },
];
