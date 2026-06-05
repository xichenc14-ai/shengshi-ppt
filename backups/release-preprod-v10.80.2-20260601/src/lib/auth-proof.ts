import { createHmac, timingSafeEqual } from 'crypto';

type AuthProofPayload = {
  uid: string;
  ts: number;
};

const AUTH_PROOF_TTL_MS = 5 * 60 * 1000;

function getSecret() {
  const secret = process.env.AUTH_PROOF_SECRET || process.env.SESSION_PASSWORD || '';
  return secret.trim();
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromB64url(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
    + '='.repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

export function issueAuthProof(userId: string): string {
  const secret = getSecret();
  if (!secret) return '';
  const payload: AuthProofPayload = { uid: userId, ts: Date.now() };
  const payloadStr = JSON.stringify(payload);
  const payloadEncoded = b64url(payloadStr);
  const sign = createHmac('sha256', secret).update(payloadEncoded).digest();
  return `${payloadEncoded}.${b64url(sign)}`;
}

export function verifyAuthProof(token: string, userId: string): boolean {
  const secret = getSecret();
  if (!secret || !token || !userId) return false;
  const [payloadPart, signPart] = token.split('.');
  if (!payloadPart || !signPart) return false;

  const expected = createHmac('sha256', secret).update(payloadPart).digest();
  const got = fromB64url(signPart);
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return false;

  try {
    const payload = JSON.parse(fromB64url(payloadPart).toString('utf8')) as AuthProofPayload;
    if (payload.uid !== userId) return false;
    if (!payload.ts || Date.now() - payload.ts > AUTH_PROOF_TTL_MS) return false;
    return true;
  } catch {
    return false;
  }
}
