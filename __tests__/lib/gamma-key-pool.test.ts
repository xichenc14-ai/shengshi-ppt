import { afterEach, describe, expect, it } from 'vitest';
import { getKeyPoolStatus, reloadKeyPool, updateKeyBalance } from '@/lib/gamma-key-pool';

const ORIGINAL_KEYS = process.env.GAMMA_API_KEYS;

afterEach(async () => {
  if (ORIGINAL_KEYS === undefined) delete process.env.GAMMA_API_KEYS;
  else process.env.GAMMA_API_KEYS = ORIGINAL_KEYS;
  try {
    await reloadKeyPool();
  } catch {
    // Some environments intentionally do not configure provider keys.
  }
});

describe('gamma-key-pool shared balance', () => {
  it('treats multiple keys as one shared quota instead of summing them', async () => {
    process.env.GAMMA_API_KEYS = [
      'Key-1:3076:sk-gamma-test-key-1',
      'Key-2:3076:sk-gamma-test-key-2',
      'Key-3:3076:sk-gamma-test-key-3',
    ].join(',');
    await reloadKeyPool();

    const status = await getKeyPoolStatus();

    expect(status.keys).toHaveLength(3);
    expect(status.sharedRemaining).toBe(3076);
    expect(status.totalRemaining).toBe(3076);
  });

  it('syncs returned live balance across all shared keys', async () => {
    process.env.GAMMA_API_KEYS = [
      'Key-1:3967:sk-gamma-test-key-1',
      'Key-2:3967:sk-gamma-test-key-2',
      'Key-3:3967:sk-gamma-test-key-3',
    ].join(',');
    await reloadKeyPool();

    await updateKeyBalance('sk-gamma-test-key-2', 3, 3076);
    const status = await getKeyPoolStatus();

    expect(status.totalRemaining).toBe(3076);
    expect(status.keys.map((key) => key.remaining)).toEqual([3076, 3076, 3076]);
  });
});
