import { describe, it, expect } from 'vitest';
import {
  rateLimit,
  getRateLimitConfig,
  getClientIP,
  checkVerifyAttempts,
  checkSMSRateLimit,
  rollbackSMSRateLimit,
} from '@/lib/rate-limit';

describe('getRateLimitConfig', () => {
  it('should return config for /api/outline', () => {
    const config = getRateLimitConfig('/api/outline');
    expect(config.maxRequests).toBe(10);
    expect(config.windowMs).toBe(60000);
  });

  it('should return config for /api/gamma', () => {
    const config = getRateLimitConfig('/api/gamma');
    expect(config.maxRequests).toBe(5);
  });

  it('should return default config for unknown routes', () => {
    const config = getRateLimitConfig('/api/unknown');
    expect(config.maxRequests).toBe(30);
    expect(config.windowMs).toBe(60000);
  });

  it('should match prefix routes', () => {
    const config = getRateLimitConfig('/api/credits/balance');
    expect(config.maxRequests).toBe(20);
  });
});

describe('rateLimit', () => {
  it('should allow first request', () => {
    const result = rateLimit(`test:${Date.now()}`, { maxRequests: 3, windowMs: 60000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('should block when max requests exceeded', () => {
    const key = `test-block:${Date.now()}`;
    rateLimit(key, { maxRequests: 2, windowMs: 60000 });
    rateLimit(key, { maxRequests: 2, windowMs: 60000 });
    const result = rateLimit(key, { maxRequests: 2, windowMs: 60000 });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should return correct remaining count', () => {
    const key = `test-remain:${Date.now()}`;
    const r1 = rateLimit(key, { maxRequests: 5, windowMs: 60000 });
    const r2 = rateLimit(key, { maxRequests: 5, windowMs: 60000 });
    expect(r1.remaining).toBe(4);
    expect(r2.remaining).toBe(3);
  });

  it('should reset after window expires', () => {
    const key = `test-reset:${Date.now()}`;
    rateLimit(key, { maxRequests: 1, windowMs: 1 }); // 1ms window
    // Wait for window to expire
    const start = Date.now();
    while (Date.now() - start < 5) {} // busy wait 5ms
    const result = rateLimit(key, { maxRequests: 1, windowMs: 1 });
    expect(result.allowed).toBe(true);
  });
});

describe('getClientIP', () => {
  it('should extract IP from x-forwarded-for', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    });
    expect(getClientIP(req)).toBe('1.2.3.4');
  });

  it('should extract IP from x-real-ip', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-real-ip': '10.0.0.1' },
    });
    expect(getClientIP(req)).toBe('10.0.0.1');
  });

  it('should return unknown when no IP headers', () => {
    const req = new Request('http://localhost');
    expect(getClientIP(req)).toBe('unknown');
  });

  it('should extract from cf-connecting-ip', () => {
    const req = new Request('http://localhost', {
      headers: { 'cf-connecting-ip': '172.16.0.1' },
    });
    expect(getClientIP(req)).toBe('172.16.0.1');
  });
});

describe('checkVerifyAttempts', () => {
  it('should allow first attempt', () => {
    const result = checkVerifyAttempts(`test-verify:${Date.now()}`);
    expect(result.allowed).toBe(true);
    expect(result.attemptsLeft).toBe(4);
  });

  it('should block after 5 attempts', () => {
    const phone = `test-verify-block:${Date.now()}`;
    for (let i = 0; i < 5; i++) checkVerifyAttempts(phone);
    const result = checkVerifyAttempts(phone);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
  });
});

describe('checkSMSRateLimit', () => {
  it('should block a different phone on the same IP within 60 seconds', async () => {
    const suffix = Date.now();
    const ip = `sms-shared-ip:${suffix}`;

    const first = await checkSMSRateLimit(ip, `138${String(suffix).slice(-8).padStart(8, '0')}`);
    const second = await checkSMSRateLimit(ip, `139${String(suffix + 1).slice(-8).padStart(8, '0')}`);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
    expect(second.reason).toBe('请60秒后再试');
  });

  it('should still block the same phone within 60 seconds', async () => {
    const suffix = Date.now();
    const phone = `137${String(suffix).slice(-8).padStart(8, '0')}`;

    const first = await checkSMSRateLimit(`sms-ip-a:${suffix}`, phone);
    const second = await checkSMSRateLimit(`sms-ip-b:${suffix}`, phone);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
    expect(second.reason).toBe('请60秒后再试');
  });

  it('should allow immediate retry after rolling back a failed send', async () => {
    const suffix = Date.now();
    const ip = `sms-rollback-ip:${suffix}`;
    const phone = `136${String(suffix).slice(-8).padStart(8, '0')}`;

    const first = await checkSMSRateLimit(ip, phone);
    rollbackSMSRateLimit(ip, phone);
    const second = await checkSMSRateLimit(ip, phone);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
  });
});
