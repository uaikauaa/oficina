import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizarTelefoneWhatsapp,
  gerarLinkWhatsappRetirada,
  gerarLinkWhatsappOrcamento,
} from './whatsappHelper.ts';

describe('FEATURE-001: WhatsApp Helper — Testes Unitários', () => {
  describe('sanitizarTelefoneWhatsapp', () => {
    it('deve normalizar telefone formatado com máscara brasileira', () => {
      const res = sanitizarTelefoneWhatsapp('(31) 99999-8888');
      assert.equal(res, '5531999998888');
    });

    it('deve normalizar telefone celular sem máscara', () => {
      const res = sanitizarTelefoneWhatsapp('31999998888');
      assert.equal(res, '5531999998888');
    });

    it('deve manter telefone já com DDI 55', () => {
      const res = sanitizarTelefoneWhatsapp('5531999998888');
      assert.equal(res, '5531999998888');
    });

    it('deve normalizar telefone fixo de 10 dígitos com DDD', () => {
      const res = sanitizarTelefoneWhatsapp('(31) 3333-4444');
      assert.equal(res, '553133334444');
    });

    it('deve retornar null para telefone vazio, espaços ou nulo', () => {
      assert.equal(sanitizarTelefoneWhatsapp(''), null);
      assert.equal(sanitizarTelefoneWhatsapp('   '), null);
      assert.equal(sanitizarTelefoneWhatsapp(null), null);
      assert.equal(sanitizarTelefoneWhatsapp(undefined), null);
    });

    it('deve retornar null para telefone com dígitos insuficientes (sem DDD)', () => {
      assert.equal(sanitizarTelefoneWhatsapp('9999-8888'), null);
      assert.equal(sanitizarTelefoneWhatsapp('123'), null);
      assert.equal(sanitizarTelefoneWhatsapp('abc'), null);
    });
  });

  describe('gerarLinkWhatsappRetirada', () => {
    it('deve gerar URL completa wa.me com mensagem pré-preenchida', () => {
      const params = {
        telefone: '(31) 98888-7777',
        clienteNome: 'Carlos Silva',
        equipamentoModelo: 'Smashweld 450',
        numeroOs: 'OS-2026-001',
        valorTotal: 450.0,
      };

      const res = gerarLinkWhatsappRetirada(params);
      assert.ok(res.url);
      assert.ok(res.url.startsWith('https://wa.me/5531988887777?text='));
      assert.ok(res.mensagem.includes('Carlos Silva'));
      assert.ok(res.mensagem.includes('Smashweld 450'));
      assert.ok(res.mensagem.includes('OS-2026-001'));
      assert.ok(res.mensagem.includes('450,00'));
    });

    it('deve codificar corretamente caracteres com acentos, espaços e quebras de linha', () => {
      const params = {
        telefone: '31977776666',
        clienteNome: 'João Construtora & Locações',
        equipamentoModelo: 'Gerador Toyama 5.5 kVA Diesel',
        numeroOs: 'OS-2026-099',
        valorTotal: 1250.5,
      };

      const res = gerarLinkWhatsappRetirada(params);
      assert.ok(res.url);

      // Decodifica a URL para verificar que o texto original preserva os caracteres
      const urlObj = new URL(res.url);
      const textParam = urlObj.searchParams.get('text');
      assert.ok(textParam);
      assert.ok(textParam.includes('João Construtora & Locações'));
      assert.ok(textParam.includes('Gerador Toyama 5.5 kVA Diesel'));
      assert.ok(textParam.includes('OS-2026-099'));
    });

    it('deve prevenir XSS e injeção de tags HTML na URL gerada', () => {
      const params = {
        telefone: '(31) 98888-0000',
        clienteNome: '<script>alert("xss")</script>',
        equipamentoModelo: 'Máquina "ESAB" 250A',
        numeroOs: 'OS-XSS',
        valorTotal: 100,
      };

      const res = gerarLinkWhatsappRetirada(params);
      assert.ok(res.url);
      // Confirma que não há tags HTML literais na URL (elas devem estar estritamente percent-encoded)
      assert.ok(!res.url.includes('<script>'));
      assert.ok(res.url.includes('%3Cscript%3E'));
    });

    it('deve retornar url nula e mensagem de erro amigável quando telefone for inválido', () => {
      const params = {
        telefone: 'invalido',
        clienteNome: 'Maria Santos',
        equipamentoModelo: 'Inversora Vulcan',
        numeroOs: 'OS-2026-012',
        valorTotal: 200,
      };

      const res = gerarLinkWhatsappRetirada(params);
      assert.equal(res.url, null);
      assert.ok(res.erro);
      assert.ok(res.mensagem.includes('Maria Santos'));
    });
  });

  describe('gerarLinkWhatsappOrcamento', () => {
    it('deve gerar link de aprovação com peças, mão de obra e total', () => {
      const params = {
        telefone: '(31) 98888-7777',
        clienteNome: 'Carlos Silva',
        equipamentoModelo: 'Inversora TIG 200',
        numeroOs: 'OS-2026-042',
        valorPecas: 180.0,
        valorMaoObra: 250.0,
        valorTotal: 430.0,
      };

      const res = gerarLinkWhatsappOrcamento(params);
      assert.ok(res.url);
      assert.ok(res.url.startsWith('https://wa.me/5531988887777?text='));
      assert.ok(res.mensagem.includes('Carlos Silva'));
      assert.ok(res.mensagem.includes('Inversora TIG 200'));
      assert.ok(res.mensagem.includes('OS-2026-042'));
      assert.ok(res.mensagem.includes('180,00'));
      assert.ok(res.mensagem.includes('250,00'));
      assert.ok(res.mensagem.includes('430,00'));
    });

    it('deve retornar erro amigável se telefone for inválido', () => {
      const params = {
        telefone: '',
        clienteNome: 'Carlos Silva',
        equipamentoModelo: 'Gerador 5kVA',
        numeroOs: 'OS-2026-042',
        valorPecas: 100,
        valorMaoObra: 150,
        valorTotal: 250,
      };

      const res = gerarLinkWhatsappOrcamento(params);
      assert.equal(res.url, null);
      assert.ok(res.erro);
    });
  });
});

