import { NextResponse, type NextRequest } from 'next/server';

const CANONICAL_HOST = 'xinppt.cn';
const WWW_HOST = `www.${CANONICAL_HOST}`;

export function middleware(request: NextRequest) {
  const host = request.headers.get('host')?.split(':')[0].toLowerCase();
  const requestIdHeader = request.headers.get('x-request-id')?.trim() || '';
  const requestId = /^[a-zA-Z0-9._:-]{8,128}$/.test(requestIdHeader)
    ? requestIdHeader
    : crypto.randomUUID();

  if (host !== WWW_HOST) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-request-id', requestId);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('x-request-id', requestId);
    return response;
  }

  const url = request.nextUrl.clone();
  url.hostname = CANONICAL_HOST;
  url.protocol = 'https:';
  url.port = '';

  const response = NextResponse.redirect(url, 308);
  response.headers.set('x-request-id', requestId);
  return response;
}
