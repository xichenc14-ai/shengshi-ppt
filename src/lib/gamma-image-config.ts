/**
 * Gamma REST image configuration.
 *
 * Keep the provider model IDs in one place. Gamma periodically retires or
 * renames models, so product tiers must not hard-code provider IDs across the
 * client, API routes, membership checks, and credit estimator.
 */

export const GAMMA_LEGACY_IMAGE_MODELS = {
  standard: {
    id: 'flux-kontext-fast',
    // Gamma's documented upstream price; product credits are kept separate.
    upstreamCreditsPerImage: 2,
    productCreditsPerImage: 3,
  },
  premium: {
    id: 'flux-1-pro',
    upstreamCreditsPerImage: 8,
    productCreditsPerImage: 10,
  },
} as const;

// 2026-09-22 acceptance: retain legacy defaults. The standard candidate has only
// one visual sample; the premium candidate did not meet the style requirement.
// See docs/releases/gamma-upgrade-20260922-acceptance.md before promotion.
// Product prices are identical in both catalogs.
export const GAMMA_CANDIDATE_IMAGE_MODELS = {
  standard: { ...GAMMA_LEGACY_IMAGE_MODELS.standard, id: 'flux-2-klein' },
  premium: { ...GAMMA_LEGACY_IMAGE_MODELS.premium, id: 'flux-2-pro' },
} as const;
export const GAMMA_IMAGE_MODELS = GAMMA_LEGACY_IMAGE_MODELS;

export type GammaAiTier = keyof typeof GAMMA_IMAGE_MODELS;
export type GammaAiModel = (typeof GAMMA_LEGACY_IMAGE_MODELS)[GammaAiTier]['id']
  | (typeof GAMMA_CANDIDATE_IMAGE_MODELS)[GammaAiTier]['id'];

export const GAMMA_SUPPORTED_AI_MODELS: readonly GammaAiModel[] = [
  GAMMA_LEGACY_IMAGE_MODELS.standard.id,
  GAMMA_LEGACY_IMAGE_MODELS.premium.id,
  GAMMA_CANDIDATE_IMAGE_MODELS.standard.id,
  GAMMA_CANDIDATE_IMAGE_MODELS.premium.id,
] as const;

export function isPremiumGammaAiModel(model?: string): boolean {
  return model === GAMMA_LEGACY_IMAGE_MODELS.premium.id || model === GAMMA_CANDIDATE_IMAGE_MODELS.premium.id;
}

export function getGammaAiModelForMode(mode?: string): GammaAiModel | undefined {
  switch ((mode || '').trim().toLowerCase()) {
    case 'ai':
    case 'aigenerated':
    case 'ai图':
      return GAMMA_IMAGE_MODELS.standard.id;
    case 'ai-pro':
    case 'ai尊享':
      return GAMMA_IMAGE_MODELS.premium.id;
    default:
      return undefined;
  }
}

export function isSupportedGammaAiModel(value: unknown): value is GammaAiModel {
  return typeof value === 'string'
    && (GAMMA_SUPPORTED_AI_MODELS as readonly string[]).includes(value);
}

/** Translate cached pre-retirement selections without changing their tier. */
export function normalizeGammaAiModel(value: unknown, mode?: string): string {
  if (value === 'imagen-3-pro') return GAMMA_IMAGE_MODELS.premium.id;
  if (value === 'imagen-3-flash') return getGammaAiModelForMode(mode) || GAMMA_IMAGE_MODELS.standard.id;
  if (isSupportedGammaAiModel(value) || value === 'ideogram-v3' || value === 'gemini-2.5-flash-image') return value;
  return getGammaAiModelForMode(mode) || GAMMA_IMAGE_MODELS.standard.id;
}

export function getProductImageCredits(model?: string): number {
  return isPremiumGammaAiModel(model)
    ? GAMMA_IMAGE_MODELS.premium.productCreditsPerImage
    : GAMMA_IMAGE_MODELS.standard.productCreditsPerImage;
}
