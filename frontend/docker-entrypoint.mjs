import { pathToFileURL } from 'node:url';

/** The handler reads this runtime target; no backend origin or token enters a browser bundle.
 * @param {unknown} _manifest
 * @param {string | undefined} runtimeOrigin
 * @param {Record<string, string | undefined>} env
 */
export function assertProxyTarget(_manifest, runtimeOrigin, env = process.env) {
  let target;
  try { target = new URL(runtimeOrigin); } catch { throw new Error('INTERNAL_BACKEND_URL obrigatoria.'); }
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || target.pathname !== '/' || target.search || target.hash) {
    throw new Error('Origem backend invalida.');
  }
  if (env.K_SERVICE && env.CLOUD_RUN_IAM === 'false') throw new Error('Cloud Run requer identidade de servico.');
  if ((env.K_SERVICE || env.CLOUD_RUN_IAM === 'true') && target.protocol !== 'https:') throw new Error('Backend Cloud Run requer HTTPS.');
  if (env.K_SERVICE && (!(Number(env.TRUSTED_PROXY_HOPS) >= 1 && Number(env.TRUSTED_PROXY_HOPS) <= 5)
      || !Number.isInteger(Number(env.TRUSTED_PROXY_HOPS)) || !env.SERVICE_PROXY_SECRET || env.SERVICE_PROXY_SECRET.length < 32)) {
    throw new Error('Cloud Run requer cadeia de proxies validada e SERVICE_PROXY_SECRET.');
  }
  if (target.protocol === 'http:' && !['localhost', '127.0.0.1', 'backend', '[::1]'].includes(target.hostname)) throw new Error('HTTP somente local.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assertProxyTarget(null, process.env.INTERNAL_BACKEND_URL);
  await import('./server.js');
}
