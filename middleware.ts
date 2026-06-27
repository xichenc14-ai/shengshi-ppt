import { NextResponse, type NextRequest } from 'next/server';

const CANONICAL_HOST = 'xinppt.cn';
const WWW_HOST = `www.${CANONICAL_HOST}`;

export function middleware(request: NextRequest) {
  const host = request.headers.get('host')?.split(':')[0].toLowerCase();

  if (host !== WWW_HOST) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.hostname = CANONICAL_HOST;
  url.protocol = 'https:';
  url.port = '';

  return NextResponse.redirect(url, 308);
}
