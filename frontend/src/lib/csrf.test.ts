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


test('CSRF: operações sequenciais não reutilizam token após troca do cookie', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
  let currentCookieToken = 'csrf-1';
  let csrfRequests = 0;
  let writes = 0;
  let refreshes = 0;
  const headersReceived: string[] = [];
  globalThis.fetch = async (input, options) => {
    const url = String(input);
    if (url.endsWith('/api/auth/csrf')) {
      csrfRequests++;
      return Response.json({ token: currentCookieToken });
    }
    if (url.endsWith('/api/auth/refresh')) {
      refreshes++;
      return new Response(null, { status: 401 });
    }
    if (url.endsWith('/api/save') || url.endsWith('/api/auth/logout')) {
      writes++;
      const csrfHeader = new Headers(options?.headers).get('X-XSRF-TOKEN') ?? '';
      headersReceived.push(csrfHeader);
      if (csrfHeader !== currentCookieToken) {
        return Response.json({ error: 'CSRF_INVALID' }, { status: 403 });
      }
      // Simula troca de cookie no backend por outra operação ou aba.
      currentCookieToken = `csrf-${writes + 1}`;
      return new Response(null, { status: 204 });
    }
    return new Response(null, { status: 404 });
  };
  try {
    assert.equal((await apiFetch('/api/save', { method: 'POST' })).status, 204);
    assert.equal((await apiFetch('/api/save', { method: 'PUT' })).status, 204);
    assert.equal((await apiFetch('/api/auth/logout', { method: 'POST' })).status, 204);
    assert.deepEqual(headersReceived, ['csrf-1', 'csrf-2', 'csrf-3']);
    assert.equal(csrfRequests, 3);
    assert.equal(writes, 3, 'Não deve repetir nenhuma operação por falha de CSRF');
    assert.equal(refreshes, 0, 'Não deve acionar refresh de JWT desnecessariamente');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('CSRF: refresh após 401 exige novo token na repetição autenticada', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
  let cookieToken = 'csrf-inicial';
  let protectedCalls = 0;
  let refreshCalls = 0;
  const protectedTokens: string[] = [];
  globalThis.fetch = async (input, options) => {
    const url = String(input);
    if (url.endsWith('/api/auth/csrf')) return Response.json({ token: cookieToken });
    if (url.endsWith('/api/auth/refresh')) {
      refreshCalls++;
      assert.equal(new Headers(options?.headers).get('X-XSRF-TOKEN'), 'csrf-inicial');
      cookieToken = 'csrf-renovado';
      return new Response(null, { status: 200 });
    }
    if (url.endsWith('/api/protected')) {
      protectedCalls++;
      const header = new Headers(options?.headers).get('X-XSRF-TOKEN') ?? '';
      protectedTokens.push(header);
      if (protectedCalls === 1) return new Response(null, { status: 401 });
      return new Response(null, { status: header === cookieToken ? 200 : 403 });
    }
    return new Response(null, { status: 404 });
  };
  try {
    assert.equal((await apiFetch('/api/protected', { method: 'PATCH' })).status, 200);
    assert.deepEqual(protectedTokens, ['csrf-inicial', 'csrf-renovado']);
    assert.equal(protectedCalls, 2);
    assert.equal(refreshCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
