import { NextRequest } from 'next/server';

const DEFAULT_BYTES = 11_131_751;
const CHUNK_SIZE = 64 * 1024;
const MAX_BYTES = 50 * 1024 * 1024;

export function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requestedBytes = Number(searchParams.get('bytes') || DEFAULT_BYTES);
  const totalBytes = Number.isFinite(requestedBytes)
    ? Math.max(1, Math.min(MAX_BYTES, Math.floor(requestedBytes)))
    : DEFAULT_BYTES;

  let sent = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= totalBytes) {
        controller.close();
        return;
      }
      const size = Math.min(CHUNK_SIZE, totalBytes - sent);
      sent += size;
      controller.enqueue(new Uint8Array(size));
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(totalBytes),
      'Content-Disposition': 'attachment; filename="region-speed.bin"',
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
