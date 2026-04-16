import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = __dirname;

async function test() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🌐 打开省心PPT...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  console.log('✅ 页面加载成功\n');

  // 文件列表
  const testFiles = [
    { name: '1-文本.txt', expect: 'txt解析' },
    { name: '2-表格.csv', expect: 'csv解析' },
    { name: '3-文档.md', expect: 'md解析' },
    { name: '4-Word文档.docx', expect: 'docx解析' },
    { name: '5-Excel表格.xlsx', expect: 'xlsx解析' },
    { name: '6-PDF文档.pdf', expect: 'pdf解析' },
    { name: '9-PPT演示.pptx', expect: 'pptx解析' },
  ];

  // 找上传组件
  const fileInput = await page.$('input[type="file"]');
  if (!fileInput) {
    console.log('❌ 未找到上传组件');
    await browser.close();
    return;
  }

  console.log('📎 找到上传组件\n');
  console.log('=' .repeat(60));

  for (const { name, expect } of testFiles) {
    const filePath = path.join(testDir, 'test-attachments', name);
    
    // 捕获API响应
    let apiResult = null;
    page.on('response', async response => {
      if (response.url().includes('/api/parse-file') && response.status() === 200) {
        try {
          apiResult = await response.json();
        } catch {}
      }
    });

    console.log(`\n📤 上传: ${name}`);
    await fileInput.setInputFiles(filePath);
    await page.waitForTimeout(4000); // 等待解析

    if (apiResult) {
      const text = apiResult.text || '';
      const hasContent = text.length > 10 && !text.includes('[文件:') && !text.includes('解析失败');
      const status = hasContent ? '✅' : '⚠️';
      console.log(`   ${status} API返回: ${text.substring(0, 80).replace(/\n/g, ' ')}${text.length > 80 ? '...' : ''}`);
      console.log(`   字符数: ${text.length}`);
    } else {
      console.log(`   ❌ 未捕获API响应`);
    }
  }

  console.log('\n' + '=' .repeat(60));
  console.log('📸 截图已保存');

  await page.screenshot({ path: path.join(testDir, 'screenshot-final.png'), fullPage: true });

  await browser.close();
  console.log('\n✅ 全部测试完成');
}

test().catch(e => {
  console.error('❌ 测试失败:', e.message);
  process.exit(1);
});
