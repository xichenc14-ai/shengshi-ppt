/**
 * Normalize provider API key values from env.
 * Handles common "empty but quoted" cases from deployment env UIs.
 */
export function normalizeProviderKey(raw: string | undefined): string {
  const value = (raw || '').trim();
  if (!value) return '';

  const unquoted = value
    .replace(/^"(.*)"$/, '$1')
    .replace(/^'(.*)'$/, '$1')
    .trim();

  const lowered = unquoted.toLowerCase();
  if (!unquoted || lowered === 'null' || lowered === 'undefined') {
    return '';
  }

  return unquoted;
}

export function parseProviderKeyPool(raw: string | undefined): string[] {
  return (raw || '')
    .split(',')
    .map((key) => normalizeProviderKey(key))
    .filter(Boolean);
}

export function hasProviderKey(raw: string | undefined): boolean {
  return Boolean(normalizeProviderKey(raw));
}
