/** A proxy target is an origin, never a credential-bearing URL or user input. */
export function validateBackendOrigin(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('INTERNAL_BACKEND_URL deve ser uma origem HTTP(S) valida.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.search || url.hash || url.pathname !== '/' || !url.hostname) {
    throw new Error('INTERNAL_BACKEND_URL deve conter somente a origem, sem credenciais, caminho, query ou fragmento.');
  }
  return url.origin;
}
