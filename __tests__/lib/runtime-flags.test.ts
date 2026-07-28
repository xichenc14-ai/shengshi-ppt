import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getGenerationDailyGlobalLimit,
  getGenerationRolloutPercent,
  isGenerationEnabled,
  isUserInGenerationRollout,
} from '@/lib/runtime-flags';

afterEach(() => vi.unstubAllEnvs());

describe('runtime generation flags', () => {
  it('defaults to enabled and full rollout', () => {
    vi.stubEnv('GENERATION_ENABLED', '');
    vi.stubEnv('MAINTENANCE_MODE', '');
    vi.stubEnv('GENERATION_ROLLOUT_PERCENT', '');
    expect(isGenerationEnabled()).toBe(true);
    expect(getGenerationRolloutPercent()).toBe(100);
    expect(isUserInGenerationRollout('user-1')).toBe(true);
  });

  it('supports a hard kill switch and maintenance mode', () => {
    vi.stubEnv('GENERATION_ENABLED', 'false');
    expect(isGenerationEnabled()).toBe(false);
    vi.stubEnv('GENERATION_ENABLED', 'true');
    vi.stubEnv('MAINTENANCE_MODE', 'true');
    expect(isGenerationEnabled()).toBe(false);
  });

  it('bounds rollout and global budget values', () => {
    vi.stubEnv('GENERATION_ROLLOUT_PERCENT', '999');
    vi.stubEnv('GENERATION_DAILY_GLOBAL_LIMIT', '-1');
    expect(getGenerationRolloutPercent()).toBe(100);
    expect(getGenerationDailyGlobalLimit()).toBe(1);
  });

  it('assigns rollout buckets deterministically', () => {
    vi.stubEnv('GENERATION_ROLLOUT_PERCENT', '50');
    expect(isUserInGenerationRollout('stable-user')).toBe(isUserInGenerationRollout('stable-user'));
  });
});
