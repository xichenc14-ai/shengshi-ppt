import { describe, expect, it } from 'vitest';
import { generateMinimalOutline } from '@/lib/adapters/ppt-param-adapter';

describe('generateMinimalOutline', () => {
  it('builds topic-aware fallback slides instead of placeholder defaults', () => {
    const result = generateMinimalOutline('AI 产品发布会：智能客服升级方案', 6);

    expect(result.title).toContain('AI 产品发布会');
    expect(result.slides).toHaveLength(6);
    expect(result.slides[0].title).toContain('AI 产品发布会');
    expect(result.slides[1].title).not.toBe('核心要点 1');

    const allBullets = result.slides.flatMap((slide) => slide.bullets);
    expect(allBullets.join(' ')).not.toContain('要点1');
    expect(allBullets.join(' ')).toContain('核心点');
  });
});
