import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const LEGACY_SALT = '_sxPPT_salt_2026';
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

function sha256Legacy(password: string): string {
  return createHash('sha256').update(password + LEGACY_SALT).digest('hex');
}

export function hashPasswordSecure(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }).toString('hex');
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string | null | undefined): boolean {
  if (!storedHash) return false;

  if (storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 6) return false;
    const [, nRaw, rRaw, pRaw, salt, hashHex] = parts;
    const n = Number(nRaw);
    const r = Number(rRaw);
    const p = Number(pRaw);
    if (!n || !r || !p || !salt || !hashHex) return false;
    const derived = scryptSync(password, salt, hashHex.length / 2, { N: n, r, p });
    const original = Buffer.from(hashHex, 'hex');
    if (derived.length !== original.length) return false;
    return timingSafeEqual(derived, original);
  }

  // 兼容旧版 SHA-256
  return storedHash === sha256Legacy(password);
}

export function isLegacyHash(storedHash: string | null | undefined): boolean {
  return Boolean(storedHash && !storedHash.startsWith('scrypt$'));
}
