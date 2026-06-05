import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const RESUME_KEY = 'sx_generation_resume_v1';

const mockUser = {
  id: 'u_e2e_gamma_resume',
  phone: '13800000001',
  nickname: 'E2E',
  credits: 999,
  plan_type: 'supreme',
};

const outlineData = {
  title: 'AI企业级自动化转型路线图',
  slides: [
    { id: 's1', title: '封面', content: ['AI企业级自动化转型路线图'] },
    { id: 's2', title: '现状挑战', content: ['成本压力', '效率瓶颈', '质量波动'] },
    { id: 's3', title: '实施策略', content: ['路线分期', '技术选型', '治理闭环'] },
  ],
  themeId: 'consultant',
  tone: 'professional',
  imageMode: 'themeAccent',
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

  let gammaStatusCalls = 0;
  let gammaPostCalls = 0;

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
    const events = [
      { type: 'stage', stage: 'analyzing', message: '正在识别用户需求与素材结构...' },
      { type: 'slides', current: 3, total: 3, slides: outlineData.slides },
      { type: 'complete', data: outlineData },
    ];
    await route.fulfill({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      body: streamBodyFromEvents(events),
    });
  });

  await context.route('**/api/user', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ balance: 900 }),
    });
  });

  await context.route('**/api/gamma*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === 'POST') {
      gammaPostCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ generationId: 'g_resume_1', status: 'processing' }),
      });
      return;
    }
    if (req.method() === 'GET' && url.searchParams.get('id')) {
      gammaStatusCalls += 1;
      if (gammaStatusCalls < 3) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'running' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'completed',
          exportUrl: 'https://example.com/mock.pptx',
          gammaUrl: 'https://example.com/mock',
        }),
      });
      return;
    }
    await route.fallback();
  });

  await context.route('**/api/history', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
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

  const startButton = page.getByRole('button', { name: /开始生成 PPT/ });
  await expectEnabled(startButton, 10000, page);
  await startButton.click();

  await page.getByRole('heading', { name: 'AI企业级自动化转型路线图' }).waitFor({ timeout: 15000 });
  const confirmBtn = page.getByRole('button', { name: /下一步：生成PPT|确认生成 PPT|确认并生成PPT/ });
  await confirmBtn.click();

  await page.waitForFunction((k) => {
    const raw = localStorage.getItem(k);
    if (!raw) return false;
    try {
      return JSON.parse(raw)?.stage === 'gamma';
    } catch {
      return false;
    }
  }, RESUME_KEY, { timeout: 8000 });

  await page.waitForTimeout(500);
  await page.reload({ waitUntil: 'domcontentloaded' });

  try {
    await page.getByRole('button', { name: '下载 PPTX' }).waitFor({ timeout: 25000 });
  } catch (err) {
    const resumeRaw = await page.evaluate((k) => localStorage.getItem(k), RESUME_KEY);
    const bodyText = await page.locator('body').innerText().catch(() => '');
    await page.screenshot({ path: 'tmp/e2e-gamma-resume-failed.png', fullPage: true });
    console.error(`debug: gammaPostCalls=${gammaPostCalls}`);
    console.error(`debug: gammaStatusCalls=${gammaStatusCalls}`);
    console.error(`debug: resumeRaw=${resumeRaw}`);
    console.error(`debug: body=${bodyText.slice(0, 1800)}`);
    throw err;
  }

  const resumeStateAfter = await page.evaluate((k) => localStorage.getItem(k), RESUME_KEY);
  assert.equal(resumeStateAfter, null, 'resume state should be cleared after gamma restore');
  assert.equal(gammaPostCalls, 1, `expected gamma POST once, got ${gammaPostCalls}`);
  assert.ok(gammaStatusCalls >= 3, `expected gamma status polls >= 3, got ${gammaStatusCalls}`);

  await page.screenshot({ path: 'tmp/e2e-gamma-resume.png', fullPage: true });
  await browser.close();

  console.log('E2E gamma resume PASS');
  console.log(`Gamma POST calls: ${gammaPostCalls}`);
  console.log(`Gamma status calls: ${gammaStatusCalls}`);
  console.log('Screenshot: tmp/e2e-gamma-resume.png');
}

async function expectEnabled(locator, timeoutMs, page) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const disabled = await locator.isDisabled().catch(() => true);
    if (!disabled) return;
    await page.waitForTimeout(100);
  }
  throw new Error('button did not become enabled in time');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
