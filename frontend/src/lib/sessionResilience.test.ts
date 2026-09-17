import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { executeSilentRefresh, sanitizarRedirect } from './api.ts';
import {
  obterAgoraLocalDatetimeInput,
  converterDatetimeLocalParaIsoComOffset,
  formatarDataInicioParaApi,
  formatarDataFimParaApi,
  formatarDataLocalYmd,
  calcularIntervaloPreset,
  OFFSET_PADRAO_SP,
} from './relatorioDateHelper.ts';

describe('UX-009: Estabilização e Resiliência — Testes Automatizados', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // =========================================================================
  // 1. RESILIÊNCIA DE SESSÃO: MUTEX / DEDUPLICAÇÃO DE REFRESH SILENCIOSO
  // =========================================================================
  describe('ISSUE-01: Deduplicação Concorrente de Refresh de Sessão', () => {
    it('1. Duas requisições simultâneas devem disparar apenas 1 requisição física de refresh', async () => {
      let chamadasFetch = 0;
      global.fetch = (async (url: string | URL | Request) => {
        if (url.toString().includes('/api/auth/refresh')) {
          chamadasFetch++;
          // Simula pequena latência de rede
          await new Promise((resolve) => setTimeout(resolve, 30));
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        return new Response(null, { status: 404 });
      }) as typeof fetch;

      // Executa 2 chamadas concorrentes
      const [res1, res2] = await Promise.all([
        executeSilentRefresh(),
        executeSilentRefresh(),
      ]);

      assert.equal(res1, true);
      assert.equal(res2, true);
      assert.equal(chamadasFetch, 1, 'Deve realizar exatamente 1 chamada de refresh ao servidor');
    });

    it('2. Cinco requisições concorrentes devem compartilhar a mesma Promise de refresh', async () => {
      let chamadasFetch = 0;
      global.fetch = (async (url: string | URL | Request) => {
        if (url.toString().includes('/api/auth/refresh')) {
          chamadasFetch++;
          await new Promise((resolve) => setTimeout(resolve, 20));
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        return new Response(null, { status: 404 });
      }) as typeof fetch;

      const promises = Array.from({ length: 5 }, () => executeSilentRefresh());
      const resultados = await Promise.all(promises);

      assert.equal(chamadasFetch, 1);
      assert.equal(resultados.every((r) => r === true), true);
    });

    it('3. Dez requisições concorrentes devem disparar apenas 1 chamada HTTP', async () => {
      let chamadasFetch = 0;
      global.fetch = (async (url: string | URL | Request) => {
        if (url.toString().includes('/api/auth/refresh')) {
          chamadasFetch++;
          await new Promise((resolve) => setTimeout(resolve, 15));
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        return new Response(null, { status: 404 });
      }) as typeof fetch;

      const promises = Array.from({ length: 10 }, () => executeSilentRefresh());
      const resultados = await Promise.all(promises);

      assert.equal(chamadasFetch, 1);
      assert.equal(resultados.length, 10);
      assert.equal(resultados.every((r) => r === true), true);
    });

    it('4. Falha na renovação deve retornar false e resetar o mutex para requisições subsequentes', async () => {
      let chamadasFetch = 0;
      global.fetch = (async (url: string | URL | Request) => {
        if (url.toString().includes('/api/auth/refresh')) {
          chamadasFetch++;
          return new Response(JSON.stringify({ message: 'Refresh token expirado' }), { status: 401 });
        }
        return new Response(null, { status: 404 });
      }) as typeof fetch;

      const resFalha = await executeSilentRefresh();
      assert.equal(resFalha, false);
      assert.equal(chamadasFetch, 1);

      // Nova tentativa subsequente deve poder chamar novamente sem travar no mutex
      const resSegundaTentativa = await executeSilentRefresh();
      assert.equal(resSegundaTentativa, false);
      assert.equal(chamadasFetch, 2, 'Mutex foi devidamente resetado e permitiu nova tentativa');
    });

    it('5. Erro de rede ou exceção não tratada deve resolver false de forma resiliente', async () => {
      global.fetch = (async () => {
        throw new Error('Network error');
      }) as typeof fetch;

      const res = await executeSilentRefresh();
      assert.equal(res, false);
    });
  });

  // =========================================================================
  // 2. HARMONIZAÇÃO TEMPORAL: NOVA OS & FILTROS DE DATA
  // =========================================================================
  describe('ISSUE-02 & 03 & 05: Harmonização Temporal e Offset São Paulo', () => {
    it('6. obterAgoraLocalDatetimeInput deve gerar formato compativel com input datetime-local (YYYY-MM-DDTHH:mm)', () => {
      const agoraStr = obterAgoraLocalDatetimeInput();
      assert.match(agoraStr, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });

    it('7. converterDatetimeLocalParaIsoComOffset preserva horário noturno (21h30) sem converter para dia seguinte', () => {
      // 21h30 em horário local de São Paulo
      const input = '2026-09-17T21:30';
      const isoComOffset = converterDatetimeLocalParaIsoComOffset(input);
      assert.equal(isoComOffset, '2026-09-17T21:30:00-03:00');
      // Não deve ter sido convertido para 00:30 do dia 18
      assert.ok(!isoComOffset.includes('2026-09-18'));
      assert.ok(!isoComOffset.endsWith('Z'));
    });

    it('8. converterDatetimeLocalParaIsoComOffset preserva horário 23h45 no mesmo dia com offset', () => {
      const input = '2026-09-17T23:45';
      const isoComOffset = converterDatetimeLocalParaIsoComOffset(input);
      assert.equal(isoComOffset, '2026-09-17T23:45:00-03:00');
    });

    it('9. converterDatetimeLocalParaIsoComOffset preserva horário logo após meia-noite (00h15)', () => {
      const input = '2026-09-18T00:15';
      const isoComOffset = converterDatetimeLocalParaIsoComOffset(input);
      assert.equal(isoComOffset, '2026-09-18T00:15:00-03:00');
    });

    it('10. converterDatetimeLocalParaIsoComOffset trata entradas vazias ou com segundos', () => {
      assert.equal(converterDatetimeLocalParaIsoComOffset(''), undefined);
      assert.equal(converterDatetimeLocalParaIsoComOffset('   '), undefined);
      assert.equal(converterDatetimeLocalParaIsoComOffset(null), undefined);
      // Se já vier com segundos:
      const comSegundos = converterDatetimeLocalParaIsoComOffset('2026-09-17T14:30:45');
      assert.equal(comSegundos, '2026-09-17T14:30:45-03:00');
    });

    it('11. formatarDataInicioParaApi e formatarDataFimParaApi usam fuso correto para filtros de estoque e OS', () => {
      const inicio = formatarDataInicioParaApi('2026-09-01');
      const fim = formatarDataFimParaApi('2026-09-30');

      assert.equal(inicio, `2026-09-01T00:00:00${OFFSET_PADRAO_SP}`);
      assert.equal(fim, `2026-09-30T23:59:59${OFFSET_PADRAO_SP}`);
      assert.ok(!inicio.endsWith('Z'));
      assert.ok(!fim.endsWith('Z'));
    });

    it('11.1. formatarDataLocalYmd preserva o dia civil de São Paulo mesmo em horário noturno (23h45 UTC-3 = 02h45 UTC do dia seguinte)', () => {
      // 2026-09-17 23:45 em São Paulo equivale a 2026-09-18 02:45 UTC
      const dataNoturna = new Date('2026-09-18T02:45:00Z');
      const localYmd = formatarDataLocalYmd(dataNoturna);
      assert.equal(localYmd, '2026-09-17', 'Em São Paulo ainda deve ser 17/09 e não 18/09');
    });

    it('11.2. calcularIntervaloPreset (7dias e 30dias) calcula corretamente os limites sem toISOString drift', () => {
      const dataRef = new Date('2026-09-18T02:45:00Z'); // 23h45 de 17/09/2026 em SP
      const p7 = calcularIntervaloPreset('7dias', dataRef);
      assert.equal(p7.dataFim, '2026-09-17');
      assert.equal(p7.dataInicio, '2026-09-11');

      const p30 = calcularIntervaloPreset('30dias', dataRef);
      assert.equal(p30.dataFim, '2026-09-17');
      assert.equal(p30.dataInicio, '2026-08-19');
    });
  });

  // =========================================================================
  // 3. SEGURANÇA: SANITIZAÇÃO DE REDIRECT NO LOGIN (OPEN REDIRECT)
  // =========================================================================
  describe('ISSUE-06: Prevenção de Open Redirect no Login', () => {
    it('12. Permite caminhos internos relativos seguros', () => {
      assert.equal(sanitizarRedirect('/dashboard'), '/dashboard');
      assert.equal(sanitizarRedirect('/ordens-servico'), '/ordens-servico');
      assert.equal(sanitizarRedirect('/maquinas/5'), '/maquinas/5');
      assert.equal(sanitizarRedirect('/clientes?busca=silva'), '/clientes?busca=silva');
    });

    it('13. Bloqueia e faz fallback para URLs externas com protocolo absoluto (http/https)', () => {
      assert.equal(sanitizarRedirect('https://malicious-site.com'), '/dashboard');
      assert.equal(sanitizarRedirect('http://attacker.com/steal'), '/dashboard');
      assert.equal(sanitizarRedirect('https://evil.com/dashboard'), '/dashboard');
    });

    it('14. Bloqueia protocol-relative URLs (//malicious-site.com)', () => {
      assert.equal(sanitizarRedirect('//malicious-site.com'), '/dashboard');
      assert.equal(sanitizarRedirect('//google.com'), '/dashboard');
    });

    it('15. Bloqueia esquemas perigosos (javascript:, data:) e valores nulos ou vazios', () => {
      assert.equal(sanitizarRedirect('javascript:alert(1)'), '/dashboard');
      assert.equal(sanitizarRedirect('data:text/html,evil'), '/dashboard');
      assert.equal(sanitizarRedirect(''), '/dashboard');
      assert.equal(sanitizarRedirect('   '), '/dashboard');
      assert.equal(sanitizarRedirect(null), '/dashboard');
    });
  });
});
