import { describe, expect, it } from 'vitest';
import { buildAdditionalInstructions, buildMdV2 } from '@/lib/build-md-v2';

describe('buildMdV2 image hint strategy', () => {
  const slides = [
    { id: '1', title: '封面页', bullets: ['主题导入'] },
    { id: '2', title: '目录页', bullets: ['第一章', '第二章'] },
    { id: '3', title: '内容页', bullets: ['要点A', '要点B'] },
    { id: '4', title: '结尾页', bullets: ['感谢观看'] },
  ];

  it('uses pexels-first key-page hint when image mode is web', () => {
    const { markdown } = buildMdV2('测试', slides as any, 'web');
    expect(markdown).toContain('只有在 Pexels 图片(pexels)已成功加载且可见时才放图片');
    expect(markdown).toContain('必须删除图片元素和图片容器');
    expect(markdown).not.toContain('本页必须配图');
  });

  it('keeps themeAccent key-page hint when image mode is theme', () => {
    const { markdown } = buildMdV2('测试', slides as any, 'theme-img');
    const instructions = buildAdditionalInstructions('professional', 'biz', 'theme-img');
    expect(markdown).toContain('只有在主题强调图已成功加载且可见时才放图片');
    expect(markdown).toContain('必须删除图片元素和图片容器');
    expect(instructions).toContain('内容页默认使用无图、图标或色块布局，不创建固定图片槽');
    expect(instructions).not.toContain('每页使用不同的强调布局');
    expect(instructions).not.toContain('禁止输出纯文字大白板');
    expect(markdown).not.toContain('改用网图');
  });
});
