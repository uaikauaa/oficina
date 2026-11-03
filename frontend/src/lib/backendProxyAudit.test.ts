import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIdentityProvider, proxyRequest } from '../server/backendProxy.ts';

test('metadata with wrong audience, expiry or flavor is never accepted as service identity', async () => {
  for (const claims of [{ aud: 'https://wrong.invalid', exp: Date.now() / 1000 + 3600 },
    { aud: 'https://backend.invalid', exp: 1 }, { aud: 'https://backend.invalid' }]) {
    const token = 'synthetic.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.signature';
    const provider = createIdentityProvider(async () => new Response(token, { headers: { 'Metadata-Flavor': 'Google' } }));
    await assert.rejects(provider('https://backend.invalid'));
  }
  await assert.rejects(createIdentityProvider(async () => new Response('untrusted'))('https://backend.invalid'));
});

test('an unfinished request body must expire without reaching the backend', async () => {
  let finish = () => {};
  const stream = new ReadableStream<Uint8Array>({ start(controller) { finish = () => controller.close(); },
    cancel() { return new Promise(() => {}); } });
  const request = new Request('http://localhost/api/audit', { method: 'POST', body: stream, duplex: 'half' } as RequestInit);
  let forwarded = false;
  const operation = proxyRequest(request, { origin: 'https://backend.invalid', iam: false }, async () => {
    forwarded = true; return new Response('{}');
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const status = await Promise.race([operation.then(response => response.status),
      new Promise(resolve => { timer = setTimeout(() => resolve('STILL_WAITING'), 11000); })]);
    assert.equal(status, 408, 'Untrusted body reading needs a bounded deadline before IAM/backend work');
    assert.equal(forwarded, false);
  } finally {
    clearTimeout(timer);
    try { finish(); } catch {}
    await operation;
  }
});

test('broken request streams produce a bounded generic error without forwarding', async () => {
  const body = new ReadableStream<Uint8Array>({ start(controller) { controller.error(new Error('synthetic-private-stream-detail')); } });
  const response = await proxyRequest(new Request('http://localhost/api/audit', { method: 'POST', body, duplex: 'half' } as RequestInit),
    { origin: 'https://backend.invalid', iam: false }, async () => { throw new Error('must not forward'); });
  assert.equal(response.status, 400);
  assert.ok(!(await response.text()).includes('private-stream-detail'));
});
