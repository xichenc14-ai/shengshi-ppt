import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('download UI regression guard', () => {
  it('keeps all downloads behind explicit format actions', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/app/page.tsx'), 'utf8');

    expect(source).toContain("handleExportFormat(format)");
    expect(source).toContain("['pdf', 'pptx', 'png']");
    expect(source).toContain('点击“下载”才会保存到设备');
    expect(source).not.toContain('void handleExportPPTRef.current()');
    expect(source).not.toContain("setAutoDownloadMessage('downloading')");
    expect(source).not.toContain('window.location.assign(downloadPath)');
  });
});
