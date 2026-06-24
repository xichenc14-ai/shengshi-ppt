import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('download UI regression guard', () => {
  it('automatically starts download and keeps the manual download button', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/app/page.tsx'), 'utf8');

    expect(source).toContain('void handleExportPPTRef.current()');
    expect(source).toContain("setAutoDownloadMessage('downloading')");
    expect(source).toContain("setAutoDownloadMessage('completed')");
    expect(source).toContain('PPTX 下载完成');
    expect(source).toContain('下载 PPTX');
    expect(source).not.toContain('requiresManualDownloadGesture');
    expect(source).not.toContain('window.location.assign(downloadPath)');
    expect(source).not.toContain('下载请求已提交');
    expect(source).not.toContain('请在下载列表中查看');
    expect(source).not.toContain('iPhone 浏览器需要点击');
  });
});
