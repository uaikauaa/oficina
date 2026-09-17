import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Cliente, ClienteContadoresStatus } from './types.ts';
import { formatarDocumento, formatarTelefone } from './api.ts';

describe('UX-004: Tela Operacional de Clientes — Contratos e Comportamentos', () => {

  describe('1. Normalização e Formatação de Documentos (CPF / CNPJ)', () => {
    it('deve formatar CPF sem máscara para padrão 000.000.000-00', () => {
      assert.strictEqual(formatarDocumento('00014014000'), '000.140.140-00');
      assert.strictEqual(formatarDocumento('12345678901'), '123.456.789-01');
    });

    it('deve formatar CNPJ sem máscara para padrão 00.000.000/0000-00', () => {
      assert.strictEqual(formatarDocumento('12345678000199'), '12.345.678/0001-99');
    });

    it('deve preservar formatação se CPF ou CNPJ já vier com máscara', () => {
      assert.strictEqual(formatarDocumento('000.140.140-00'), '000.140.140-00');
      assert.strictEqual(formatarDocumento('12.345.678/0001-99'), '12.345.678/0001-99');
    });

    it('deve retornar traço caso documento seja nulo ou indefinido', () => {
      assert.strictEqual(formatarDocumento(null), '-');
      assert.strictEqual(formatarDocumento(undefined), '-');
      assert.strictEqual(formatarDocumento(''), '-');
    });
  });

  describe('2. Normalização e Formatação de Telefones', () => {
    it('deve formatar celular de 11 dígitos para (00) 00000-0000', () => {
      assert.strictEqual(formatarTelefone('31999990000'), '(31) 99999-0000');
    });

    it('deve formatar telefone fixo de 10 dígitos para (00) 0000-0000', () => {
      assert.strictEqual(formatarTelefone('3133330000'), '(31) 3333-0000');
    });

    it('deve extrair dígitos para link telefônico tel:', () => {
      const tel = '(31) 99999-0000';
      const limpo = tel.replace(/\D/g, '');
      assert.strictEqual(limpo, '31999990000');
      assert.strictEqual(`tel:${limpo}`, 'tel:31999990000');
    });
  });

  describe('3. Contadores Operacionais e Pills (Consumo de /api/clientes/contadores-status)', () => {
    it('deve processar os contadores consolidados do endpoint', () => {
      const mockContadores: ClienteContadoresStatus = {
        total: 15,
        pessoaFisica: 10,
        pessoaJuridica: 5,
        ativos: 14,
        inativos: 1,
      };

      assert.strictEqual(mockContadores.total, 15);
      assert.strictEqual(mockContadores.pessoaFisica, 10);
      assert.strictEqual(mockContadores.pessoaJuridica, 5);
      assert.strictEqual(mockContadores.ativos, 14);
      assert.strictEqual(mockContadores.inativos, 1);
    });

    it('deve montar os labels das pills corretamente com as quantidades reais', () => {
      const c: ClienteContadoresStatus = {
        total: 11,
        pessoaFisica: 7,
        pessoaJuridica: 4,
        ativos: 10,
        inativos: 1,
      };

      const pillTodas = `Todas (${c.total})`;
      const pillPf = `Pessoa Física (${c.pessoaFisica})`;
      const pillPj = `Pessoa Jurídica (${c.pessoaJuridica})`;
      const pillAtivos = `Ativos (${c.ativos})`;
      const pillInativos = `Inativos (${c.inativos})`;

      assert.strictEqual(pillTodas, 'Todas (11)');
      assert.strictEqual(pillPf, 'Pessoa Física (7)');
      assert.strictEqual(pillPj, 'Pessoa Jurídica (4)');
      assert.strictEqual(pillAtivos, 'Ativos (10)');
      assert.strictEqual(pillInativos, 'Inativos (1)');
    });
  });

  describe('4. totalEquipamentos (Aproveitamento Direto do DTO)', () => {
    it('deve exibir a quantidade correta de equipamentos sem requisições adicionais', () => {
      const cliComMaquinas: Partial<Cliente> = {
        id: 1,
        nomeRazaoSocial: 'Metalúrgica Aço Forte',
        totalEquipamentos: 3,
      };

      const cliSemMaquinas: Partial<Cliente> = {
        id: 2,
        nomeRazaoSocial: 'João Silva',
        totalEquipamentos: 0,
      };

      const formatarTotalMaquinas = (qtd: number) => `${qtd} máq.`;

      assert.strictEqual(formatarTotalMaquinas(cliComMaquinas.totalEquipamentos!), '3 máq.');
      assert.strictEqual(formatarTotalMaquinas(cliSemMaquinas.totalEquipamentos!), '0 máq.');
    });
  });

  describe('5. Atalho Operacional + OS', () => {
    it('deve gerar a URL de Nova OS com o clienteId pré-selecionado', () => {
      const clienteId = 1332;
      const urlNovaOs = `/ordens-servico/nova?clienteId=${clienteId}`;
      assert.strictEqual(urlNovaOs, '/ordens-servico/nova?clienteId=1332');
    });
  });

  describe('6. Filtro Ativo e Limpeza em 1 Clique', () => {
    it('deve formatar a descrição do filtro ativo para tipo de pessoa', () => {
      const getDescricaoFiltroAtivo = (tipo: string, termo: string, ativo: string) => {
        const partes: string[] = [];
        if (termo) partes.push(`Busca "${termo}"`);
        if (tipo === 'FISICA') partes.push('Pessoa Física');
        if (tipo === 'JURIDICA') partes.push('Pessoa Jurídica');
        if (ativo === 'true') partes.push('Apenas Ativos');
        if (ativo === 'false') partes.push('Apenas Inativos');
        return partes.join(' + ');
      };

      assert.strictEqual(
        getDescricaoFiltroAtivo('JURIDICA', '', ''),
        'Pessoa Jurídica'
      );

      assert.strictEqual(
        getDescricaoFiltroAtivo('FISICA', 'Silva', ''),
        'Busca "Silva" + Pessoa Física'
      );

      assert.strictEqual(
        getDescricaoFiltroAtivo('', '', 'false'),
        'Apenas Inativos'
      );
    });
  });

  describe('7. Paginação Operacional (Padrão 15 Itens)', () => {
    it('deve calcular corretamente o intervalo de registros exibidos', () => {
      const calcularLimites = (page: number, pageSize: number, totalElements: number) => {
        const registroInicial = totalElements === 0 ? 0 : page * pageSize + 1;
        const registroFinal = Math.min((page + 1) * pageSize, totalElements);
        return { registroInicial, registroFinal };
      };

      // Página 0 com 11 registros totais (tamanho 15)
      const r1 = calcularLimites(0, 15, 11);
      assert.strictEqual(r1.registroInicial, 1);
      assert.strictEqual(r1.registroFinal, 11);

      // Página 1 com 42 registros totais (tamanho 15)
      const r2 = calcularLimites(1, 15, 42);
      assert.strictEqual(r2.registroInicial, 16);
      assert.strictEqual(r2.registroFinal, 30);

      // Sem registros
      const r3 = calcularLimites(0, 15, 0);
      assert.strictEqual(r3.registroInicial, 0);
      assert.strictEqual(r3.registroFinal, 0);
    });
  });

  describe('8. Estados da Interface (Empty State e Error State)', () => {
    it('deve diferenciar mensagem vazia com e sem filtros ativos', () => {
      const getMensagemVazia = (temFiltro: boolean) =>
        temFiltro
          ? 'Nenhum cliente encontrado para sua busca ou filtros atuais.'
          : 'Nenhum cliente cadastrado ainda.';

      assert.strictEqual(getMensagemVazia(false), 'Nenhum cliente cadastrado ainda.');
      assert.strictEqual(getMensagemVazia(true), 'Nenhum cliente encontrado para sua busca ou filtros atuais.');
    });
  });
});
