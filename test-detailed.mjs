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

  // 截图首页
  await page.screenshot({ path: path.join(testDir, 'screenshot-01-home.png'), fullPage: true });
  console.log('📸 首页截图已保存\n');

  // 查找所有 input[type="file"]
  const fileInputs = await page.$$('input[type="file"]');
  console.log(`📎 找到 ${fileInputs.length} 个文件上传组件\n`);

  // 上传并测试第一个文件
  const testFile = path.join(testDir, 'test-attachments', '1-文本.txt');
  console.log(`📤 上传测试文件: 1-文本.txt`);
  
  // 设置文件到第一个 input
  await fileInputs[0].setInputFiles(testFile);
  await page.waitForTimeout(3000); // 等待解析完成

  // 截图上传后
  await page.screenshot({ path: path.join(testDir, 'screenshot-02-after-upload.png'), fullPage: true });

  // 检查页面内容
  const bodyText = await page.textContent('body');
  console.log('页面文本内容（前500字符）:', bodyText.substring(0, 500).replace(/\s+/g, ' '));

  // 查找所有 textarea
  const textareas = await page.$$('textarea');
  console.log(`\n找到 ${textareas.length} 个 textarea`);

  for (let i = 0; i < textareas.length; i++) {
    const value = await textareas[i].inputValue();
    const placeholder = await textareas[i].getAttribute('placeholder');
    console.log(`\ntextarea[${i}]:`);
    console.log(`  placeholder: ${placeholder || '(无)'}`);
    console.log(`  value长度: ${value.length}`);
    console.log(`  value内容: ${value.substring(0, 100)}${value.length > 100 ? '...' : ''}`);
  }

  // 查找可能显示解析结果的元素
  const resultElements = await page.$$('[class*="result"], [class*="parse"], [class*="content"]');
  console.log(`\n找到 ${resultElements.length} 个可能的结果元素`);

  // 检查网络请求
  console.log('\n📡 监听网络请求...');
  let parseRequest = null;
  page.on('response', async response => {
    if (response.url().includes('/api/parse-file')) {
      parseRequest = await response.json().catch(() => null);
      console.log('解析API返回:', parseRequest);
    }
  });

  // 再次上传触发API
  console.log('\n📤 再次上传触发API...');
  await fileInputs[0].setInputFiles(path.join(testDir, 'test-attachments', '4-Word文档.docx'));
  await page.waitForTimeout(5000);

  if (parseRequest) {
    console.log('\n✅ API返回结果:', parseRequest);
  } else {
    console.log('\n⚠️ 未捕获到API响应');
  }

  await browser.close();
  console.log('\n✅ 测试完成');
}

test().catch(e => {
  console.error('❌ 测试失败:', e.message);
  console.error(e.stack);
  process.exit(1);
});
