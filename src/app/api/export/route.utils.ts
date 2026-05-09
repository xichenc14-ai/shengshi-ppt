// 简易内存缓存（Vercel Serverless 单实例内有效）
const pptCache = new Map<string, { buffer: Buffer; createdAt: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export function registerPptBuffer(fileId: string, buffer: Buffer) {
  pptCache.set(fileId, { buffer, createdAt: Date.now() });
}

export function getPptBuffer(fileId: string): Buffer | undefined {
  return pptCache.get(fileId)?.buffer;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pptCache.entries()) {
    if (now - val.createdAt > CACHE_TTL) pptCache.delete(key);
  }
}, 60 * 1000);
