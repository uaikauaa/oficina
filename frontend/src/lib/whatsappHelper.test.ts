import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { StatusOrdemServico } from './types.ts';
import {
  sanitizarTelefoneWhatsapp,
  formatarMoedaWhatsapp,
  obterSaudacaoPorHorario,
  formatarStatusAmigavel,
  gerarMensagemWhatsappOS,
  gerarLinkWhatsappOS,
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
      assert.ok(res.mensagem.includes('pronta para retirada'));
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
      assert.ok(res.mensagem.includes('orçamento'));
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

describe('Melhoria Completa: Mensagens Automáticas do WhatsApp', () => {
  // 1, 2, 3: Saudações por horário
  describe('1-3. Saudações automáticas por horário em São Paulo', () => {
    it('deve retornar "bom dia" pela manhã (00:00 às 11:59)', () => {
      // 09:30 em São Paulo (-03:00)
      const dataManha = new Date('2026-09-22T09:30:00-03:00');
      assert.equal(obterSaudacaoPorHorario(dataManha), 'bom dia');

      const dataMadrugada = new Date('2026-09-22T04:15:00-03:00');
      assert.equal(obterSaudacaoPorHorario(dataMadrugada), 'bom dia');
    });

    it('deve retornar "boa tarde" no período vespertino (12:00 às 17:59)', () => {
      const dataTardeMeioDia = new Date('2026-09-22T12:00:00-03:00');
      assert.equal(obterSaudacaoPorHorario(dataTardeMeioDia), 'boa tarde');

      const dataTarde17h = new Date('2026-09-22T17:59:00-03:00');
      assert.equal(obterSaudacaoPorHorario(dataTarde17h), 'boa tarde');
    });

    it('deve retornar "boa noite" à noite (18:00 às 23:59)', () => {
      const dataNoite18h = new Date('2026-09-22T18:00:00-03:00');
      assert.equal(obterSaudacaoPorHorario(dataNoite18h), 'boa noite');

      const dataNoite22h = new Date('2026-09-22T22:45:00-03:00');
      assert.equal(obterSaudacaoPorHorario(dataNoite22h), 'boa noite');
    });
  });

  // 4, 5: Nome do cliente
  describe('4-5. Identificação do Cliente e Saudações Neutras', () => {
    it('deve saudar o cliente pelo nome quando disponível', () => {
      const msg = gerarMensagemWhatsappOS({
        numeroOs: 'OS-2026-0010',
        clienteNome: 'Roberto Alencar',
        status: 'EM_DIAGNOSTICO',
        dataHora: new Date('2026-09-22T10:00:00-03:00'),
      });

      assert.ok(msg.includes('*Olá, bom dia, Roberto Alencar!*'));
      assert.ok(!msg.includes('undefined'));
      assert.ok(!msg.includes('null'));
    });

    it('deve usar saudação neutra e polida quando o nome do cliente não estiver disponível', () => {
      const msgNulo = gerarMensagemWhatsappOS({
        numeroOs: 'OS-2026-0010',
        clienteNome: null,
        status: 'EM_DIAGNOSTICO',
        dataHora: new Date('2026-09-22T14:00:00-03:00'),
      });
      assert.ok(msgNulo.includes('*Olá, boa tarde!*'));
      assert.ok(!msgNulo.includes('undefined'));
      assert.ok(!msgNulo.includes('null'));
      assert.ok(!msgNulo.includes('Cliente'));

      const msgVazio = gerarMensagemWhatsappOS({
        numeroOs: 'OS-2026-0010',
        clienteNome: '   ',
        status: 'EM_DIAGNOSTICO',
        dataHora: new Date('2026-09-22T19:00:00-03:00'),
      });
      assert.ok(msgVazio.includes('*Olá, boa noite!*'));
    });
  });

  // 6, 7: Equipamento e dados opcionais
  describe('6-7. Identificação de Equipamento e Dados Opcionais', () => {
    it('deve incluir modelo, marca e número de série quando disponíveis', () => {
      const msg = gerarMensagemWhatsappOS({
        numeroOs: 'OS-2026-0077',
        clienteNome: 'Construtora Beta',
        maquinaMarca: 'Toyama',
        maquinaModelo: 'TG8000',
        equipamentoNumeroSerie: 'SN-998877',
        status: 'EM_MANUTENCAO',
      });

      assert.ok(msg.includes('Toyama TG8000 (Nº de Série: SN-998877)'));
      assert.ok(!msg.includes('null'));
      assert.ok(!msg.includes('undefined'));
    });

    it('deve omitir graciosamente dados opcionais não preenchidos sem quebrar o texto', () => {
      const msgSemSerie = gerarMensagemWhatsappOS({
        numeroOs: 'OS-2026-0078',
        clienteNome: 'Ana Paula',
        equipamentoModelo: 'Solda TIG',
        equipamentoNumeroSerie: 'S/N',
        status: 'EM_MANUTENCAO',
      });

      assert.ok(msgSemSerie.includes('Solda TIG'));
      assert.ok(!msgSemSerie.includes('Nº de Série'));
      assert.ok(!msgSemSerie.includes('null'));
      assert.ok(!msgSemSerie.includes('undefined'));
    });

    it('deve funcionar perfeitamente quando não houver nenhum equipamento informado', () => {
      const msgSemEquip = gerarMensagemWhatsappOS({
        numeroOs: 'OS-2026-0079',
        clienteNome: 'Marcos',
        status: 'EM_MANUTENCAO',
      });

      assert.ok(msgSemEquip.includes('atendimento referente à Ordem de Serviço *OS-2026-0079*'));
      assert.ok(!msgSemEquip.includes('equipamento *null*'));
      assert.ok(!msgSemEquip.includes('undefined'));
    });
  });

  // 8. Formatação monetária
  describe('8. Formatação Monetária Brasileira', () => {
    it('deve formatar valores monetários no padrão pt-BR', () => {
      assert.equal(formatarMoedaWhatsapp(850), 'R$ 850,00');
      assert.equal(formatarMoedaWhatsapp(1250.5), 'R$ 1.250,50');
      assert.equal(formatarMoedaWhatsapp(0), 'R$ 0,00');
      assert.equal(formatarMoedaWhatsapp(null), 'R$ 0,00');
    });
  });

  // 9-16. Cenários de Status da OS
  describe('9-16. Mensagens Contextualizadas por Status', () => {
    it('9. Mensagem de OS PRONTA (retirada)', () => {
      const msg = gerarMensagemWhatsappOS({
        numeroOs: 'OS-2026-100',
        clienteNome: 'João Construtor',
        equipamentoModelo: 'Gerador Branco 5 kVA',
        valorTotal: 850.0,
        status: 'PRONTA',
        dataHora: new Date('2026-09-22T10:00:00-03:00'),
      });

      assert.ok(msg.includes('Olá, bom dia, João Construtor!'));
      assert.ok(msg.includes('Gerador Branco 5 kVA'));
      assert.ok(msg.includes('OS-2026-100'));
      assert.ok(msg.includes('pronta para retirada'));
      assert.ok(msg.includes('R$ 850,00'));
      assert.ok(msg.includes('Esta é uma mensagem automática da Bruno Soldas.'));
      assert.ok(msg.includes('Bruno Soldas'));
    });

    it('10. Mensagem de OS em DIAGNÓSTICO', () => {
      const msg = gerarMensagemWhatsappOS({
        numeroOs: 'OS-2026-101',
        clienteNome: 'Mariana Lima',
        equipamentoModelo: 'Inversora Bambozzi',
        status: 'EM_DIAGNOSTICO',
        dataHora: new Date('2026-09-22T14:30:00-03:00'),
      });

      assert.ok(msg.includes('Olá, boa tarde, Mariana Lima!'));
      assert.ok(msg.includes('Inversora Bambozzi'));
      assert.ok(msg.includes('diagnóstico técnico'));
      assert.ok(msg.includes('identificar a causa do problema'));
    });

    it('11. Mensagem de OS AGUARDANDO APROVAÇÃO (orçamento detalhado)', () => {
      const msgComDesconto = gerarMensagemWhatsappOS({
        numeroOs: 'OS-2026-102',
        clienteNome: 'Luciano Prado',
        equipamentoModelo: 'Solda MIG 300A',
        valorPecas: 400.0,
        valorMaoObra: 300.0,
        valorDesconto: 50.0,
        valorTotal: 650.0,
        status: 'AGUARDANDO_APROVACAO',
        dataHora: new Date('2026-09-22T16:00:00-03:00'),
      });

      assert.ok(msgComDesconto.includes('orçamento'));
      assert.ok(msgComDesconto.includes('Peças: R$ 400,00'));
      assert.ok(msgComDesconto.includes('Mão de Obra: R$ 300,00'));
      assert.ok(msgComDesconto.includes('Desconto: -R$ 50,00'));
      assert.ok(msgComDesconto.includes('Total: R$ 650,00'));
      assert.ok(msgComDesconto.includes('Favor nos confirmar a aprovação'));

      // Sem desconto não deve exibir linha de desconto
      const msgSemDesconto = gerarMensagemWhatsappOS({
        numeroOs: 'OS-2026-102',
        clienteNome: 'Luciano Prado',
        equipamentoModelo: 'Solda MIG 300A',
        valorPecas: 400.0,
        valorMaoObra: 300.0,
        valorDesconto: 0,
        valorTotal: 700.0,
        status: 'AGUARDANDO_APROVACAO',
      });
      assert.ok(!msgSemDesconto.includes('Desconto'));
      assert.ok(msgSemDesconto.includes('Total: R$ 700,00'));
    });

    it('12. Mensagem de OS AGUARDANDO PEÇA', () => {
      const msg = gerarMensagemWhatsappOS({
        numeroOs: 'OS-2026-103',
        clienteNome: 'Geraldo',
        equipamentoModelo: 'Gerador Honda 3kVA',
        status: 'AGUARDANDO_PECA',
        dataHora: new Date('2026-09-22T08:00:00-03:00'),
      });

      assert.ok(msg.includes('aguardando a disponibilidade e chegada de peça(s)'));
      assert.ok(msg.includes('Gerador Honda 3kVA'));
      assert.ok(msg.includes('OS-2026-103'));
    });

    it('13. Mensagem de OS CONCLUÍDA (serviço finalizado)', () => {
      const msg = gerarMensagemWhatsappOS({
        numeroOs: 'OS-2026-104',
        clienteNome: 'Fábio Souza',
        equipamentoModelo: 'Esab Rogue ET 200i',
        valorTotal: 520.0,
        status: 'CONCLUIDA',
        dataHora: new Date('2026-09-22T19:00:00-03:00'),
      });

      assert.ok(msg.includes('Olá, boa noite, Fábio Souza!'));
      assert.ok(msg.includes('finalizado com sucesso'));
      assert.ok(msg.includes('R$ 520,00'));
      assert.ok(msg.includes('Agradecemos'));
    });

    it('14. Mensagem de OS CANCELADA', () => {
      const msg = gerarMensagemWhatsappOS({
        numeroOs: 'OS-2026-105',
        clienteNome: 'Bruna Mendes',
        equipamentoModelo: 'Gerador Buffalo',
        status: 'CANCELADA',
        dataHora: new Date('2026-09-22T15:00:00-03:00'),
      });

      assert.ok(msg.includes('Olá, boa tarde, Bruna Mendes.'));
      assert.ok(msg.includes('foi cancelada em nosso sistema'));
      assert.ok(msg.includes('OS-2026-105'));
    });

    it('15. Mensagem de OS ABERTA (recebimento do equipamento)', () => {
      const msg = gerarMensagemWhatsappOS({
        numeroOs: 'OS-2026-106',
        clienteNome: 'Auto Peças União',
        equipamentoModelo: 'Inversora Boxer',
        problemaRelatado: 'Não liga ao acionar a chave seletora',
        status: 'ABERTA',
        dataHora: new Date('2026-09-22T11:00:00-03:00'),
      });

      assert.ok(msg.includes('Confirmamos o recebimento do equipamento *Inversora Boxer*'));
      assert.ok(msg.includes('Não liga ao acionar a chave seletora'));
      assert.ok(msg.includes('OS-2026-106'));
    });

    it('16. Mensagem de Status Genérico / Fallback', () => {
      const msg = gerarMensagemWhatsappOS({
        numeroOs: 'OS-2026-107',
        clienteNome: 'Carla',
        status: 'EM_ANALISE_EXTERNA',
      });

      assert.ok(msg.includes('Temos uma nova atualização'));
      assert.ok(msg.includes('OS-2026-107'));
      assert.ok(msg.includes('EM_ANALISE_EXTERNA'));
    });
  });

  // 17, 18: Ausência de null/undefined e URL wa.me
  describe('17-18. Ausência de Null/Undefined e Geração de Links wa.me', () => {
    it('não deve conter "null" ou "undefined" em nenhuma parte da mensagem gerada', () => {
      const statuses = [
        'ABERTA',
        'EM_DIAGNOSTICO',
        'AGUARDANDO_APROVACAO',
        'EM_MANUTENCAO',
        'AGUARDANDO_PECA',
        'PRONTA',
        'CONCLUIDA',
        'CANCELADA',
        null,
        undefined,
      ];

      for (const st of statuses) {
        const msg = gerarMensagemWhatsappOS({
          numeroOs: 'OS-2026-TESTE',
          status: st as StatusOrdemServico | null | undefined,
          clienteNome: undefined,
          equipamentoModelo: null,
          problemaRelatado: undefined,
          valorTotal: null,
        });

        assert.strictEqual(msg.includes('null'), false, `Encontrado "null" no status ${st}`);
        assert.strictEqual(msg.includes('undefined'), false, `Encontrado "undefined" no status ${st}`);
      }
    });

    it('deve gerar link wa.me completo e sanitizado via gerarLinkWhatsappOS', () => {
      const res = gerarLinkWhatsappOS({
        telefone: '(31) 98765-4321',
        clienteNome: 'Danilo Ramos',
        equipamentoModelo: 'Solda Mig Mag',
        numeroOs: 'OS-2026-999',
        status: 'PRONTA',
        valorTotal: 350,
      });

      assert.ok(res.url);
      assert.ok(res.url.startsWith('https://wa.me/5531987654321?text='));
      assert.equal(res.erro, undefined);
    });

    it('deve retornar erro claro quando o telefone não puder ser sanitizado', () => {
      const res = gerarLinkWhatsappOS({
        telefone: '000',
        clienteNome: 'Danilo Ramos',
        numeroOs: 'OS-2026-999',
        status: 'PRONTA',
      });

      assert.strictEqual(res.url, null);
      assert.equal(res.erro, 'Telefone inválido ou não informado.');
    });
  });

  describe('Tradutor de Status Amigável', () => {
    it('deve traduzir corretamente status técnicos para clientes', () => {
      assert.equal(formatarStatusAmigavel('ABERTA'), 'Recebido na oficina');
      assert.equal(formatarStatusAmigavel('EM_DIAGNOSTICO'), 'Em processo de diagnóstico');
      assert.equal(formatarStatusAmigavel('AGUARDANDO_APROVACAO'), 'Aguardando sua aprovação');
      assert.equal(formatarStatusAmigavel('EM_MANUTENCAO'), 'Em processo de manutenção');
      assert.equal(formatarStatusAmigavel('AGUARDANDO_PECA'), 'Aguardando peça para continuidade do serviço');
      assert.equal(formatarStatusAmigavel('PRONTA'), 'Pronto para retirada');
      assert.equal(formatarStatusAmigavel('CONCLUIDA'), 'Serviço finalizado');
      assert.equal(formatarStatusAmigavel('CANCELADA'), 'Atendimento cancelado');
      assert.equal(formatarStatusAmigavel(null), 'Em andamento');
    });
  });
});
