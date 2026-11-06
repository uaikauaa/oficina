// Firebase Hosting forwards only __session. Keep JWT/refresh/CSRF server-side in
// an authenticated encrypted envelope; Spring still validates every token/CSRF.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export type FirebaseSessionConfig = { key: Buffer };
type Entry = { name: string; value: string; path: string; expires: number; persistent: boolean };
const paths: Record<string, string> = { access_token: '/', refresh_token: '/api/auth', 'XSRF-TOKEN': '/' };
const aad = Buffer.from('oficina/firebase-hosting/session/v1');
const MAX_COOKIE = 3800;
const MAX_LIFETIME = 7 * 86400;
const fail = () => new Error('Invalid hosting session');

export function firebaseSessionConfig(env: Record<string, string | undefined>): FirebaseSessionConfig | undefined {
  if (!env.FIREBASE_HOSTING_MODE || env.FIREBASE_HOSTING_MODE === 'false') return undefined;
  if (env.FIREBASE_HOSTING_MODE !== 'true' || !/^[A-Za-z0-9+/]{43}=$/.test(env.FIREBASE_SESSION_SECRET || '')) throw fail();
  const key = Buffer.from(env.FIREBASE_SESSION_SECRET!, 'base64');
  if (key.length !== 32 || env.FIREBASE_SESSION_SECRET === env.SERVICE_PROXY_SECRET) throw fail();
  return { key };
}

export function readFirebaseSession(header: string | null, config: FirebaseSessionConfig, now = Date.now()): Entry[] {
  const cookies = (header || '').split(';').map(value => value.trim()).filter(value => value.startsWith('__session='));
  if (!cookies.length) return [];
  if (cookies.length !== 1) throw fail();
  const encoded = cookies[0].slice('__session='.length);
  if (!/^v1\.[A-Za-z0-9_-]+$/.test(encoded) || encoded.length > MAX_COOKIE) throw fail();
  try {
    const bytes = Buffer.from(encoded.slice(3), 'base64url');
    if (bytes.length < 29) throw fail();
    const decipher = createDecipheriv('aes-256-gcm', config.key, bytes.subarray(0, 12));
    decipher.setAAD(aad); decipher.setAuthTag(bytes.subarray(12, 28));
    const entries: Entry[] = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'));
    if (!Array.isArray(entries) || entries.length > 3) throw fail();
    const seen = new Set();
    for (const entry of entries) {
      if (!entry || !Object.hasOwn(paths, entry.name) || seen.has(entry.name) || entry.path !== paths[entry.name]
          || typeof entry.value !== 'string' || !/^[\x21\x23-\x2b\x2d-\x3a\x3c-\x5b\x5d-\x7e]+$/.test(entry.value)
          || !Number.isSafeInteger(entry.expires) || entry.expires > now + MAX_LIFETIME * 1000
          || typeof entry.persistent !== 'boolean') throw fail();
      seen.add(entry.name);
    }
    return entries.filter(entry => entry.expires > now);
  } catch { throw fail(); }
}

export function firebaseBackendCookies(entries: Entry[], pathname: string): string {
  return entries.filter(entry => entry.path === '/' || pathname === entry.path || pathname.startsWith(entry.path + '/'))
    .map(entry => `${entry.name}=${entry.value}`).join('; ');
}

export function updateFirebaseSession(entries: Entry[], upstreamCookies: string[], config: FirebaseSessionConfig, now = Date.now()): string | undefined {
  if (!upstreamCookies.length) return undefined; // No rewriting stale snapshots on normal concurrent reads.
  const jar = new Map(entries.map(entry => [entry.name, entry]));
  for (const cookie of upstreamCookies) {
    const parts = cookie.split(';').map(part => part.trim());
    const split = parts[0].indexOf('=');
    const name = parts[0].slice(0, split), value = parts[0].slice(split + 1);
    if (split < 1 || !Object.hasOwn(paths, name)) throw fail();
    const attributes = new Map(parts.slice(1).map(part => {
      const index = part.indexOf('=');
      return [part.slice(0, index < 0 ? undefined : index).toLowerCase(), index < 0 ? '' : part.slice(index + 1)];
    }));
    if (!attributes.has('secure') || !attributes.has('httponly') || attributes.has('domain')
        || attributes.get('path') !== paths[name] || !['Lax', 'Strict'].includes(attributes.get('samesite') || '')) throw fail();
    const age = attributes.has('max-age') ? Number(attributes.get('max-age')) : undefined;
    if (age !== undefined && (!Number.isSafeInteger(age) || age > MAX_LIFETIME)) throw fail();
    if (age !== undefined && age <= 0 || !value) { jar.delete(name); continue; }
    if (!/^[\x21\x23-\x2b\x2d-\x3a\x3c-\x5b\x5d-\x7e]+$/.test(value)) throw fail();
    // Session-only cookies remain browser-session-only; an internal bound avoids immortal envelopes.
    jar.set(name, { name, value, path: paths[name], expires: now + (age ?? MAX_LIFETIME) * 1000, persistent: age !== undefined });
  }
  const current = [...jar.values()].filter(entry => entry.expires > now);
  // Logout must clear the entire envelope, including the pre-auth CSRF cookie.
  if (!current.length || upstreamCookies.some(cookie => cookie.startsWith('refresh_token=') && /max-age=0(?:;|$)/i.test(cookie)))
    return '__session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', config.key, nonce); cipher.setAAD(aad);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(current), 'utf8'), cipher.final()]);
  const encoded = 'v1.' + Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString('base64url');
  if (encoded.length > MAX_COOKIE) throw fail();
  const authentication = current.filter(entry => entry.name !== 'XSRF-TOKEN');
  const persistent = authentication.length > 0 && authentication.every(entry => entry.persistent);
  const maxAge = persistent ? `; Max-Age=${Math.floor((Math.max(...authentication.map(entry => entry.expires)) - now) / 1000)}` : '';
  return `__session=${encoded}; Path=/; HttpOnly; Secure; SameSite=Strict${maxAge}`;
}
