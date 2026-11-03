import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Rewrites are compiled by next build; runtime overrides must never silently diverge. */
export function assertProxyTarget(manifest, runtimeOrigin) {
  const rewrites = Array.isArray(manifest.rewrites) ? manifest.rewrites
    : Object.values(manifest.rewrites ?? {}).flat();
  const target = rewrites.find(rule => rule.source === '/api/:path*')?.destination;
  if (!target || !target.endsWith('/api/:path*')) throw new Error('Proxy /api ausente na imagem.');
  const compiled = target.slice(0, -'/api/:path*'.length);
  if (runtimeOrigin && runtimeOrigin.replace(/\/$/, '') !== compiled) {
    throw new Error('INTERNAL_BACKEND_URL diverge do build. Reconstrua a imagem com o destino correto.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assertProxyTarget(JSON.parse(readFileSync(new URL('./.next/routes-manifest.json', import.meta.url), 'utf8')),
    process.env.INTERNAL_BACKEND_URL);
  await import('./server.js');
}
