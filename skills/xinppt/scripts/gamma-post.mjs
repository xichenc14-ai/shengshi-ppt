import { spawn } from 'node:child_process';

const STATUS_MARKER = '\n__XINPPT_HTTP_STATUS__:';
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

function parseHeaders(raw) {
  const blocks = raw.split(/\r?\n\r?\n/).filter((block) => /^HTTP\/\S+\s+\d{3}/i.test(block));
  const lines = (blocks.at(-1) || '').split(/\r?\n/);
  const status = Number(lines[0]?.match(/^HTTP\/\S+\s+(\d{3})/i)?.[1]) || 0;
  const headers = new Map();
  for (const line of lines.slice(1)) {
    const colon = line.indexOf(':');
    if (colon > 0) headers.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim());
  }
  return { status, requestId: headers.get('x-request-id') || '', retryAfter: headers.get('retry-after') || '' };
}

function parseBody(raw) {
  try { return raw ? JSON.parse(raw) : {}; } catch { return { message: raw.slice(0, 1000) }; }
}

function responseError(status, data, metadata) {
  const detail = data?.error?.message || data?.message || data?.error || `HTTP ${status}`;
  const error = new Error(`Gamma API POST /generations 失败: ${status} ${String(detail).slice(0, 1000)}`);
  error.status = status;
  error.requestId = metadata.requestId;
  error.retryAfter = metadata.retryAfter;
  error.gammaCode = String(data?.error?.code || data?.code || data?.statusCode || '').slice(0, 100);
  return error;
}

/** Submit once through libcurl. The API key travels through a private pipe, never argv or a file. */
export async function postGenerationWithCurl(apiBase, apiKey, body, timeoutMs = 60000) {
  if (/[\r\n]/.test(apiKey)) throw new Error('Gamma API key 格式无效');
  const args = [
    '--config', '/dev/fd/3', '--silent', '--show-error', '--http2',
    '--connect-timeout', '15', '--max-time', String(Math.ceil(timeoutMs / 1000)),
    '--request', 'POST', '--url', `${apiBase}/generations`,
    '--header', 'Accept: application/json', '--header', 'Content-Type: application/json',
    '--data-binary', '@-', '--dump-header', '/dev/fd/4',
    '--write-out', `${STATUS_MARKER}%{http_code}`,
  ];
  const result = await new Promise((resolve, reject) => {
    const child = spawn('curl', args, { stdio: ['pipe', 'pipe', 'pipe', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    const headerChunks = [];
    let size = 0;
    child.on('error', reject);
    child.stdin.on('error', () => {});
    child.stdio[3].on('error', () => {});
    child.stdio[4].on('data', (chunk) => headerChunks.push(chunk));
    child.stdout.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_RESPONSE_BYTES) child.kill();
      else stdout.push(chunk);
    });
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('close', (code, signal) => resolve({
      code, signal, size,
      stdout: Buffer.concat(stdout).toString('utf8'),
      stderr: Buffer.concat(stderr).toString('utf8'),
      headers: Buffer.concat(headerChunks).toString('utf8'),
    }));
    const quotedKey = apiKey.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    child.stdio[3].end(`header = "X-API-KEY: ${quotedKey}"\n`);
    child.stdin.end(JSON.stringify(body));
  });
  const marker = result.stdout.lastIndexOf(STATUS_MARKER);
  const rawBody = marker < 0 ? result.stdout : result.stdout.slice(0, marker);
  const writtenStatus = marker < 0 ? 0 : Number(result.stdout.slice(marker + STATUS_MARKER.length));
  const metadata = parseHeaders(result.headers);
  const status = metadata.status || writtenStatus;
  const data = parseBody(rawBody);

  // A received Gamma response outranks curl's exit code: preserve 4xx details or a returned generation ID.
  if (status >= 400) throw responseError(status, data, metadata);
  if (status >= 200 && status < 300 && data && typeof data === 'object'
      && (result.code === 0 || data.generationId || data.id)) {
    return { data, httpStatus: status, requestId: metadata.requestId };
  }
  if (result.size > MAX_RESPONSE_BYTES) throw new Error('Gamma 创建响应过大，结果不确定');
  const detail = result.stderr.trim().replace(/\s+/g, ' ').slice(0, 300);
  const error = new Error(`Gamma 创建连接失败 (curl exit=${result.code ?? 'signal:' + result.signal}): ${detail || '未收到完整 HTTP 响应'}`);
  error.code = `CURL_${result.code ?? 'SIGNAL'}`;
  error.status = status || 0;
  error.requestId = metadata.requestId;
  throw error;
}
