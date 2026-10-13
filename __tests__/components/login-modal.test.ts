import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { createServer, type Server } from 'node:http';
import { chromium, type Browser, type Page, type Route } from 'playwright';

// 真实 React 组件与 AuthProvider 在浏览器内运行；只替换 API 和无关的 Next Link。
let browser: Browser;
let server: Server;
let url: string;
let page: Page;
let calls: Array<Record<string, unknown>>;
let send: (route: Route) => Promise<void>;
let verify: (route: Route) => Promise<void>;
let session: (route: Route) => Promise<void>;
const user = { id: 'user-1', phone: '13800138000', nickname: '测试用户', credits: 40, plan_type: 'free' };
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const codeInput = () => page.getByLabel('6位短信验证码');
const dialog = () => page.getByRole('dialog');
const sendCode = async () => {
  await page.locator('#login-phone-input').fill(user.phone);
  await page.getByRole('button', { name: '获取验证码', exact: true }).click();
};
const enterCode = async () => {
  await codeInput().waitFor();
  await codeInput().fill('123456');
};

beforeAll(async () => {
  const result = await build({
    stdin: {
      contents: `import React from 'react';
        import {createRoot} from 'react-dom/client';
        import LoginModal from './src/components/LoginModal';
        import {AuthProvider,useAuth} from './src/lib/auth-context';
        function Harness(){const a=useAuth(); return <><button onClick={a.openLogin}>打开登录</button><button onClick={a.closeLogin}>外部关闭</button><output>{a.user?.nickname||'未登录'}</output><LoginModal open={a.showLogin} onClose={a.closeLogin}/></>}
        createRoot(document.getElementById('root')).render(<AuthProvider><Harness/></AuthProvider>);`,
      resolveDir: process.cwd(), loader: 'tsx',
    },
    bundle: true, write: false, format: 'iife', platform: 'browser',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'next-link-test', setup(b) {
      b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'test' }));
      b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: `import React from 'react'; export default function Link(props){return React.createElement('a',props)}`, resolveDir: process.cwd() }));
    } }],
  });
  const bundle = result.outputFiles[0].text;
  server = createServer((req, res) => {
    if (req.url === '/app.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle); }
    else { res.setHeader('Content-Type', 'text/html'); res.end('<html><body><div id="root"></div><script src="/app.js"></script></body></html>'); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  url = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
}, 30_000);

afterAll(async () => {
  await browser?.close();
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
});
beforeEach(async () => {
  calls = [];
  send = route => json(route, { success: true });
  verify = route => json(route, { error: '验证码错误或已过期', attemptsLeft: 4 }, 400);
  session = route => json(route, { isLoggedIn: false, user: null });
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route('**/api/**', async route => {
    if (route.request().url().endsWith('/api/session')) return session(route);
    const body = route.request().postDataJSON();
    calls.push(body);
    if (body.action === 'send_code') return send(route);
    return verify(route);
  });
  await page.goto(url);
  await page.getByRole('button', { name: '打开登录' }).click();
});
afterEach(async () => { await page?.close(); });

describe('短信登录浏览器行为', () => {
  it('202 状态未确认仍然显示可输入验证码，并且不自动重发', async () => {
    send = route => json(route, { success: true, deliveryState: 'unknown', retryAfter: 60 }, 202);
    await sendCode();
    await enterCode();
    await page.getByText('验证码错误或已过期', { exact: false }).waitFor();
    expect(await codeInput().inputValue()).toBe('123456');
    expect(await dialog().isVisible()).toBe(true);
    expect(await dialog().getByRole('status').textContent()).toContain('暂未确认');
    expect(calls.filter(c => c.action === 'send_code')).toHaveLength(1);
    expect(calls.filter(c => c.action === 'verify_code')).toHaveLength(1);
  });

  it.each(['network', 'gateway'])('%s 异常保留已收到短信的验证路径', async kind => {
    send = route => kind === 'network' ? route.abort('failed') : route.fulfill({ status: 504, contentType: 'text/html', body: '<h1>timeout</h1>' });
    await sendCode();
    await codeInput().waitFor();
    expect(await dialog().getByRole('status').textContent()).toContain('暂未确认');
    expect(calls).toHaveLength(1);
  });

  it('明确 503 拒绝显示错误，不谎称发送成功', async () => {
    send = route => json(route, { error: '短信发送失败，请稍后重试' }, 503);
    await sendCode();
    await page.getByText('短信发送失败，请稍后重试').waitFor();
    expect(await codeInput().count()).toBe(0);
    expect(await page.getByRole('button', { name: '获取验证码', exact: true }).isEnabled()).toBe(true);
  });

  it('连接失败显示本次未发送，短冷却结束可重试且不会自动重发', async () => {
    await page.clock.install();
    send = route => json(route, { error: '短信服务连接失败，本次短信未发送，请稍后重试', code: 'SMS_PROVIDER_UNREACHABLE', deliveryState: 'not_submitted', retryAfter: 5 }, 503);
    await sendCode();
    await page.getByText('短信服务连接失败，本次短信未发送，请稍后重试').waitFor();
    expect(await codeInput().count()).toBe(0);
    expect(await dialog().isVisible()).toBe(true);
    await page.clock.fastForward(6000);
    expect(await page.getByRole('button', { name: '获取验证码', exact: true }).isEnabled()).toBe(true);
    expect(calls.filter(c => c.action === 'send_code')).toHaveLength(1);
  });

  it('429 有继续输入入口，服务端仍校验验证码', async () => {
    send = route => json(route, { error: '请60秒后再试', retryAfter: 60 }, 429);
    await sendCode();
    await page.getByRole('button', { name: '已收到验证码，继续输入' }).click();
    await enterCode();
    await page.getByText('验证码错误或已过期', { exact: false }).waitFor();
    expect(await dialog().isVisible()).toBe(true);
  });

  it('返回、关闭重开后恢复输入入口和冷却，密码验证码不持久化', async () => {
    await sendCode();
    await codeInput().fill('123');
    await page.getByRole('button', { name: '返回', exact: true }).click();
    await page.getByRole('button', { name: '关闭登录' }).click();
    await page.getByRole('button', { name: '打开登录' }).click();
    await page.getByRole('button', { name: '已收到验证码，继续输入' }).click();
    expect(await codeInput().inputValue()).toBe('');
    expect(await page.getByText(/\d+s 后可重新发送/).isVisible()).toBe(true);
    expect(await page.evaluate(() => ({ ...sessionStorage, ...localStorage }))).toEqual({});
    expect(calls.filter(c => c.action === 'send_code')).toHaveLength(1);
  });

  it('绝对截止时间支持后台恢复后重发，重发 unknown 也可输入', async () => {
    await page.clock.install();
    await sendCode();
    await codeInput().waitFor();
    await page.clock.fastForward(61_000);
    send = route => json(route, { success: true, deliveryState: 'unknown', retryAfter: 60 }, 202);
    await page.getByRole('button', { name: '重新发送验证码', exact: true }).click();
    await dialog().getByRole('status').waitFor();
    expect(await codeInput().isEnabled()).toBe(true);
    expect(calls.filter(c => c.action === 'send_code')).toHaveLength(2);
  });

  it('请求中遮罩及 Escape 不会关闭，显式关闭后的晚到响应不串号', async () => {
    let release!: () => void;
    send = async route => { await new Promise<void>(r => { release = r; }); await json(route, { success: true }); };
    await sendCode();
    await expect.poll(() => calls.length).toBe(1);
    await page.getByTestId('login-backdrop').dispatchEvent('click');
    await page.keyboard.press('Escape');
    expect(await dialog().isVisible()).toBe(true);
    await page.getByRole('button', { name: '关闭登录' }).click();
    await page.getByRole('button', { name: '打开登录' }).click();
    await page.locator('#login-phone-input').fill('13900139000');
    release();
    await page.waitForTimeout(100);
    expect(await page.locator('#login-phone-input').inputValue()).toBe('13900139000');
    expect(await codeInput().count()).toBe(0);
  });

  it('修改号码隔离冷却与旧验证码，返回原号码保留冷却', async () => {
    await sendCode();
    await codeInput().fill('12');
    await page.getByRole('button', { name: '返回', exact: true }).click();
    await page.locator('#login-phone-input').fill('13900139000');
    await expect.poll(() => page.getByRole('button', { name: '获取验证码', exact: true }).isEnabled()).toBe(true);
    expect(await page.getByRole('button', { name: '已收到验证码，继续输入' }).count()).toBe(0);
    await page.locator('#login-phone-input').fill(user.phone);
    await page.getByRole('button', { name: '已收到验证码，继续输入' }).click();
    expect(await codeInput().inputValue()).toBe('');
    expect(await page.getByText(/\d+s 后可重新发送/).isVisible()).toBe(true);
  });

  it('编辑或离开验证码页取消旧的自动提交任务', async () => {
    await page.clock.install();
    await sendCode();
    await codeInput().fill('123456');
    await codeInput().fill('123');
    await page.clock.fastForward(300);
    expect(calls.filter(c => c.action === 'verify_code')).toHaveLength(0);
    await codeInput().fill('123456');
    await page.getByRole('button', { name: '返回', exact: true }).click();
    await page.clock.fastForward(300);
    expect(calls.filter(c => c.action === 'verify_code')).toHaveLength(0);
  });

  it('验证码错误可修改并粘贴重试，成功同步后才关闭', async () => {
    await sendCode();
    await enterCode();
    await page.getByText('验证码错误或已过期', { exact: false }).waitFor();
    expect(await page.getByText('（剩余 4 次）').isVisible()).toBe(true);
    verify = route => { session = r => json(r, { isLoggedIn: true, user }); return json(route, { user, authToken: 'proof' }); };
    await codeInput().evaluate(el => {
      const clipboardData = new DataTransfer(); clipboardData.setData('text', '654321');
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
    });
    await dialog().waitFor({ state: 'hidden' });
    expect(await page.locator('output').textContent()).toBe(user.nickname);
    expect(calls.filter(c => c.action === 'verify_code').map(c => c.code)).toEqual(['123456', '654321']);
  });

  it.each(['NOT_REGISTERED', 'NEED_SET_PASSWORD'])('%s 可进入资料步骤，注册后同步失败只重试同步', async error => {
    verify = route => json(route, { error, nickname: '测试' }, 400);
    await sendCode();
    await enterCode();
    await page.locator('#reg-username-input').fill('测试用户');
    await page.getByPlaceholder('至少8位，字母+数字').fill('Test123456');
    await page.getByPlaceholder('再次输入密码').fill('Test123456');
    verify = route => { session = r => json(r, { error: 'unavailable' }, 503); return json(route, { user, authToken: 'proof' }); };
    await page.getByRole('button', { name: '注册并登录', exact: true }).click();
    await page.getByText('账号已验证，但登录状态同步失败。', { exact: false }).waitFor();
    expect(await dialog().isVisible()).toBe(true);
    session = route => json(route, { isLoggedIn: true, user });
    await page.getByRole('button', { name: '重试登录状态同步', exact: true }).click();
    await dialog().waitFor({ state: 'hidden' });
    expect(calls.filter(c => c.action === 'register')).toHaveLength(1);
    expect(calls.filter(c => c.action === 'send_code')).toHaveLength(1);
  });

  it('发送请求无响应超时后仍可输入，不会自动重发', async () => {
    await page.clock.install();
    let release!: () => void;
    send = async route => { await new Promise<void>(r => { release = r; }); await json(route, { success: true }); };
    await sendCode();
    await expect.poll(() => calls.length).toBe(1);
    await page.clock.fastForward(36_000);
    await codeInput().waitFor();
    expect(await dialog().getByRole('status').textContent()).toContain('暂未确认');
    expect(calls).toHaveLength(1);
    release();
  });

  it('登录状态同步超时可恢复，关闭后晚到的回读不会关闭新流程', async () => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.clock.install();
    let release!: () => void;
    verify = route => {
      session = async r => { await new Promise<void>(resolve => { release = resolve; }); await json(r, { isLoggedIn: true, user }); };
      return json(route, { user, authToken: 'proof' });
    };
    await sendCode();
    await codeInput().fill('123456');
    await page.clock.fastForward(300);
    await expect.poll(() => Boolean(release)).toBe(true);
    await page.clock.fastForward(16_000);
    await page.getByText('账号已验证，但登录状态同步失败。', { exact: false }).waitFor();
    release();
    let releaseRetry!: () => void;
    session = async r => { await new Promise<void>(resolve => { releaseRetry = resolve; }); await json(r, { isLoggedIn: true, user }); };
    await page.getByRole('button', { name: '重试登录状态同步', exact: true }).click();
    await expect.poll(() => Boolean(releaseRetry)).toBe(true);
    await page.getByRole('button', { name: '关闭登录' }).click();
    await page.getByRole('button', { name: '打开登录' }).click();
    await page.getByRole('button', { name: '返回', exact: true }).click();
    await page.locator('#login-phone-input').fill('13900139000');
    releaseRetry();
    await page.waitForTimeout(100);
    expect(await dialog().isVisible()).toBe(true);
    expect(await page.locator('#login-phone-input').inputValue()).toBe('13900139000');
    expect(await page.locator('output').textContent()).toBe('未登录');
  });

  it('密码错误保留页面及输入，可重试登录', async () => {
    await page.getByRole('button', { name: '🔑 密码登录', exact: true }).click();
    await page.getByPlaceholder('请输入手机号').fill(user.phone);
    await page.getByPlaceholder('请输入密码').fill('Test123456');
    verify = route => json(route, { error: '密码错误' }, 401);
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await page.getByText('密码错误', { exact: false }).waitFor();
    expect(await page.getByPlaceholder('请输入密码').inputValue()).toBe('Test123456');
    verify = route => { session = r => json(r, { isLoggedIn: true, user }); return json(route, { user }); };
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await dialog().waitFor({ state: 'hidden' });
  });
});
