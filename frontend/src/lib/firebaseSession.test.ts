import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { firebaseSessionConfig, readFirebaseSession, firebaseBackendCookies, updateFirebaseSession } from '../server/firebaseSession.ts';
import { proxyRequest, proxyConfig } from '../server/backendProxy.ts';
import { assertProxyTarget } from '../../docker-entrypoint.mjs';

const config = { key: randomBytes(32) };
const csrf = 'XSRF-TOKEN=synthetic-csrf; Path=/; Secure; HttpOnly; SameSite=Strict';
const login = ['access_token=synthetic-jwt; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=900',
  'refresh_token=synthetic-refresh; Path=/api/auth; Secure; HttpOnly; SameSite=Strict; Max-Age=604800'];
const incoming = (setCookie: string) => setCookie.split(';')[0];

test('Firebase mode requires an independent runtime encryption key and preserves Cloud Run IAM', () => {
  assert.equal(firebaseSessionConfig({}), undefined);
  assert.throws(() => firebaseSessionConfig({ FIREBASE_HOSTING_MODE: 'true' }));
  assert.throws(() => assertProxyTarget({}, 'https://backend.invalid', { FIREBASE_HOSTING_MODE: 'true' }));
  const secret = randomBytes(32).toString('base64');
  assert.throws(() => firebaseSessionConfig({ FIREBASE_HOSTING_MODE: 'true', FIREBASE_SESSION_SECRET: secret, SERVICE_PROXY_SECRET: secret }));
  assert.throws(() => proxyConfig({ K_SERVICE: 'frontend', CLOUD_RUN_IAM: 'false', FIREBASE_HOSTING_MODE: 'true', FIREBASE_SESSION_SECRET: secret }));
  assert.equal(firebaseSessionConfig({ FIREBASE_HOSTING_MODE: 'true', FIREBASE_SESSION_SECRET: secret })?.key.length, 32);
  assert.doesNotThrow(() => assertProxyTarget({}, 'https://backend.invalid', { FIREBASE_HOSTING_MODE: 'true', FIREBASE_SESSION_SECRET: secret }));
});

test('one encrypted Secure/HttpOnly/Strict cookie restores exact values and refresh path', () => {
  const cookie = updateFirebaseSession([], [csrf, ...login], config, 1000)!;
  assert.match(cookie, /^__session=v1\./); assert.match(cookie, /HttpOnly; Secure; SameSite=Strict; Max-Age=604800$/);
  assert.ok(!cookie.includes('synthetic-'));
  const entries = readFirebaseSession(incoming(cookie), config, 1001);
  assert.equal(firebaseBackendCookies(entries, '/api/clientes'), 'XSRF-TOKEN=synthetic-csrf; access_token=synthetic-jwt');
  assert.match(firebaseBackendCookies(entries, '/api/auth/refresh'), /refresh_token=synthetic-refresh/);
  assert.ok(!firebaseBackendCookies(entries, '/api/auth-evil').includes('refresh_token'));
  assert.equal(updateFirebaseSession(entries, [], config), undefined);
});

test('tampering, wrong keys, duplicate cookies, expiration and untrusted cookies fail closed', () => {
  const cookie = incoming(updateFirebaseSession([], login, config, 1000)!);
  assert.throws(() => readFirebaseSession(cookie, { key: randomBytes(32) }, 1001));
  assert.throws(() => readFirebaseSession(cookie.slice(0, -5) + 'AAAAA', config, 1001));
  assert.throws(() => readFirebaseSession(cookie + '; ' + cookie, config, 1001));
  assert.equal(readFirebaseSession(cookie, config, 1000 + 604801000).length, 0);
  assert.deepEqual(readFirebaseSession('access_token=forgery; refresh_token=forgery', config), []);
  for (const bad of ['access_token=value; Path=/; HttpOnly; SameSite=Lax', 'unexpected=private; Path=/; HttpOnly; Secure; SameSite=Strict',
    'refresh_token=value; Path=/; HttpOnly; Secure; SameSite=Strict', 'access_token=value; Path=/; HttpOnly; Secure; SameSite=None'])
    assert.throws(() => updateFirebaseSession([], [bad], config));
});

test('session-only login stays session-only; refresh rotates; logout removes the full envelope', () => {
  const cookie = updateFirebaseSession([], [csrf, ...login.map(value => value.replace(/; Max-Age=\d+/, ''))], config)!;
  assert.ok(!cookie.includes('Max-Age'));
  const entries = readFirebaseSession(incoming(cookie), config);
  const refreshed = updateFirebaseSession(entries, login.map(value => value.replace('synthetic-refresh', 'rotated-refresh')), config)!;
  assert.match(firebaseBackendCookies(readFirebaseSession(incoming(refreshed), config), '/api/auth/refresh'), /rotated-refresh/);
  const cleared = updateFirebaseSession(entries, ['refresh_token=; Path=/api/auth; HttpOnly; Secure; SameSite=Strict; Max-Age=0'], config)!;
  assert.match(cleared, /^__session=;.*Max-Age=0$/);
  assert.throws(() => updateFirebaseSession([], [login[0].replace('synthetic-jwt', 'x'.repeat(5000))], config));
});

test('Hosting-strip simulation preserves CSRF, IAM, JWT, refresh rotation and PDF/CSV bytes', async () => {
  let cookie = '';
  const call = async (path: string, setCookies: string[], body: string, method = 'GET') => {
    const response = await proxyRequest(new Request('https://site.invalid/api/' + path, { method,
      headers: { Cookie: cookie, 'X-XSRF-TOKEN': 'synthetic-csrf' }, ...(method === 'POST' ? { body: '{}' } : {}) }),
    { origin: 'https://backend.invalid', iam: true, firebaseSession: config }, async (_url, init) => {
      const headers = new Headers(init?.headers);
      assert.equal(headers.get('x-serverless-authorization'), 'Bearer iam-server-only');
      assert.equal(headers.get('x-xsrf-token'), 'synthetic-csrf');
      if (cookie) assert.ok(!headers.get('cookie')?.includes('__session'));
      if (path === 'auth/refresh') assert.match(headers.get('cookie') || '', /refresh_token=synthetic-refresh/);
      if (path === 'export') { assert.match(headers.get('cookie') || '', /access_token=synthetic-jwt/); assert.ok(!headers.get('cookie')?.includes('refresh_token')); }
      const output = new Headers({ 'content-type': 'application/pdf' });
      for (const value of setCookies) output.append('set-cookie', value);
      return new Response(body, { headers: output });
    }, async () => 'iam-server-only');
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(await response.text(), body); assert.equal(response.headers.get('x-serverless-authorization'), null);
    const updated = response.headers.getSetCookie();
    if (updated.length) { assert.equal(updated.length, 1); cookie = incoming(updated[0]); }
  };
  await call('auth/csrf', [csrf], '{"token":"synthetic-csrf"}');
  await call('auth/2fa/verify', login, '{"authenticated":true}', 'POST');
  await call('export', [], '%PDF-synthetic\nCSV,bytes');
  await call('auth/refresh', login.map(value => value.replace('synthetic-refresh', 'rotated-refresh')), '{}', 'POST');
  await call('auth/logout', ['refresh_token=; Path=/api/auth; Secure; HttpOnly; SameSite=Strict; Max-Age=0'], '{}', 'POST');
  assert.equal(cookie, '__session=');
});

test('invalid envelope never reaches backend, returns sanitized error and clears cookie', async () => {
  const response = await proxyRequest(new Request('https://site.invalid/api/clientes', { headers: { Cookie: '__session=PRIVATE-invalid' } }),
    { origin: 'https://backend.invalid', iam: true, firebaseSession: config }, async () => { throw new Error('must not forward'); });
  assert.equal(response.status, 401); assert.ok(!(await response.text()).includes('PRIVATE-invalid'));
  assert.match(response.headers.get('set-cookie') || '', /Max-Age=0/);
});
