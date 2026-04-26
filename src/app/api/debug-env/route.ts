import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const debug = {
    hasKimiKey: !!(process.env.KIMI_API_KEY),
    kimiKeyLen: process.env.KIMI_API_KEY?.length || 0,
    kimiBase: process.env.KIMI_API_BASE || 'default',
    hasMinimaxKey: !!(process.env.MINIMAX_API_KEY),
    minimaxKeyLen: process.env.MINIMAX_API_KEY?.length || 0,
    hasGlmKeys: !!(process.env.GLM_API_KEYS),
    glmKeysCount: process.env.GLM_API_KEYS?.split(',').filter(Boolean).length || 0,
    glmBase: process.env.GLM_API_BASE || 'default',
    runtime: process.env.VERCEL_RUNTIME || 'unknown',
    region: process.env.VERCEL_REGION || 'unknown',
  };
  return NextResponse.json(debug);
}
