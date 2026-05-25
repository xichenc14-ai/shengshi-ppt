import { describe, expect, it } from 'vitest';
import { buildMdV2 } from '@/lib/build-md-v2';

describe('buildMdV2 image hint strategy', () => {
  const slides = [
    { id: '1', title: '封面页', bullets: ['主题导入'] },
    { id: '2', title: '目录页', bullets: ['第一章', '第二章'] },
    { id: '3', title: '内容页', bullets: ['要点A', '要点B'] },
    { id: '4', title: '结尾页', bullets: ['感谢观看'] },
  ];

  it('uses web-first key-page hint when image mode is web', () => {
    const { markdown } = buildMdV2('测试', slides as any, 'web');
    expect(markdown).toContain('本页必须配图，优先使用网图(webFreeToUseCommercially)');
    expect(markdown).not.toContain('本页必须使用主题强调图（Emphasize布局）');
  });

  it('keeps themeAccent key-page hint when image mode is theme', () => {
    const { markdown } = buildMdV2('测试', slides as any, 'theme-img');
    expect(markdown).toContain('本页必须使用主题强调图（Emphasize布局）');
  });
});

