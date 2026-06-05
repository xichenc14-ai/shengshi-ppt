import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const RESUME_KEY = 'sx_generation_resume_v1';

const mockUser = {
  id: 'u_e2e_resume',
  phone: '13800000000',
  nickname: 'E2E',
  credits: 999,
  plan_type: 'supreme',
};

const outlineData = {
  title: 'AI企业级自动化转型路线图',
  slides: [
    { id: 's1', title: '封面', content: ['AI企业级自动化转型路线图'] },
    { id: 's2', title: '现状与挑战', content: ['效率瓶颈', '协同成本', '风险暴露'] },
    { id: 's3', title: '实施路径', content: ['阶段目标', '技术架构', '治理机制'] },
  ],
  themeId: 'consultant',
  tone: 'professional',
  imageMode: 'themeAccent',
  meta: { preprocess: { truncated: false } },
};

function streamBodyFromEvents(events) {
  return `${events.map((evt) => JSON.stringify(evt)).join('\n')}\n`;
}

async function run() {
  mkdirSync('tmp', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('dialog', async (dialog) => {
    if (dialog.type() === 'beforeunload') {
      await dialog.accept();
      return;
    }
    await dialog.dismiss();
  });

  let streamCalls = 0;

  await context.route('**/api/session', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ isLoggedIn: true, user: mockUser }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, user: mockUser }),
    });
  });

  await context.route('**/api/outline/stream', async (route) => {
    streamCalls += 1;

    if (streamCalls === 1) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        await route.abort('failed');
      } catch {
        // Request can be canceled by reload, which is expected.
      }
      return;
    }

    const events = [
      { type: 'stage', stage: 'analyzing', message: '正在识别用户需求与素材结构...' },
      { type: 'stage', stage: 'planning', message: '正在规划故事线与章节结构...' },
      { type: 'slides', current: 1, total: 3, slides: [outlineData.slides[0]] },
      { type: 'slides', current: 3, total: 3, slides: outlineData.slides },
      { type: 'complete', data: outlineData },
    ];

    await route.fulfill({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      body: streamBodyFromEvents(events),
    });
  });

  await page.addInitScript(
    ({ user }) => {
      localStorage.setItem('sx_user', JSON.stringify(user));
    },
    { user: mockUser }
  );

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);

  const topicInput = page.getByPlaceholder('输入PPT主题，如：2024年度工作汇报、咖啡品牌推广方案');
  await topicInput.click();
  await page.keyboard.type('请生成一份AI企业级自动化转型路线图汇报。', { delay: 20 });
  const topicValue = await topicInput.inputValue();
  assert.ok(topicValue.includes('AI企业级自动化转型路线图'), `topic input not filled: ${topicValue}`);

  const startButton = page.getByRole('button', { name: /开始生成 PPT/ });
  await expectEnabled(startButton, 12000, page);
  await startButton.click();

  await page.waitForFunction((k) => !!localStorage.getItem(k), RESUME_KEY, { timeout: 8000 });
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: 'domcontentloaded' });

  await page.getByText('检测到未完成大纲任务，正在自动恢复...').waitFor({ timeout: 4000 }).catch(() => {});
  try {
    await page.getByRole('heading', { name: 'AI企业级自动化转型路线图' }).waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: /下一步：生成PPT|确认生成 PPT|确认并生成PPT/ }).waitFor({ timeout: 15000 });
  } catch (err) {
    const resumeRaw = await page.evaluate((k) => localStorage.getItem(k), RESUME_KEY);
    const bodyText = await page.locator('body').innerText().catch(() => '');
    await page.screenshot({ path: 'tmp/e2e-outline-resume-failed.png', fullPage: true });
    console.error(`debug: streamCalls=${streamCalls}`);
    console.error(`debug: resumeRaw=${resumeRaw}`);
    console.error(`debug: body=${bodyText.slice(0, 1200)}`);
    throw err;
  }

  const resumeStateAfter = await page.evaluate((k) => localStorage.getItem(k), RESUME_KEY);
  assert.equal(resumeStateAfter, null, 'resume state should be cleared after successful restore');
  assert.ok(streamCalls >= 2, `expected streamCalls >= 2, got ${streamCalls}`);

  await page.screenshot({ path: 'tmp/e2e-outline-resume.png', fullPage: true });
  await browser.close();

  console.log('E2E outline resume PASS');
  console.log(`Stream calls: ${streamCalls}`);
  console.log('Screenshot: tmp/e2e-outline-resume.png');
}

async function expectEnabled(locator, timeoutMs, page) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const disabled = await locator.isDisabled().catch(() => true);
    if (!disabled) return;
    await page.waitForTimeout(100);
  }
  await page.screenshot({ path: 'tmp/e2e-outline-resume-disabled.png', fullPage: true });
  const currentValue = await page.getByPlaceholder('输入PPT主题，如：2024年度工作汇报、咖啡品牌推广方案').inputValue().catch(() => '');
  console.error(`debug: topic="${currentValue}"`);
  throw new Error('button did not become enabled in time');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
