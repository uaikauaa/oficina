import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proxyRequest, proxyConfig, createIdentityProvider, MAX_PROXY_BODY } from '../server/backendProxy.ts';
import { createHmac } from 'node:crypto';

test('Cloud Run cannot disable identity or use HTTP; local HTTP is restricted', () => {
  assert.throws(() => proxyConfig({ NODE_ENV: 'production' }));
  assert.throws(() => proxyConfig({ K_SERVICE: 'test', CLOUD_RUN_IAM: 'false', INTERNAL_BACKEND_URL: 'https://backend.invalid' }));
  assert.throws(() => proxyConfig({ K_SERVICE: 'test', INTERNAL_BACKEND_URL: 'http://localhost:8080' }));
  assert.throws(() => proxyConfig({ INTERNAL_BACKEND_URL: 'http://outside.invalid' }));
  assert.equal(proxyConfig({ K_SERVICE: 'test', INTERNAL_BACKEND_URL: 'https://backend.invalid',
    SERVICE_PROXY_SECRET: 'synthetic-shared-service-context-secret-2026', TRUSTED_PROXY_HOPS: '1' }).iam, true);
});

test('client IP context is newly signed from the configured trusted suffix, never copied from the browser', async () => {
  const secret = 'synthetic-shared-service-context-secret-2026';
  const response = await proxyRequest(new Request('https://frontend.invalid/api/test', { headers: {
    'x-forwarded-for': '198.51.100.99, 203.0.113.20', 'X-Oficina-Client-Context': 'forged-browser-context',
  } }), { origin: 'https://backend.invalid', iam: true, clientContext: { secret, hops: 1 } }, async (_url, init) => {
    const header = new Headers(init?.headers).get('X-Oficina-Client-Context')!;
    const [version, timestamp, encodedIp, signature] = header.split('.');
    assert.equal(version, 'v1');
    assert.equal(Buffer.from(encodedIp, 'base64url').toString(), '203.0.113.20');
    assert.equal(signature, createHmac('sha256', secret).update(timestamp + '\n203.0.113.20\nGET\n/api/test').digest('hex'));
    return new Response('{}', { headers: { 'X-Oficina-Client-Context': header } });
  }, async () => 'synthetic-identity');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('X-Oficina-Client-Context'), null);
});

test('proxy preserves methods, application JWT, CSRF and exact PDF/CSV bytes; IAM stays server-side', async () => {
  for (const method of ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE']) {
    const response = await proxyRequest(new Request('http://localhost/api/echo?q=synthetic', {
      method, headers: { Cookie: 'access_token=app-cookie', Authorization: 'Bearer app-jwt', 'X-XSRF-TOKEN': 'csrf',
        'X-Serverless-Authorization': 'Bearer browser-forgery', 'X-Forwarded-For': 'forged' },
      ...(!['GET', 'HEAD'].includes(method) ? { body: '{"synthetic":true}' } : {}),
    }), { origin: 'https://backend.invalid', iam: true }, async (url, init) => {
      assert.equal(url, 'https://backend.invalid/api/echo?q=synthetic');
      assert.equal(init?.method, method);
      const headers = new Headers(init?.headers);
      assert.equal(headers.get('authorization'), 'Bearer app-jwt');
      assert.equal(headers.get('cookie'), 'access_token=app-cookie');
      assert.equal(headers.get('x-xsrf-token'), 'csrf');
      assert.equal(headers.get('x-serverless-authorization'), 'Bearer server-only-google-identity');
      assert.equal(headers.get('x-forwarded-for'), null);
      const output = new Headers({ 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="synthetic.pdf"',
        'x-serverless-authorization': 'never-return-this' });
      output.append('set-cookie', 'access_token=synthetic; HttpOnly; Secure; Path=/');
      output.append('set-cookie', 'refresh_token=synthetic; HttpOnly; Secure; Path=/api/auth');
      return new Response(method === 'HEAD' ? null : '%PDF-synthetic\nCSV,bytes', { headers: output });
    }, async audience => { assert.equal(audience, 'https://backend.invalid'); return 'server-only-google-identity'; });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-serverless-authorization'), null);
    assert.equal(response.headers.getSetCookie().length, 2);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(await response.text(), method === 'HEAD' ? '' : '%PDF-synthetic\nCSV,bytes');
  }
});

test('proxy preserves application errors and Retry-After, rejects foreign redirects, oversized and chunked bodies', async () => {
  for (const status of [401, 403, 404, 429, 500]) {
    const response = await proxyRequest(new Request('http://localhost/api/error'), { origin: 'https://backend.invalid', iam: false },
      async () => new Response('{"synthetic":true}', { status, headers: { 'retry-after': '23' } }));
    assert.equal(response.status, status); assert.equal(response.headers.get('retry-after'), '23');
    assert.equal(await response.text(), '{"synthetic":true}');
  }
  const redirect = await proxyRequest(new Request('http://localhost/api/error'), { origin: 'https://backend.invalid', iam: false },
    async () => new Response(null, { status: 302, headers: { location: 'https://attacker.invalid/' } }));
  assert.equal(redirect.status, 502);
  const oversized = await proxyRequest(new Request('http://localhost/api/large', { method: 'POST', body: 'x'.repeat(MAX_PROXY_BODY + 1) }),
    { origin: 'https://backend.invalid', iam: false }, async () => { throw new Error('must not forward'); });
  assert.equal(oversized.status, 413);
});

test('metadata identity is audience-bound, cached and single-flight; failure never falls back to unauthenticated', async () => {
  let calls = 0;
  const token = 'synthetic.' + Buffer.from(JSON.stringify({ aud: 'https://backend.invalid', exp: Date.now() / 1000 + 3600 })).toString('base64url') + '.signature';
  const provider = createIdentityProvider(async (url, init) => {
    calls++; assert.ok(String(url).startsWith('http://metadata.google.internal/computeMetadata/'));
    assert.equal(new Headers(init?.headers).get('metadata-flavor'), 'Google');
    return new Response(token, { headers: { 'Metadata-Flavor': 'Google' } });
  });
  assert.deepEqual(await Promise.all(Array.from({ length: 8 }, () => provider('https://backend.invalid'))), Array(8).fill(token));
  assert.equal(calls, 1);
  const response = await proxyRequest(new Request('http://localhost/api/test'), { origin: 'https://backend.invalid', iam: true },
    async () => { throw new Error('must not send unauthenticated'); }, async () => { throw new Error('secret-value'); });
  assert.equal(response.status, 502); assert.ok(!(await response.text()).includes('secret-value'));
});
