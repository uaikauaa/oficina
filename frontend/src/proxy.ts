import { NextRequest, NextResponse } from 'next/server';
import { buildContentSecurityPolicy } from './lib/securityHeaders';

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('base64');
  const csp = buildContentSecurityPolicy(process.env.NODE_ENV === 'production', nonce);
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = {
  matcher: ['/((?!api/|_next/|pwa/icon-(?:192|512)\\.png$|manifest\\.webmanifest$|favicon\\.ico$|logo-icone\\.png$|login-bg\\.png$|dashboard-banner\\.png$).*)'],
};
