import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:3108';
const evidenceDir = process.env.EVIDENCE_DIR || 'docs/releases/sms-login-20261008-evidence';
await mkdir(evidenceDir, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [320, 390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 850 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let loggedIn = false;
    const user = { id: 'test-user', phone: '13800138000', nickname: '验收用户', credits: 40, plan_type: 'free' };
    // 所有接口均拦截，绝不触发真实短信或外部数据库写入。
    await page.route('**/api/**', async route => {
      const request = route.request();
      let body = { isLoggedIn: loggedIn, user: loggedIn ? user : null };
      let status = 200;
      if (request.url().endsWith('/api/user') && request.method() === 'POST') {
        const payload = request.postDataJSON();
        if (payload.action === 'send_code') {
          body = { success: true, deliveryState: 'unknown', retryAfter: 60 };
          status = 202;
        } else if (payload.action === 'verify_code' && payload.code === '123456') {
          loggedIn = true;
          body = { user, authToken: 'test-proof' };
        } else {
          body = { error: '验证码错误或已过期', attemptsLeft: 4 };
          status = 400;
        }
      }
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.goto(base);
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await page.locator('#login-phone-input').fill(user.phone);
    await page.getByRole('button', { name: '获取验证码', exact: true }).click();
    const input = page.getByLabel('6位短信验证码');
    await input.waitFor();
    await page.waitForTimeout(300); // 等待弹窗入场动画结束后测量布局。
    const layout = await page.getByRole('dialog').evaluate(el => ({ width: el.clientWidth, scrollWidth: el.scrollWidth }));
    assert.ok(layout.scrollWidth <= layout.width, `验证码弹窗在 ${width}px 发生横向溢出`);
    await page.screenshot({ path: `${evidenceDir}/unknown-${width}.png` });
    await input.pressSequentially('123456');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.deepEqual(errors, []);
    results.push({ width, layout, result: '202 可输入；键盘输入后登录成功；无浏览器异常', realSMS: false });
    await page.close();
  }
  await writeFile(`${evidenceDir}/results.json`, JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
