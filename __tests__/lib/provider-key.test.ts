import { describe, expect, it } from 'vitest';
import { hasProviderKey, normalizeProviderKey, parseProviderKeyPool } from '@/lib/ai/provider-key';

describe('provider-key', () => {
  it('normalizes quoted empty values as missing keys', () => {
    expect(normalizeProviderKey('')).toBe('');
    expect(normalizeProviderKey('   ')).toBe('');
    expect(normalizeProviderKey('""')).toBe('');
    expect(normalizeProviderKey("''")).toBe('');
    expect(normalizeProviderKey('"   "')).toBe('');
    expect(normalizeProviderKey("'   '")).toBe('');
    expect(normalizeProviderKey('undefined')).toBe('');
    expect(normalizeProviderKey('null')).toBe('');
    expect(hasProviderKey('""')).toBe(false);
  });

  it('returns trimmed valid keys and parses pool', () => {
    expect(normalizeProviderKey('  sk-test  ')).toBe('sk-test');
    expect(parseProviderKeyPool(' "", sk-a, , sk-b ')).toEqual(['sk-a', 'sk-b']);
  });
});
