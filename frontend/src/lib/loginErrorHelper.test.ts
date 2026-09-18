import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extrairMensagemErroLogin, API_URL } from './api.ts';

describe('AUDIT-001 & AUDIT-002: Testes Automatizados de Autenticação e Erros de Login', () => {

  // =========================================================================
  // AUDIT-001: RESOLUÇÃO DE URL DA API E SUPORTE À MESMA ORIGEM
  // =========================================================================
  describe('AUDIT-001: Mesma Origem e Resolução de API_URL', () => {
    it('1. API_URL deve ser uma string definida (relativa ou com host)', () => {
      assert.strictEqual(typeof API_URL, 'string');
    });

    it('2. API_URL não deve introduzir barra final para evitar URLs malformadas', () => {
      assert.strictEqual(API_URL.endsWith('/'), false, 'API_URL não deve terminar com barra');
    });
  });

  // =========================================================================
  // AUDIT-002: TRATAMENTO ROBUSTO DE HTTP 429, 401, 400, 403 E 500
  // =========================================================================
  describe('AUDIT-002: Tratamento de Erros e Lockout HTTP 429 no Login', () => {

    it('3. HTTP 429: Deve extrair a mensagem detalhada enviada pelo backend', async () => {
      const mockResponse = new Response(
        JSON.stringify({
          status: 429,
          error: 'TOO_MANY_REQUESTS',
          message: 'Muitas tentativas incorretas. Conta bloqueada temporariamente. Tente novamente em 14 minuto(s).',
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const mensagem = await extrairMensagemErroLogin(mockResponse);
      assert.strictEqual(
        mensagem,
        'Muitas tentativas incorretas. Conta bloqueada temporariamente. Tente novamente em 14 minuto(s).'
      );
    });

    it('4. HTTP 429: Deve retornar mensagem padrão clara quando o corpo for vazio ou inválido', async () => {
      const mockResponse = new Response('Rate limit exceeded - plain text', {
        status: 429,
        headers: { 'Content-Type': 'text/plain' },
      });

      const mensagem = await extrairMensagemErroLogin(mockResponse);
      assert.strictEqual(
        mensagem,
        'Conta temporariamente bloqueada por excesso de tentativas. Tente novamente mais tarde.'
      );
      assert.notStrictEqual(
        mensagem,
        'Falha de conexão com o servidor. Tente novamente mais tarde.',
        'Não deve exibir mensagem de falha de conexão no erro 429'
      );
    });

    it('5. HTTP 401: Deve retornar mensagem do backend quando disponível', async () => {
      const mockResponse = new Response(
        JSON.stringify({
          status: 401,
          message: 'Credenciais inválidas.',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const mensagem = await extrairMensagemErroLogin(mockResponse);
      assert.strictEqual(mensagem, 'Credenciais inválidas.');
    });

    it('6. HTTP 401: Deve retornar fallback "E-mail ou senha incorretos." se corpo for vazio', async () => {
      const mockResponse = new Response('', { status: 401 });
      const mensagem = await extrairMensagemErroLogin(mockResponse);
      assert.strictEqual(mensagem, 'E-mail ou senha incorretos.');
    });

    it('7. HTTP 400: Deve retornar mensagem de validação quando disponível', async () => {
      const mockResponse = new Response(
        JSON.stringify({
          status: 400,
          message: 'Formato de e-mail inválido.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const mensagem = await extrairMensagemErroLogin(mockResponse);
      assert.strictEqual(mensagem, 'Formato de e-mail inválido.');
    });

    it('8. HTTP 400: Deve retornar fallback "Dados de login inválidos." se corpo for vazio', async () => {
      const mockResponse = new Response('', { status: 400 });
      const mensagem = await extrairMensagemErroLogin(mockResponse);
      assert.strictEqual(mensagem, 'Dados de login inválidos.');
    });

    it('9. HTTP 403: Deve informar conta desativada com orientação ao usuário', async () => {
      const mockResponse = new Response(
        JSON.stringify({ status: 403, message: 'Forbidden' }),
        { status: 403 }
      );

      const mensagem = await extrairMensagemErroLogin(mockResponse);
      assert.strictEqual(mensagem, 'Conta desativada. Entre em contato com o suporte.');
    });

    it('10. HTTP 500 / 502 / outros: Deve exibir falha genérica amigável', async () => {
      const mockResponse500 = new Response(
        JSON.stringify({ status: 500, message: 'Internal Server Error' }),
        { status: 500 }
      );
      const mockResponse502 = new Response('Bad Gateway', { status: 502 });

      const msg500 = await extrairMensagemErroLogin(mockResponse500);
      const msg502 = await extrairMensagemErroLogin(mockResponse502);

      assert.strictEqual(msg500, 'Falha de conexão com o servidor. Tente novamente mais tarde.');
      assert.strictEqual(msg502, 'Falha de conexão com o servidor. Tente novamente mais tarde.');
    });

  });
});
