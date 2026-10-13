import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { mkdirSync, writeFileSync } from 'node:fs';
import { POST as gamma } from '@/app/api/gamma/route';
import { POST as direct } from '@/app/api/gamma-direct/route';
import { checkPermission } from '@/lib/membership';
import { estimateGenerationCredits } from '@/lib/generation-credits';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), failure: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSession: vi.fn(async () => ({ isLoggedIn: true, user: { id: 'synthetic-gamma-qa', credits: 999, plan_type: 'pro' } })) }));
vi.mock('@/lib/gamma-key-pool', () => ({ selectBestKey: vi.fn(() => ({ key: 'synthetic', label: 'QA', remaining: 999 })), updateKeyBalance: vi.fn(), recordKeyFailure: mocks.failure, getAllKeys: vi.fn(() => []) }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn(() => ({ allowed: true })), getRateLimitConfig: vi.fn(() => ({})), getClientIP: vi.fn(() => 'test'), isIPBlocked: vi.fn(() => false) }));

const request = (body: object) => new Request('http://localhost/api/gamma', { method: 'POST', body: JSON.stringify(body) }) as NextRequest;
const payload = () => JSON.parse(mocks.fetch.mock.calls[0][1].body);
beforeEach(() => {
  vi.stubGlobal('fetch', mocks.fetch);
  mocks.fetch.mockReset().mockResolvedValue({ ok: true, json: async () => ({ generationId: 'synthetic' }) });
  mocks.failure.mockClear();
});

describe('Gamma 400 reproduction and regression', () => {
  for (const [name, post, options] of [
    ['smart', gamma, { auto: true }],
    ['professional', gamma, { auto: false }],
    ['direct-api', direct, {}],
  ] as const) {
    it(`${name}: captures the production request for synthetic acceptance`, async () => {
      const res = await post(request({ inputText: '# Gamma接口验收（合成样本）\n\n- 检查PPT制作请求\n- 内容无需扩写', numCards: 1, imageSource: 'noImages', imageMode: 'noImages', textMode: 'preserve', strictPreserve: true, themeId: 'consultant', ...options }));
      expect(res.status).toBe(200);
      if (process.env.GAMMA_CAPTURE_DIR) {
        mkdirSync(process.env.GAMMA_CAPTURE_DIR, { recursive: true });
        writeFileSync(`${process.env.GAMMA_CAPTURE_DIR}/${name}.json`, JSON.stringify(payload(), null, 2));
      }
      console.info('QA payload summary', { mode: name, instructions: payload().additionalInstructions.length, source: payload().imageOptions.source });
    });
    it.each(['imagen-3-flash', 'imagen-3-pro'])(`${name}: repairs cached retired model %s`, async model => {
      const res = await post(request({ inputText: '# 合成AI参数验收', numCards: 1, imageSource: 'aiGenerated', imageMode: 'aiGenerated', imageOptions: { source: 'aiGenerated', model }, ...options }));
      expect(res.status).toBe(200);
      expect(payload().imageOptions.model).toBe(model === 'imagen-3-pro' ? 'flux-1-pro' : 'flux-kontext-fast');
      if (process.env.GAMMA_CAPTURE_DIR && name === 'smart') {
        writeFileSync(`${process.env.GAMMA_CAPTURE_DIR}/${model === 'imagen-3-pro' ? 'premium-ai' : 'standard-ai'}.json`, JSON.stringify(payload(), null, 2));
      }
    });
    it(`${name}: keeps non-AI selections and removes cached model fields`, async () => {
      expect((await post(request({ inputText: '# 内容', imageSource: 'themeAccent', imageMode: 'themeAccent', imageOptions: { source: 'aiGenerated', model: 'imagen-3-pro', style: 'old' }, ...options }))).status).toBe(200);
      expect(payload().imageOptions).toEqual({ source: 'themeAccent' });
    });
    it(`${name}: reveals validation details without failing the key or retrying`, async () => {
      mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ message: 'Input validation errors: imageModel must be supported' }), { status: 400, headers: { 'x-request-id': 'gamma-qa-error' } }));
      const res = await post(request({ inputText: '# 内容', ...options }));
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ code: 'GAMMA_INVALID_REQUEST', providerStatus: 400, providerRequestId: 'gamma-qa-error', error: expect.stringContaining('imageModel') });
      expect(mocks.failure).not.toHaveBeenCalled();
      expect(mocks.fetch).toHaveBeenCalledTimes(1);
    });
    it(`${name}: counts upstream authentication errors as key failures`, async () => {
      mocks.fetch.mockResolvedValue(new Response('{"message":"Invalid API key"}', { status: 401 }));
      expect((await post(request({ inputText: '# 内容', ...options }))).status).toBe(502);
      expect(mocks.failure).toHaveBeenCalledWith('synthetic');
    });
  }
  it('limits the complete smart rendering instructions to 5000 characters', async () => {
    expect((await gamma(request({ inputText: '# 内容', additionalInstructions: '保持原文。'.repeat(1300), auto: true, strictPreserve: true }))).status).toBe(200);
    expect(payload().additionalInstructions.length).toBeLessThanOrEqual(5000);
  });
  it('limits direct rendering instructions including long attachment names', async () => {
    expect((await direct(request({ inputText: '# 内容', uploadedFiles: [{ name: '附件'.repeat(3000) }], strictPreserve: true }))).status).toBe(200);
    expect(payload().additionalInstructions.length).toBeLessThanOrEqual(5000);
  });
  it('keeps standard and premium membership permissions and image prices', () => {
    expect(checkPermission('shengxin', { numPages: 1, imageSource: 'aiGenerated', aiModel: 'flux-kontext-fast' }).allowed).toBe(true);
    expect(checkPermission('shengxin', { numPages: 1, imageSource: 'aiGenerated', aiModel: 'flux-1-pro' }).allowed).toBe(false);
    expect(checkPermission('advanced', { numPages: 1, imageSource: 'aiGenerated', aiModel: 'flux-1-pro' }).allowed).toBe(true);
    for (const [imageModel, expected] of [['flux-kontext-fast', 3], ['flux-1-pro', 10]] as const) {
      expect(estimateGenerationCredits({ numPages: 1, imageSource: 'aiGenerated', imageModel, estimatedImages: 1 }).imageCreditsPerImage).toBe(expected);
    }
  });
});
