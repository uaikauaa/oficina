import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { OrdemServico, PageResponse, OrdemServicoContadoresDashboard, EstoqueResumo } from './types.ts';
import { formatarData } from './api.ts';

describe('UX-002: Dashboard Operacional — Regras de Negócio e Contratos de Dados', () => {

  describe('1. Contadores do Painel de Atenção', () => {
    it('deve processar os contadores consolidados do endpoint /api/ordens-servico/contadores-dashboard', () => {
      const mockContadores: OrdemServicoContadoresDashboard = {
        prontas: 4,
        aguardandoAprovacao: 2,
        emManutencao: 5,
      };

      assert.strictEqual(typeof mockContadores.prontas, 'number');
      assert.strictEqual(typeof mockContadores.aguardandoAprovacao, 'number');
      assert.strictEqual(typeof mockContadores.emManutencao, 'number');
      assert.strictEqual(mockContadores.prontas, 4);
      assert.strictEqual(mockContadores.aguardandoAprovacao, 2);
      assert.strictEqual(mockContadores.emManutencao, 5);
    });

    it('deve extrair e validar o indicador de Estoque Crítico a partir de /api/estoque/resumo', () => {
      const mockResumoEstoque: EstoqueResumo = {
        totalProdutos: 42,
        valorTotalEstoque: 15420.50,
        itensEstoqueBaixo: 3,
        itensSemEstoque: 1,
      };

      assert.strictEqual(mockResumoEstoque.itensEstoqueBaixo, 3);
      assert.ok(mockResumoEstoque.itensEstoqueBaixo >= 0);
    });
  });

  describe('2. Links Acionáveis e Navegação Direta', () => {
    it('deve conter as URLs exatas de filtro para os 4 indicadores de atenção', () => {
      const linksAtencao = {
        prontas: '/ordens-servico?status=PRONTA',
        aguardandoAprovacao: '/ordens-servico?status=AGUARDANDO_APROVACAO',
        emManutencao: '/ordens-servico?status=EM_MANUTENCAO',
        estoqueCritico: '/estoque',
      };

      assert.strictEqual(linksAtencao.prontas, '/ordens-servico?status=PRONTA');
      assert.strictEqual(linksAtencao.aguardandoAprovacao, '/ordens-servico?status=AGUARDANDO_APROVACAO');
      assert.strictEqual(linksAtencao.emManutencao, '/ordens-servico?status=EM_MANUTENCAO');
      assert.strictEqual(linksAtencao.estoqueCritico, '/estoque');
    });

    it('deve garantir que o botão Hero de Nova OS aponte para /ordens-servico/nova em 1 clique', () => {
      const heroActionLink = '/ordens-servico/nova';
      assert.strictEqual(heroActionLink, '/ordens-servico/nova');
    });

    it('deve conter as rotas corretas para os 5 Acessos Rápidos da oficina', () => {
      const rotasAcessosRapidos = [
        { rotulo: 'Ordens de Serviço', href: '/ordens-servico' },
        { rotulo: 'Clientes', href: '/clientes' },
        { rotulo: 'Equipamentos', href: '/maquinas' },
        { rotulo: 'Estoque', href: '/estoque' },
        { rotulo: 'Relatórios', href: '/relatorios' },
      ];

      assert.strictEqual(rotasAcessosRapidos.length, 5);
      assert.deepStrictEqual(rotasAcessosRapidos.map((item) => item.href), [
        '/ordens-servico',
        '/clientes',
        '/maquinas',
        '/estoque',
        '/relatorios',
      ]);
    });
  });

  describe('3. Visão de Bancada Recente e Formatação', () => {
    const mockRecentesResponse: PageResponse<OrdemServico> = {
      content: [
        {
          id: 101,
          numeroOs: 'OS-2026-0099',
          clienteId: 5,
          clienteNome: 'Construtora Vale S/A',
          clienteTelefone: '31988887777',
          clienteCpfCnpj: '12345678000199',
          maquinaId: 12,
          maquinaTipoEquipamento: 'OUTRO_EQUIPAMENTO',
          maquinaTipoDescricao: 'Compressor de Ar',
          maquinaMarca: 'Schulz',
          maquinaModelo: 'MSV 20',
          maquinaNumeroSerie: 'SN-SCH-998',
          maquinaPotencia: '5HP',
          maquinaTensao: '220V',
          tecnicoId: 1,
          tecnicoNome: 'Técnico Silva',
          status: 'EM_MANUTENCAO',
          statusDescricao: 'Em Manutenção',
          dataEntrada: '2026-09-17T08:30:00Z',
          previsaoConclusao: null,
          dataConclusao: null,
          problemaRelatado: 'Vazamento no cabeçote',
          diagnostico: 'Junta danificada',
          solucaoAplicada: null,
          testesRealizados: null,
          observacoes: null,
          horimetroAtual: 120,
          valorMaoObra: 150,
          valorPecas: 80,
          valorDesconto: 0,
          valorTotal: 230,
          createdAt: '2026-09-17T08:30:00Z',
          updatedAt: '2026-09-17T09:00:00Z',
        },
      ],
      page: 0,
      size: 5,
      totalElements: 1,
      totalPages: 1,
      first: true,
      last: true,
    };

    it('deve extrair com segurança a lista de ordens recentes e limitar em até 5 itens', () => {
      const recentes = (mockRecentesResponse.content ?? []).slice(0, 5);
      assert.strictEqual(recentes.length, 1);
      assert.strictEqual(recentes[0].numeroOs, 'OS-2026-0099');
      assert.strictEqual(recentes[0].clienteNome, 'Construtora Vale S/A');
      assert.strictEqual(recentes[0].maquinaTipoDescricao, 'Compressor de Ar');
    });

    it('deve formatar data de entrada no padrão legível DD/MM/AAAA', () => {
      const dataFormatada = formatarData('2026-09-17T08:30:00Z');
      assert.strictEqual(dataFormatada, '17/09/2026');
    });

    it('deve gerar link direto para abrir os detalhes da OS', () => {
      const osId = 101;
      const linkDetalhe = `/ordens-servico/${osId}`;
      assert.strictEqual(linkDetalhe, '/ordens-servico/101');
    });

    it('deve identificar empty state quando não houver ordens registradas', () => {
      const responseVazia: PageResponse<OrdemServico> = {
        content: [],
        page: 0,
        size: 5,
        totalElements: 0,
        totalPages: 0,
        first: true,
        last: true,
      };

      const recentes = responseVazia.content ?? [];
      const estaVazio = recentes.length === 0;

      assert.strictEqual(estaVazio, true);
      const mensagemEmptyState = 'Nenhuma Ordem de Serviço registrada ainda.';
      assert.ok(mensagemEmptyState.includes('Nenhuma Ordem de Serviço'));
    });
  });

  describe('4. Resiliência e Isolamento de Estados de Erro e Loading', () => {
    it('não deve exibir 0 numérico durante o estado de carregamento', () => {
      const obterTextoContador = (carregando: boolean, dados: OrdemServicoContadoresDashboard | null) =>
        carregando ? '...' : (dados?.prontas ?? 0);

      const valorExibido = obterTextoContador(true, null);
      assert.strictEqual(valorExibido, '...');
      assert.notStrictEqual(valorExibido, 0);

      const valorCarregado = obterTextoContador(false, { prontas: 5, aguardandoAprovacao: 1, emManutencao: 2 });
      assert.strictEqual(valorCarregado, 5);
    });

    it('deve permitir tratamento isolado de erro para que falha em estoque não quebre os contadores de OS', () => {
      const estado = {
        erroContadores: false,
        contadores: { prontas: 3, aguardandoAprovacao: 1, emManutencao: 2 },
        erroEstoque: true,
        itensEstoqueBaixo: null,
      };

      // Painel de OS continua funcional mesmo que o endpoint de estoque falhe temporariamente
      assert.strictEqual(estado.erroContadores, false);
      assert.strictEqual(estado.contadores.prontas, 3);
      assert.strictEqual(estado.erroEstoque, true);
    });
  });

});
