/**
 * SEC-002 / HEAD-01: Configuração Centralizada de Security Headers e CSP.
 * Protocolo PSQ-SaaS-001 — Produção Segura Next.js.
 */

export interface SecurityHeader {
  key: string;
  value: string;
}

/**
 * Constrói a Content Security Policy (CSP) sob medida para Next.js App Router (auto-contido).
 * Não há fontes ou scripts externos (fontes Geist são locais via next/font; ícones Lucide são SVG inline).
 */
export function buildContentSecurityPolicy(
  isProd: boolean = process.env.NODE_ENV === 'production',
  nonce?: string
): string {
  if (nonce && !/^[A-Za-z0-9+/=_-]{16,128}$/.test(nonce)) throw new Error('Nonce invalido');
  const scriptSrc = isProd
    ? (nonce ? `script-src 'nonce-${nonce}' 'strict-dynamic'` : "script-src 'none'")
    : (nonce ? `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'` : "script-src 'self' 'unsafe-inline' 'unsafe-eval'");

  const connectSrc = isProd
    ? "connect-src 'self'"
    : "connect-src 'self' ws: http:";

  const directives = [
    "default-src 'self'",
    scriptSrc,
    nonce ? `style-src 'self' 'nonce-${nonce}'` : "style-src 'self'",
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "object-src 'none'",
    "worker-src 'self'",
    "manifest-src 'self'",
    connectSrc,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  return directives.join('; ');
}

/**
 * Retorna a lista de cabeçalhos de segurança HTTP.
 * HSTS (Strict-Transport-Security) é ativado condicionalmente em produção para não bloquear desenvolvimento local HTTP.
 */
export function getSecurityHeaders(
  isProd: boolean = process.env.NODE_ENV === 'production'
): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    {
      key: 'X-Content-Type-Options',
      value: 'nosniff',
    },
    {
      key: 'X-Frame-Options',
      value: 'DENY',
    },
    {
      key: 'Referrer-Policy',
      value: 'strict-origin-when-cross-origin',
    },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    },
    {
      key: 'Content-Security-Policy',
      value: buildContentSecurityPolicy(isProd),
    },
  ];

  if (isProd) {
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=31536000; includeSubDomains',
    });
  }

  return headers;
}
