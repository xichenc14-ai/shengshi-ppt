type GenerationCreditParams = {
  numPages: number;
  imageSource?: string;
  imageModel?: string;
  estimatedImages?: number;
};

type GenerationCreditBreakdown = {
  totalCredits: number;
  baseCredits: number;
  imageCredits: number;
  imageCreditsPerImage: number;
  estimatedImages: number;
  imageSource: string;
  imageModel: string | null;
};

const BASE_CREDITS_PER_PAGE = 3;
const STANDARD_AI_IMAGE_CREDITS = 3;
const PREMIUM_AI_IMAGE_CREDITS = 10;

const PREMIUM_AI_MODELS = new Set([
  'imagen-3-pro',
  'flux-1-pro',
  'ideogram-v3-turbo',
  'luma-photon-1',
  'leonardo-phoenix',
  'flux-kontext-pro',
  'imagen-4-pro',
  'ideogram-v3',
  'gemini-2.5-flash-image',
]);

function toPositiveInt(value: number, fallback: number): number {
  const normalized = Number.isFinite(value) ? Math.floor(value) : fallback;
  return normalized > 0 ? normalized : fallback;
}

export function estimateGenerationCredits(params: GenerationCreditParams): GenerationCreditBreakdown {
  const numPages = toPositiveInt(params.numPages, 1);
  const imageSource = String(params.imageSource || 'themeAccent');
  const imageModel = typeof params.imageModel === 'string' && params.imageModel.trim()
    ? params.imageModel.trim()
    : null;

  let estimatedImages = 0;
  let imageCreditsPerImage = 0;

  if (imageSource === 'aiGenerated') {
    estimatedImages = toPositiveInt(
      Number(params.estimatedImages || 0),
      Math.ceil(numPages / 2)
    );
    imageCreditsPerImage = imageModel && PREMIUM_AI_MODELS.has(imageModel)
      ? PREMIUM_AI_IMAGE_CREDITS
      : STANDARD_AI_IMAGE_CREDITS;
  }

  const baseCredits = numPages * BASE_CREDITS_PER_PAGE;
  const imageCredits = estimatedImages * imageCreditsPerImage;

  return {
    totalCredits: baseCredits + imageCredits,
    baseCredits,
    imageCredits,
    imageCreditsPerImage,
    estimatedImages,
    imageSource,
    imageModel,
  };
}
