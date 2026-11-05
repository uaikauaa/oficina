import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OFICINA, formatarEnderecoOficina, formatarContatoOficina } from './oficina.ts';
import { gerarMensagemWhatsappOS } from './whatsappHelper.ts';

test('missing backend configuration never supplies identity or contact in the browser', () => {
  for (const [key, value] of Object.entries(OFICINA)) {
    if (!['nomeSistema', 'nomeFantasia'].includes(key)) assert.equal(value, '', key);
  }
  assert.equal(formatarEnderecoOficina(), '');
  assert.equal(formatarContatoOficina(), '');
});

test('configured synthetic business identity is preserved in documents/messages', () => {
  const text = gerarMensagemWhatsappOS({ numeroOs: 'OS-TEST', clienteNome: 'Cliente Sintetico',
    nomeOficina: 'Empresa Sintetica Configurada', status: 'PRONTA', dataHora: new Date('2026-11-04T12:00:00Z') });
  assert.ok(text.includes('Empresa Sintetica Configurada'));
  assert.ok(!text.includes(OFICINA.nomeFantasia));
});
