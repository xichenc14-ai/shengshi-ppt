import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from '@/app/api/gamma/route';

// Mock the key pool module
vi.mock('@/lib/gamma-key-pool', () => ({
  selectBestKey: vi.fn().mockReturnValue({
    key: 'mock-key',
    label: '测试key',
    remaining: 1000,
  }),
  updateKeyBalance: vi.fn(),
  recordKeyFailure: vi.fn(),
  getKeyPoolStatus: vi.fn().mockReturnValue({ keys: [], totalRemaining: 0, healthyCount: 0, lowBalanceKeys: [] }),
}));

vi.mock('@/lib/gamma-theme-mapping', () => ({
  getGammaThemeId: vi.fn((id: string) => id || 'consultant'),
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

function mockPostRequest(body: Record<string, any> = {}) {
  return new Request('http://localhost/api/gamma', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '127.0.0.1' },
    body: JSON.stringify(body),
  });
}

function mockGetRequest(id: string) {
  return new Request(`http://localhost/api/gamma?id=${id}`, {
    headers: { 'x-forwarded-for': '127.0.0.1' },
  });
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
    
    // themeId=consultant is NOT in darkThemes set, so should use themeAccent
    expect(calledBody.imageOptions.source).toBe('themeAccent');
  });

  it('BUG-2b: imageOptions.source should use webFreeToUseCommercially for dark themes', async () => {
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

    // Assert: Dark theme should use webFreeToUseCommercially
    const fetchCall = mockFetch.mock.calls[0];
    const calledBody = JSON.parse(fetchCall[1].body as string);
    expect(calledBody.imageOptions.source).toBe('webFreeToUseCommercially');
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
    expect(data.error).toContain('Gamma API');
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
      const res = await GET(new Request('http://localhost/api/gamma', {
        headers: { 'x-forwarded-for': '127.0.0.1' },
      }) as any);
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
      const res = await GET(mockGetRequest('test-123') as any);

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('completed');
      expect(data.gammaUrl).toBeDefined();
    });
  });
});
