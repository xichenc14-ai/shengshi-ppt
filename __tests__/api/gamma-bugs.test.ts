import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/gamma/route';

// Mock the key pool module
vi.mock('@/lib/gamma-key-pool', () => ({
  selectBestKey: vi.fn().mockReturnValue({
    key: 'mock-key',
    label: '测试key',
    remaining: 1000,
  }),
  getAllKeys: vi.fn().mockReturnValue([
    { key: 'mock-key', label: '测试key', remaining: 1000 },
    { key: 'mock-key-2', label: '备用key', remaining: 1000 },
  ]),
  updateKeyBalance: vi.fn(),
  recordKeyFailure: vi.fn(),
  getKeyPoolStatus: vi.fn().mockReturnValue({ keys: [], totalRemaining: 0, healthyCount: 0, lowBalanceKeys: [] }),
}));

vi.mock('@/lib/gamma-theme-mapping', () => ({
  getGammaThemeId: vi.fn((id: string) => id || 'consultant'),
  getAllGammaThemes: vi.fn().mockReturnValue([
    'consultant',
    'blues',
    'blue-steel',
    'breeze',
    'cornflower',
    'howlite',
    'commons',
    'finesse',
    'clementa',
    'atmosphere',
    'coral-glow',
    'ashrose',
    'aurora',
    'electric',
    'chisel',
    'aurum',
  ]),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockReturnValue({ allowed: true }),
  getRateLimitConfig: vi.fn().mockReturnValue({ windowMs: 60000, max: 10 }),
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
  isIPBlocked: vi.fn().mockReturnValue(false),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

function asNextRequest(request: Request): NextRequest {
  return request as unknown as NextRequest;
}

function mockPostRequest(body: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/gamma', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '127.0.0.1' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

function mockGetRequest(id: string) {
  return asNextRequest(new Request(`http://localhost/api/gamma?id=${id}`, {
    headers: { 'x-forwarded-for': '127.0.0.1' },
  }));
}

describe('POST /api/gamma - Bug Verification Tests', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  // ===== Bug 1: Verify `slides` is not in gammaPayload =====
  it('BUG-1: gammaPayload should NOT contain slides parameter', async () => {
    // Arrange
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ generationId: 'test-gen-123', credits: { deducted: 1, remaining: 999 } }),
    });

    // Act
    const res = await POST(mockPostRequest({
      inputText: '# Test PPT\n\n## Slide 1\n\n- Point 1\n- Point 2',
      themeId: 'consultant',
      tone: 'professional',
      imageMode: 'theme-img',
      numCards: 3,
      slides: [{ id: '1', title: 'Test' }], // This should be ignored
    }));

    expect(res.status).toBe(200);

    // Assert: Verify fetch was called with correct payload (no slides)
    const fetchCall = mockFetch.mock.calls[0];
    const calledBody = JSON.parse(fetchCall[1].body as string);
    
    // Bug verification: slides should NOT be sent to Gamma API
    expect(calledBody).not.toHaveProperty('slides');
    expect(calledBody).toHaveProperty('inputText');
    expect(calledBody).toHaveProperty('themeId');
    expect(calledBody).toHaveProperty('imageOptions');
    expect(calledBody.imageOptions).toHaveProperty('source');
  });

  // ===== Bug 2: imageOptions source mapping =====
  it('BUG-2: imageOptions.source should be correctly mapped from imageMode', async () => {
    // Arrange
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ generationId: 'test-gen-123' }),
    });

    // Act - Test theme-img mode (should map to themeAccent for light themes)
    const res = await POST(mockPostRequest({
      inputText: '# Test',
      imageMode: 'theme-img',
      themeId: 'consultant',
      tone: 'professional',
    }));

    expect(res.status).toBe(200);

    // Assert
    const fetchCall = mockFetch.mock.calls[0];
    const calledBody = JSON.parse(fetchCall[1].body as string);
    
    // themeId=consultant is NOT in darkThemes set, should keep themeAccent
    expect(calledBody.imageOptions.source).toBe('themeAccent');
  });

  it('BUG-2b: imageOptions.source should keep themeAccent for dark themes when user selects theme-img', async () => {
    // Arrange
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ generationId: 'test-gen-123' }),
    });

    // Act - founder is a dark theme
    const res = await POST(mockPostRequest({
      inputText: '# Test',
      imageMode: 'theme-img',
      themeId: 'founder',
      tone: 'professional',
    }));

    expect(res.status).toBe(200);

    // Assert: 用户明确选择 theme-img 时，深色主题也应保持 themeAccent
    const fetchCall = mockFetch.mock.calls[0];
    const calledBody = JSON.parse(fetchCall[1].body as string);
    expect(calledBody.imageOptions.source).toBe('themeAccent');
  });

  it('BUG-2c: explicit imageMode=web should not be overridden by stale imageOptions.source', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ generationId: 'test-gen-123' }),
    });

    const res = await POST(mockPostRequest({
      inputText: '# Test',
      imageMode: 'webFreeToUseCommercially',
      imageOptions: { source: 'themeAccent' },
      themeId: 'consultant',
      tone: 'professional',
    }));

    expect(res.status).toBe(200);
    const fetchCall = mockFetch.mock.calls[0];
    const calledBody = JSON.parse(fetchCall[1].body as string);
    expect(calledBody.imageOptions.source).toBe('webFreeToUseCommercially');
  });

  it('BUG-2d: themeAccent should fallback to web source on high-risk light themes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ generationId: 'test-gen-123' }),
    });

    const res = await POST(mockPostRequest({
      inputText: '# Test',
      imageMode: 'theme-img',
      themeId: 'howlite',
      tone: 'casual',
    }));

    expect(res.status).toBe(200);
    const fetchCall = mockFetch.mock.calls[0];
    const calledBody = JSON.parse(fetchCall[1].body as string);
    expect(calledBody.imageOptions.source).toBe('webFreeToUseCommercially');
  });

  it('BUG-2e: explicit web mode should not instruct key pages to fallback to themeAccent', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ generationId: 'test-gen-123' }),
    });

    const res = await POST(mockPostRequest({
      inputText: '# Test',
      imageMode: 'webFreeToUseCommercially',
      themeId: 'consultant',
      tone: 'professional',
    }));

    expect(res.status).toBe(200);
    const fetchCall = mockFetch.mock.calls[0];
    const calledBody = JSON.parse(fetchCall[1].body as string);
    expect(String(calledBody.additionalInstructions)).not.toContain('允许回退为 themeAccent');
    expect(String(calledBody.additionalInstructions)).toContain('不允许回退成 themeAccent');
    expect(String(calledBody.additionalInstructions)).not.toContain('若取图失败可回退主题图');
  });

  it('BUG-2f: locked blue-theme intent should override conflicting white theme payload', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ generationId: 'test-gen-locked-blue' }),
    });

    const res = await POST(mockPostRequest({
      inputText: '# Test',
      imageMode: 'webFreeToUseCommercially',
      themeId: 'howlite',
      tone: 'professional',
      intentHints: {
        themeLocked: true,
        themeLabel: '蓝色系',
      },
    }));

    expect(res.status).toBe(200);
    const fetchCall = mockFetch.mock.calls[0];
    const calledBody = JSON.parse(fetchCall[1].body as string);
    expect(calledBody.themeId).toBe('consultant');
    expect(String(calledBody.additionalInstructions)).toContain('蓝色系');
  });

  it('BUG-2g: additional instructions should forbid PPTX-fragile external icon libraries', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ generationId: 'test-gen-pptx-safe-icons' }),
    });

    const res = await POST(mockPostRequest({
      inputText: '# Test\n\n---\n\n## Slide\n\n### 要点一',
      imageMode: 'webFreeToUseCommercially',
      themeId: 'consultant',
      tone: 'professional',
    }));

    expect(res.status).toBe(200);
    const fetchCall = mockFetch.mock.calls[0];
    const calledBody = JSON.parse(fetchCall[1].body as string);
    const instructions = String(calledBody.additionalInstructions);
    expect(instructions).toContain('PPTX安全图标与字体规范');
    expect(instructions).toContain('数字徽章');
    expect(instructions).toContain('禁止使用Gamma Icons');
    expect(instructions).not.toContain('每一页都必须包含2-5个 Icons');
    expect(instructions).not.toContain('推荐图标库');
  });

  // ===== Bug 3: textMode should be preserved =====
  it('BUG-3: textMode should always be preserve regardless of input', async () => {
    // Arrange
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ generationId: 'test-gen-123' }),
    });

    // Act - Even if user sends 'generate' or 'condense', Gamma should receive 'preserve'
    const res = await POST(mockPostRequest({
      inputText: '# Test',
      textMode: 'generate', // User selection should be ignored
      themeId: 'consultant',
      tone: 'professional',
    }));

    expect(res.status).toBe(200);

    // Assert: textMode must be 'preserve' (fixed value per V8.2 design)
    const fetchCall = mockFetch.mock.calls[0];
    const calledBody = JSON.parse(fetchCall[1].body as string);
    expect(calledBody.textMode).toBe('preserve');
  });

  // ===== Bug 4: Error handling when Gamma API returns non-ok =====
  it('BUG-4: Should return 502 when Gamma API returns error', async () => {
    // Arrange
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'Gamma API error: invalid request',
    });

    // Act
    const res = await POST(mockPostRequest({
      inputText: '# Test',
      themeId: 'consultant',
    }));

    // Assert
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error).toContain('生成服务');
    expect(data.error).toContain('400');
  });

  // ===== Bug 5: Empty inputText should return 400 =====
  it('BUG-5: Should return 400 for empty inputText', async () => {
    const res = await POST(mockPostRequest({ inputText: '' }));
    expect(res.status).toBe(400);
  });

  it('BUG-5b: Should return 400 when inputText is only whitespace', async () => {
    const res = await POST(mockPostRequest({ inputText: '   ' }));
    expect(res.status).toBe(400);
  });

  // ===== Bug 6: cardSplit should be inputTextBreaks (preserve mode requirement) =====
  it('BUG-6: cardSplit should be inputTextBreaks for preserve mode', async () => {
    // Arrange
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ generationId: 'test-gen-123' }),
    });

    // Act
    const res = await POST(mockPostRequest({
      inputText: '# Test\n\n---\n\n## Slide 2',
      themeId: 'consultant',
      tone: 'professional',
    }));

    expect(res.status).toBe(200);

    // Assert
    const fetchCall = mockFetch.mock.calls[0];
    const calledBody = JSON.parse(fetchCall[1].body as string);
    expect(calledBody.cardSplit).toBe('inputTextBreaks');
  });

  // ===== GET endpoint tests =====
  describe('GET /api/gamma', () => {
    it('Should return 400 when generationId is missing', async () => {
      const res = await GET(asNextRequest(new Request('http://localhost/api/gamma', {
        headers: { 'x-forwarded-for': '127.0.0.1' },
      })));
      expect(res.status).toBe(400);
    });

    it('Should return generation status when id is provided', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          generationId: 'test-123',
          status: 'completed',
          gammaUrl: 'https://gamma.app/test',
          exportUrl: 'https://example.com/test.pptx',
        }),
      });

      // Act
      const res = await GET(mockGetRequest('test-123'));

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('completed');
      expect(data.gammaUrl).toBeDefined();
    });
  });
});
