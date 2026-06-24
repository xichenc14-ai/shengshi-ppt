import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('image placeholder regression guard', () => {
  it('does not reintroduce forced image-slot instructions in generation routes', () => {
    const files = [
      'src/app/api/gamma/route.ts',
      'src/app/api/gamma-direct/route.ts',
      'src/lib/build-md-v2.ts',
    ];
    const source = files
      .map((file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8'))
      .join('\n');

    const forbiddenInstructions = [
      '每页使用不同的强调布局',
      '必须执行图片策略并补足可见主图',
      '禁止输出纯文字大白板',
      '内容页每页至少配1张相关图片',
    ];

    for (const instruction of forbiddenInstructions) {
      expect(source).not.toContain(instruction);
    }
  });

  it('preserves themeAccent while forbidding placeholder layouts', () => {
    const routes = [
      'src/app/api/gamma/route.ts',
      'src/app/api/gamma-direct/route.ts',
    ].map((file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8'));

    for (const source of routes) {
      expect(source).not.toContain("source = 'pexels'");
      expect(source).toContain('严格使用 themeAccent');
      expect(source).toContain('禁止使用 Emphasize 大图模板');
    }
  });
});
