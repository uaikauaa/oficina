import { validateBackendOrigin } from '../lib/backendUrl.ts';
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

export type ProxyConfig = { origin: string; iam: boolean; clientContext?: { secret: string; hops: number } };
export function proxyConfig(env: Record<string, string | undefined> = process.env): ProxyConfig {
  const origin = validateBackendOrigin(env.INTERNAL_BACKEND_URL || (env.NODE_ENV !== 'production' ? 'http://localhost:8080' : ''));
  const iam = Boolean(env.K_SERVICE) || env.CLOUD_RUN_IAM === 'true';
  if (env.K_SERVICE && env.CLOUD_RUN_IAM === 'false') throw new Error('Cloud Run requer identidade de servico.');
  if (iam && !origin.startsWith('https://')) throw new Error('Cloud Run backend requer HTTPS.');
  if (!origin.startsWith('https://') && !['localhost', '127.0.0.1', 'backend', '[::1]'].includes(new URL(origin).hostname)) {
    throw new Error('HTTP permitido somente no ambiente local isolado.');
  }
  let clientContext: ProxyConfig['clientContext'];
  if (env.K_SERVICE) {
    const hops = Number(env.TRUSTED_PROXY_HOPS);
    if (!Number.isInteger(hops) || hops < 1 || hops > 5 || !env.SERVICE_PROXY_SECRET || env.SERVICE_PROXY_SECRET.length < 32) {
      throw new Error('Cloud Run requer cadeia de proxies validada e SERVICE_PROXY_SECRET.');
    }
    clientContext = { secret: env.SERVICE_PROXY_SECRET, hops };
  }
  return { origin, iam, clientContext };
}

type Fetcher = typeof fetch;
export function createIdentityProvider(fetcher: Fetcher = fetch) {
  let cached: { audience: string; token: string; expires: number } | undefined;
  let pending: { audience: string; value: Promise<string> } | undefined;
  return async (audience: string): Promise<string> => {
    if (cached?.audience === audience && cached.expires > Date.now() + 60000) return cached.token;
    if (pending?.audience === audience) return pending.value;
    const value = (async () => {
      const response = await fetcher('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience='
        + encodeURIComponent(audience) + '&format=full', {
        headers: { 'Metadata-Flavor': 'Google' }, signal: AbortSignal.timeout(3000), redirect: 'error', cache: 'no-store',
      });
      if (!response.ok || response.headers.get('metadata-flavor') !== 'Google') throw new Error('Identity unavailable');
      const token = await response.text();
      if (token.length > 16384) throw new Error('Invalid identity');
      const claims = JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString('utf8'));
      if (claims.aud !== audience || typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now() + 60000) throw new Error('Invalid identity');
      cached = { audience, token, expires: claims.exp * 1000 };
      return token;
    })();
    pending = { audience, value };
    try { return await value; } finally { if (pending?.value === value) pending = undefined; }
  };
}

const identity = createIdentityProvider();
const requestHeaders = ['accept', 'accept-language', 'authorization', 'cookie', 'content-type', 'x-xsrf-token', 'origin', 'referer', 'range'];
const responseHeaders = ['content-type', 'content-disposition', 'retry-after', 'content-range', 'accept-ranges'];
export const MAX_PROXY_BODY = 65536;

export async function proxyRequest(request: Request, config: ProxyConfig = proxyConfig(),
  fetcher: Fetcher = fetch, tokenProvider: (audience: string) => Promise<string> = identity): Promise<Response> {
  const error = (status: number, code: string) => Response.json({ status, error: code, message: 'Solicitacao nao pode ser processada.' }, {
    status, headers: { 'Cache-Control': 'no-store' },
  });
  const incoming = new URL(request.url);
  if (!incoming.pathname.startsWith('/api/') || /%2f|%5c|%2e|\\/i.test(incoming.pathname)) return error(400, 'INVALID_PATH');
  if (incoming.search.length > 4096 || Number(request.headers.get('content-length') || 0) > MAX_PROXY_BODY) return error(413, 'PAYLOAD_TOO_LARGE');
  if (request.headers.has('content-encoding') && request.headers.get('content-encoding') !== 'identity') return error(415, 'UNSUPPORTED_ENCODING');
  const headers = new Headers();
  for (const name of requestHeaders) { const value = request.headers.get(name); if (value !== null) headers.set(name, value); }
  // Forwarded/Host/Google identity headers supplied by the browser are never trusted.
  headers.set('accept-encoding', 'identity');
  let body: Uint8Array | undefined;
  if (!['GET', 'HEAD'].includes(request.method) && request.body) {
    const reader = request.body.getReader();
    const buffer = new Uint8Array(MAX_PROXY_BODY);
    let total = 0;
    let expired = false;
    let aborted = false;
    const cancel = () => { void reader.cancel().catch(() => {}); };
    const abort = () => { aborted = true; cancel(); };
    const deadline = setTimeout(() => { expired = true; cancel(); }, 10000);
    if (request.signal.aborted) abort();
    else request.signal.addEventListener('abort', abort, { once: true });
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        total += part.value.byteLength;
        if (total > MAX_PROXY_BODY) { cancel(); return error(413, 'PAYLOAD_TOO_LARGE'); }
        buffer.set(part.value, total - part.value.byteLength);
      }
      if (expired) return error(408, 'BODY_TIMEOUT');
      if (aborted) return error(400, 'REQUEST_ABORTED');
      body = buffer.subarray(0, total);
    } catch { return error(400, 'INVALID_BODY'); }
    finally {
      clearTimeout(deadline);
      request.signal.removeEventListener('abort', abort);
      reader.releaseLock();
    }
  }
  try {
    if (config.clientContext) {
      const chain = (request.headers.get('x-forwarded-for') || '').split(',').map(value => value.trim());
      if (chain.length > 10 || chain.length < config.clientContext.hops || chain.some(value => !isIP(value))) return error(403, 'INVALID_CLIENT_CONTEXT');
      const ip = chain[chain.length - config.clientContext.hops];
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = createHmac('sha256', config.clientContext.secret).update(timestamp + '\n' + ip + '\n' + request.method + '\n' + incoming.pathname).digest('hex');
      headers.set('X-Oficina-Client-Context', `v1.${timestamp}.${Buffer.from(ip).toString('base64url')}.${signature}`);
    }
    if (config.iam) headers.set('X-Serverless-Authorization', 'Bearer ' + await tokenProvider(config.origin));
    const upstream = await fetcher(config.origin + incoming.pathname + incoming.search, {
      method: request.method, headers, body: body as BodyInit | undefined, cache: 'no-store', redirect: 'manual',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(30000)]),
    });
    const output = new Headers({ 'Cache-Control': 'no-store' });
    for (const name of responseHeaders) { const value = upstream.headers.get(name); if (value !== null) output.set(name, value); }
    for (const cookie of upstream.headers.getSetCookie()) output.append('set-cookie', cookie);
    const location = upstream.headers.get('location');
    if (location) {
      const redirect = new URL(location, config.origin);
      if (redirect.origin !== config.origin || !redirect.pathname.startsWith('/api/')) { await upstream.body?.cancel(); return error(502, 'INVALID_UPSTREAM_REDIRECT'); }
      output.set('location', redirect.pathname + redirect.search);
    }
    // Stream bytes without buffering PDF/CSV. Never copy upstream IAM or hop-by-hop headers.
    return new Response(request.method === 'HEAD' ? null : upstream.body, { status: upstream.status, headers: output });
  } catch { return error(502, 'BACKEND_UNAVAILABLE'); }
}
