import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apiFetch, executeSilentRefresh, extrairMensagemErroLogin } from './api.ts';

test('CSRF 403 preserva a distinção de conta desativada', async () => {
  const csrf = Response.json({ error: 'CSRF_INVALID', message: 'Sessão de segurança expirada. Tente novamente.' }, { status: 403 });
  const disabled = Response.json({ error: 'FORBIDDEN' }, { status: 403 });
  assert.equal(await extrairMensagemErroLogin(csrf), 'Sessão de segurança expirada. Tente novamente.');
  assert.equal(await extrairMensagemErroLogin(disabled), 'Conta desativada. Entre em contato com o suporte.');
});

test('CSRF: navegador obtém um token compartilhado e protege mutações sem repetir 403', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
  const calls: Array<{ url: string; options: RequestInit }> = [];
  let recoverCalls = 0;
  globalThis.fetch = async (input, options) => {
    const url = String(input);
    const config = options || {};
    calls.push({ url, options: config });
    if (url.endsWith('/api/auth/csrf')) return Response.json({ token: 'synthetic-csrf' });
    if (url.endsWith('/api/recover')) {
      recoverCalls++;
      return new Response(null, { status: recoverCalls === 1 ? 401 : 200 });
    }
    if (url.endsWith('/api/fail')) return new Response(null, { status: 403 });
    return new Response(null, { status: 200 });
  };

  try {
    await Promise.all(Array.from({ length: 4 }, () => apiFetch('/api/probe', { method: 'POST' })));
    assert.equal(calls.filter(call => call.url.endsWith('/api/auth/csrf')).length, 1);
    for (const call of calls.filter(call => call.url.endsWith('/api/probe'))) {
      assert.equal(new Headers(call.options.headers).get('X-XSRF-TOKEN'), 'synthetic-csrf');
      assert.equal(call.options.credentials, 'include');
    }

    await apiFetch('/api/read');
    assert.equal(new Headers(calls.at(-1)?.options.headers).has('X-XSRF-TOKEN'), false);
    assert.equal((await apiFetch('/api/fail', { method: 'DELETE' })).status, 403);
    assert.equal(calls.filter(call => call.url.endsWith('/api/fail')).length, 1);

    assert.equal((await apiFetch('/api/recover', { method: 'PATCH' })).status, 200);
    assert.equal(recoverCalls, 2);
    const refresh = calls.find(call => call.url.endsWith('/api/auth/refresh'));
    assert.ok(refresh);
    assert.equal(new Headers(refresh.options.headers).get('X-XSRF-TOKEN'), 'synthetic-csrf');
    assert.equal(await executeSilentRefresh(), true);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
