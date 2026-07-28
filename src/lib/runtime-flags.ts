import { createHash } from 'crypto';

function boundedInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (!raw?.trim()) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

export function isGenerationEnabled(): boolean {
  return process.env.GENERATION_ENABLED !== 'false' && process.env.MAINTENANCE_MODE !== 'true';
}

export function getGenerationDailyGlobalLimit(): number {
  return boundedInt(process.env.GENERATION_DAILY_GLOBAL_LIMIT, 2_000, 1, 1_000_000);
}

export function getGenerationRolloutPercent(): number {
  return boundedInt(process.env.GENERATION_ROLLOUT_PERCENT, 100, 0, 100);
}

export function isUserInGenerationRollout(userId: string): boolean {
  const percent = getGenerationRolloutPercent();
  if (percent >= 100) return true;
  if (percent <= 0) return false;
  const bucket = parseInt(createHash('sha256').update(`generation-rollout:${userId}`).digest('hex').slice(0, 8), 16) % 100;
  return bucket < percent;
}
