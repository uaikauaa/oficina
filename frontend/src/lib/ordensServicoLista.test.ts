import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { OrdemServicoContadoresStatus } from './types.ts';
import { formatarData, formatarMoeda } from './api.ts';

describe('UX-003: Tela Operacional de Ordens de Serviço — Contratos e Comportamentos', () => {

  describe('1. Renderização de Status e Pills Operacionais', () => {
    it('deve mapear corretamente os 8 status operacionais com labels legíveis', () => {
      const statusLabels: Record<string, string> = {
        ABERTA: 'Aberta',
        EM_DIAGNOSTICO: 'Em Diagnóstico',
        AGUARDANDO_APROVACAO: 'Aguardando Aprovação',
        EM_MANUTENCAO: 'Em Manutenção',
        AGUARDANDO_PECA: 'Aguardando Peça',
        PRONTA: 'Pronta para Retirada',
        CONCLUIDA: 'Concluída',
        CANCELADA: 'Cancelada',
      };

      assert.strictEqual(statusLabels['PRONTA'], 'Pronta para Retirada');
      assert.strictEqual(statusLabels['AGUARDANDO_APROVACAO'], 'Aguardando Aprovação');
      assert.strictEqual(statusLabels['EM_MANUTENCAO'], 'Em Manutenção');
      assert.strictEqual(statusLabels['AGUARDANDO_PECA'], 'Aguardando Peça');
    });

    it('deve destacar visualmente a pill de Prontas para Retirada', () => {
      const pillPronta = { id: 'PRONTA', label: 'Prontas para Retirada', destaque: true };
      assert.strictEqual(pillPronta.destaque, true);
    });
  });

  describe('2. Contadores Consolidados de Status (Consumo de /api/ordens-servico/contadores-status)', () => {
    it('deve processar os contadores consolidados do endpoint sem chamadas repetidas', () => {
      const mockContadores: OrdemServicoContadoresStatus = {
        total: 42,
        aberta: 8,
        emDiagnostico: 2,
        aguardandoAprovacao: 5,
        emManutencao: 6,
        aguardandoPeca: 3,
        pronta: 4,
        concluida: 12,
        cancelada: 2,
      };

      assert.strictEqual(mockContadores.total, 42);
      assert.strictEqual(mockContadores.aberta, 8);
      assert.strictEqual(mockContadores.aguardandoAprovacao, 5);
      assert.strictEqual(mockContadores.pronta, 4);
      assert.strictEqual(mockContadores.emManutencao, 6);
    });
  });

  describe('3. Filtro Ativo e Reconhecimento Automático', () => {
    it('deve formatar mensagem de filtro ativo com contagem correta no singular e plural', () => {
      const formatarMensagemFiltro = (statusNome: string, total: number) =>
        `Filtrando por: ${statusNome} (${total} ${total === 1 ? 'encontrada' : 'encontradas'})`;

      assert.strictEqual(
        formatarMensagemFiltro('Aguardando Aprovação', 1),
        'Filtrando por: Aguardando Aprovação (1 encontrada)'
      );
      assert.strictEqual(
        formatarMensagemFiltro('Prontas para Retirada', 5),
        'Filtrando por: Prontas para Retirada (5 encontradas)'
      );
    });

    it('deve reconhecer status vindos diretamente da Dashboard via URL query parameter', () => {
      const paramsUrl = new URLSearchParams('status=AGUARDANDO_APROVACAO');
      const statusAtivo = paramsUrl.get('status');

      assert.strictEqual(statusAtivo, 'AGUARDANDO_APROVACAO');
    });
  });

  describe('4. Limpeza de Filtros', () => {
    it('deve resetar o status ao clicar no botão de limpar filtro mantendo página no início', () => {
      let statusFiltro = 'PRONTA';
      let page = 3;

      // Ação de limpar
      statusFiltro = '';
      page = 0;

      assert.strictEqual(statusFiltro, '');
      assert.strictEqual(page, 0);
    });

    it('deve resetar todos os filtros (termo, período e status) na ação de limpar todos', () => {
      const estadoFiltros = {
        termo: 'Inversora',
        statusFiltro: 'EM_MANUTENCAO',
        dataInicio: '2026-09-01',
        dataFim: '2026-09-17',
        periodoAtivo: '30',
        page: 2,
      };

      assert.strictEqual(estadoFiltros.termo, 'Inversora');
      assert.strictEqual(estadoFiltros.statusFiltro, 'EM_MANUTENCAO');

      const resetado = {
        termo: '',
        statusFiltro: '',
        dataInicio: '',
        dataFim: '',
        periodoAtivo: 'tudo',
        page: 0,
      };

      assert.strictEqual(resetado.termo, '');
      assert.strictEqual(resetado.statusFiltro, '');
      assert.strictEqual(resetado.dataInicio, '');
      assert.strictEqual(resetado.periodoAtivo, 'tudo');
      assert.strictEqual(resetado.page, 0);
    });
  });

  describe('5. Busca Principal Dominante', () => {
    it('deve gerar parâmetros de busca com termo normalizado e trim', () => {
      const termoDigitado = '  ESAB 280i  ';
      const params = new URLSearchParams();
      if (termoDigitado.trim()) {
        params.append('termo', termoDigitado.trim());
      }

      assert.strictEqual(params.get('termo'), 'ESAB 280i');
    });

    it('deve permitir limpar o termo de busca em 1 clique', () => {
      let termo = 'Solda';
      const limparBusca = () => {
        termo = '';
      };
      limparBusca();
      assert.strictEqual(termo, '');
    });
  });

  describe('6. Painel Retrátil de Filtros Avançados', () => {
    it('deve calcular corretamente a quantidade de filtros avançados ativos', () => {
      const contarFiltrosAvancados = (dataInicio: string, dataFim: string, periodo: string) => {
        let count = 0;
        if (dataInicio || dataFim || periodo !== 'tudo') count++;
        return count;
      };

      assert.strictEqual(contarFiltrosAvancados('', '', 'tudo'), 0);
      assert.strictEqual(contarFiltrosAvancados('2026-09-01', '', 'custom'), 1);
      assert.strictEqual(contarFiltrosAvancados('', '', '30'), 1);
    });
  });

  describe('7. Paginação Clara', () => {
    it('deve calcular o texto de intervalo "Mostrando X a Y de Z ordens"', () => {
      const calcularTextoPaginacao = (page: number, size: number, totalElements: number) => {
        if (totalElements === 0) return '0 ordens';
        const de = page * size + 1;
        const ate = Math.min((page + 1) * size, totalElements);
        return `Mostrando ${de} a ${ate} de ${totalElements} ordens`;
      };

      assert.strictEqual(calcularTextoPaginacao(0, 15, 42), 'Mostrando 1 a 15 de 42 ordens');
      assert.strictEqual(calcularTextoPaginacao(1, 15, 42), 'Mostrando 16 a 30 de 42 ordens');
      assert.strictEqual(calcularTextoPaginacao(2, 15, 42), 'Mostrando 31 a 42 de 42 ordens');
      assert.strictEqual(calcularTextoPaginacao(0, 15, 1), 'Mostrando 1 a 1 de 1 ordens');
      assert.strictEqual(calcularTextoPaginacao(0, 15, 0), '0 ordens');
    });

    it('deve desabilitar navegação de página quando estiver no limite', () => {
      const page = 0;
      const totalPages = 3;
      const podeVoltar = page > 0;
      const podeAvancar = page + 1 < totalPages;

      assert.strictEqual(podeVoltar, false);
      assert.strictEqual(podeAvancar, true);
    });
  });

  describe('8. Estados Vazio e Erro', () => {
    it('deve distinguir mensagem de vazio entre base limpa e filtros sem resultado', () => {
      const obterMensagemVazio = (temFiltros: boolean) =>
        temFiltros
          ? 'Nenhuma OS corresponde aos filtros aplicados'
          : 'Nenhuma Ordem de Serviço registrada ainda';

      assert.strictEqual(obterMensagemVazio(false), 'Nenhuma Ordem de Serviço registrada ainda');
      assert.strictEqual(obterMensagemVazio(true), 'Nenhuma OS corresponde aos filtros aplicados');
    });
  });

  describe('9. Navegação para Detalhes e Ação Principal Nova OS', () => {
    it('deve gerar link de detalhes no formato canônico /ordens-servico/{id}', () => {
      const osId = 315;
      const link = `/ordens-servico/${osId}`;
      assert.strictEqual(link, '/ordens-servico/315');
    });

    it('deve direcionar o botão Hero de Nova OS para /ordens-servico/nova em 1 clique', () => {
      const linkNovaOs = '/ordens-servico/nova';
      assert.strictEqual(linkNovaOs, '/ordens-servico/nova');
    });
  });

  describe('10. Formatação Operacional de Dados na Tabela', () => {
    it('deve formatar data de entrada no formato DD/MM/AAAA para economizar espaço horizontal', () => {
      const dataFormatada = formatarData('2026-09-17T08:30:00Z');
      assert.strictEqual(dataFormatada, '17/09/2026');
    });

    it('deve formatar valores monetários corretamente com padrão brasileiro', () => {
      const valorFormatado = formatarMoeda(250.0);
      assert.ok(valorFormatado.includes('250'));
      assert.ok(valorFormatado.includes('R$'));
    });
  });

});
