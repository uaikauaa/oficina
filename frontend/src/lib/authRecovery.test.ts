import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiFetch } from './api.ts';

describe('B03: recuperação da sessão via /api/auth/me', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('access válido consulta /me sem refresh', async () => {
    const calls: string[] = [];
    global.fetch = (async (url: string | URL | Request) => {
      calls.push(url.toString());
      return new Response('{}', { status: 200 });
    }) as typeof fetch;

    assert.equal((await apiFetch('/api/auth/me')).status, 200);
    assert.deepEqual(calls.map((url) => new URL(url, 'https://oficina.invalid').pathname), ['/api/auth/me']);
  });

  it('access expirado ou ausente e refresh válido repetem /me uma vez', async () => {
    let me = 0;
    let refresh = 0;
    global.fetch = (async (url: string | URL | Request) => {
      if (url.toString().endsWith('/api/auth/refresh')) {
        refresh++;
        return new Response(null, { status: 200 });
      }
      me++;
      return new Response(me === 1 ? null : '{}', { status: me === 1 ? 401 : 200 });
    }) as typeof fetch;

    assert.equal((await apiFetch('/api/auth/me')).status, 200);
    assert.equal(me, 2);
    assert.equal(refresh, 1);
  });

  for (const status of [401, 403, 500]) {
    it(`refresh ${status} encerra a tentativa sem loop`, async () => {
      let me = 0;
      let refresh = 0;
      global.fetch = (async (url: string | URL | Request) => {
        if (url.toString().endsWith('/api/auth/refresh')) {
          refresh++;
          return new Response(null, { status });
        }
        me++;
        return new Response(null, { status: 401 });
      }) as typeof fetch;

      assert.equal((await apiFetch('/api/auth/me')).status, 401);
      assert.equal(me, 1);
      assert.equal(refresh, 1);
    });
  }

  it('/me 500 não tenta refresh', async () => {
    let calls = 0;
    global.fetch = (async () => {
      calls++;
      return new Response(null, { status: 500 });
    }) as typeof fetch;
    assert.equal((await apiFetch('/api/auth/me')).status, 500);
    assert.equal(calls, 1);
  });

  it('falha de rede não cria repetição', async () => {
    let calls = 0;
    global.fetch = (async () => {
      calls++;
      throw new Error('offline');
    }) as typeof fetch;
    await assert.rejects(apiFetch('/api/auth/me'));
    assert.equal(calls, 1);
  });

  it('cinco respostas 401 simultâneas compartilham o refresh', async () => {
    let me = 0;
    let refresh = 0;
    global.fetch = (async (url: string | URL | Request) => {
      if (url.toString().endsWith('/api/auth/refresh')) {
        refresh++;
        await new Promise((resolve) => setTimeout(resolve, 25));
        return new Response(null, { status: 200 });
      }
      me++;
      return new Response(null, { status: me <= 5 ? 401 : 200 });
    }) as typeof fetch;

    const responses = await Promise.all(Array.from({ length: 5 }, () => apiFetch('/api/auth/me')));
    assert.ok(responses.every((response) => response.status === 200));
    assert.equal(me, 10);
    assert.equal(refresh, 1);
  });

  it('401 atrasado reutiliza refresh já concluído sem girar o token novamente', async () => {
    let releaseDelayed401!: (response: Response) => void;
    const delayed401 = new Promise<Response>((resolve) => { releaseDelayed401 = resolve; });
    let me = 0;
    let refresh = 0;
    global.fetch = (async (url: string | URL | Request) => {
      if (url.toString().endsWith('/api/auth/refresh')) {
        refresh++;
        return new Response(null, { status: 200 });
      }
      me++;
      if (me === 1) return new Response(null, { status: 401 });
      if (me === 2) return delayed401;
      return new Response('{}', { status: 200 });
    }) as typeof fetch;

    const first = apiFetch('/api/auth/me');
    const second = apiFetch('/api/auth/me');
    assert.equal((await first).status, 200);
    releaseDelayed401(new Response(null, { status: 401 }));
    assert.equal((await second).status, 200);
    assert.equal(refresh, 1);
    assert.equal(me, 4);
  });

  it('login 401 não tenta refresh de si mesmo nem de outras rotas de auth', async () => {
    const calls: string[] = [];
    global.fetch = (async (url: string | URL | Request) => {
      calls.push(url.toString());
      return new Response(null, { status: 401 });
    }) as typeof fetch;

    assert.equal((await apiFetch('/api/auth/login')).status, 401);
    assert.equal((await apiFetch('/api/auth/refresh')).status, 401);
    assert.equal(calls.length, 2);
  });
});
