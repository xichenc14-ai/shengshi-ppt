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
  console.log('✅ 页面加载成功');

  // 截图
  await page.screenshot({ path: path.join(testDir, 'screenshot-01-home.png') });
  console.log('📸 首页截图已保存');

  // 点击上传按钮（如果有的话）
  const uploadBtn = await page.$('input[type="file"]');
  if (uploadBtn) {
    console.log('📎 找到上传组件');
    
    // 测试上传所有附件
    const files = [
      '1-文本.txt',
      '2-表格.csv',
      '3-文档.md',
      '4-Word文档.docx',
      '5-Excel表格.xlsx',
      '6-PDF文档.pdf',
      '7-PNG图片.png',
      '8-JPG图片.jpg',
      '9-PPT演示.pptx',
    ];

    for (const file of files) {
      const filePath = path.join(testDir, 'test-attachments', file);
      console.log(`\n📤 测试上传: ${file}`);
      
      try {
        await uploadBtn.setInputFiles(filePath);
        await page.waitForTimeout(2000); // 等待解析
        
        // 检查是否有解析结果
        const textareas = await page.$$('textarea');
        if (textareas.length > 0) {
          const value = await textareas[0].inputValue();
          console.log(`   解析结果: ${value.substring(0, 60).replace(/\n/g, ' ')}${value.length > 60 ? '...' : ''}`);
        } else {
          console.log(`   ⚠️ 未找到文本框`);
        }
      } catch (e) {
        console.log(`   ❌ 错误: ${e.message}`);
      }
    }
  } else {
    console.log('⚠️ 未找到上传组件，可能需要先登录或进入特定页面');
    
    // 尝试查找其他可能的元素
    const body = await page.content();
    console.log('页面包含关键词:', body.includes('上传') ? '上传' : '', body.includes('文件') ? '文件' : '');
  }

  await page.screenshot({ path: path.join(testDir, 'screenshot-02-after-upload.png') });
  console.log('📸 测试后截图已保存');

  await browser.close();
  console.log('\n✅ 浏览器测试完成');
}

test().catch(e => {
  console.error('❌ 测试失败:', e.message);
  process.exit(1);
});
