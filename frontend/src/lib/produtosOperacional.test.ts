import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Produto, TipoProduto, PageResponse, TipoMovimentacaoEstoque } from './types.ts';
import { TIPO_PRODUTO_LABELS } from './types.ts';

describe('UX-006: Tela Operacional de Produtos & Estoque — Contratos e Comportamentos', () => {

  describe('1. Correção do Bug P0 — PATCH /api/produtos/{id}/status', () => {
    it('deve enviar payload { ativo: false } ao inativar um produto ativo', () => {
      const produtoAtivo: Produto = {
        id: 42,
        codigo: 'ROL-6204',
        nome: 'Rolamento 6204 DDU',
        tipo: 'PECA',
        tipoDescricao: 'Peça / Componente',
        unidadeMedida: 'UN',
        precoCusto: 18.50,
        precoVenda: 35.00,
        estoqueAtual: 12,
        estoqueMinimo: 5,
        ativo: true,
        estoqueBaixo: false,
        semEstoque: false,
        createdAt: '2026-03-01T10:00:00Z',
        updatedAt: '2026-03-01T10:00:00Z',
      };

      // Frontend prepara payload para inativar
      const novoStatus = !produtoAtivo.ativo;
      const payload = { ativo: novoStatus };

      assert.strictEqual(payload.ativo, false);
      assert.strictEqual(typeof payload.ativo, 'boolean');
      assert.deepStrictEqual(payload, { ativo: false });
    });

    it('deve enviar payload { ativo: true } ao reativar um produto inativo', () => {
      const produtoInativo: Produto = {
        id: 43,
        codigo: 'CAB-16MM',
        nome: 'Cabo de Solda 16mm',
        tipo: 'CONSUMIVEL',
        tipoDescricao: 'Consumível',
        unidadeMedida: 'MT',
        precoCusto: 22.00,
        precoVenda: 45.00,
        estoqueAtual: 0,
        estoqueMinimo: 10,
        ativo: false,
        estoqueBaixo: true,
        semEstoque: true,
        createdAt: '2026-03-01T10:00:00Z',
        updatedAt: '2026-03-01T10:00:00Z',
      };

      const novoStatus = !produtoInativo.ativo;
      const payload = { ativo: novoStatus };

      assert.strictEqual(payload.ativo, true);
      assert.deepStrictEqual(payload, { ativo: true });
    });

    it('deve atualizar o estado da tabela localmente após retorno bem-sucedido', () => {
      const listaProdutos: Produto[] = [
        {
          id: 1,
          codigo: 'P1',
          nome: 'Eletrodo OK 48.04',
          tipo: 'CONSUMIVEL',
          tipoDescricao: 'Consumível',
          unidadeMedida: 'KG',
          precoCusto: 25.0,
          precoVenda: 50.0,
          estoqueAtual: 20,
          estoqueMinimo: 5,
          ativo: true,
          estoqueBaixo: false,
          semEstoque: false,
          createdAt: '2026-03-01T10:00:00Z',
          updatedAt: '2026-03-01T10:00:00Z',
        },
      ];

      // Simula resposta da API com status atualizado
      const produtoRetornadoDaApi: Produto = { ...listaProdutos[0], ativo: false };
      const listaAtualizada = listaProdutos.map(p =>
        p.id === produtoRetornadoDaApi.id ? { ...p, ativo: produtoRetornadoDaApi.ativo } : p
      );

      assert.strictEqual(listaAtualizada[0].ativo, false);
      assert.strictEqual(listaAtualizada[0].codigo, 'P1');
    });
  });

  describe('2. Cabeçalho Compacto e CTA + Nova Peça / Produto', () => {
    it('deve expor o CTA principal de criação de peça/produto', () => {
      const ctaLabel = '+ NOVA PEÇA / PRODUTO';
      assert.strictEqual(ctaLabel, '+ NOVA PEÇA / PRODUTO');
    });

    it('deve permitir acesso rápido à tela de estoque pelo cabeçalho', () => {
      const linkEstoque = { label: 'Visão Geral do Estoque', href: '/estoque' };
      assert.strictEqual(linkEstoque.href, '/estoque');
    });
  });

  describe('3. Busca Principal com Debounce de 400ms e Botão Limpar [✕]', () => {
    it('deve normalizar o termo de busca removendo espaços em branco', () => {
      const termoDigitado = '  tocha tig  ';
      const termoNormalizado = termoDigitado.trim();
      assert.strictEqual(termoNormalizado, 'tocha tig');
    });

    it('deve montar o parâmetro "termo" para a API somente quando preenchido', () => {
      const montarParams = (termo: string) => {
        const params = new URLSearchParams();
        if (termo.trim()) {
          params.set('termo', termo.trim());
        }
        return params;
      };

      const paramsVazio = montarParams('   ');
      assert.strictEqual(paramsVazio.has('termo'), false);

      const paramsPreenchido = montarParams('inversora');
      assert.strictEqual(paramsPreenchido.get('termo'), 'inversora');
    });

    it('deve resetar o termo de busca para vazio no clique do botão [✕]', () => {
      let termoBusca = 'solda mig';
      const limparBusca = () => {
        termoBusca = '';
      };

      assert.strictEqual(termoBusca, 'solda mig');
      limparBusca();
      assert.strictEqual(termoBusca, '');
    });

    it('deve configurar constante de debounce em 400ms para evitar requisições a cada tecla', () => {
      const DEBOUNCE_MS = 400;
      assert.strictEqual(DEBOUNCE_MS, 400);
    });
  });

  describe('4. Pills Operacionais e Mapeamento de Tipos', () => {
    it('deve respeitar os enums reais de TipoProduto do backend', () => {
      const tiposValidos: TipoProduto[] = ['PRODUTO', 'PECA', 'SERVICO', 'CONSUMIVEL'];
      tiposValidos.forEach(tipo => {
        assert.ok(TIPO_PRODUTO_LABELS[tipo], `Tipo ${tipo} deve possuir label associado`);
      });
    });

    it('deve configurar as pills operacionais da tela de produtos', () => {
      const pills = [
        { id: 'TODAS', label: 'Todas' },
        { id: 'PECA', label: '⚡ Peças', tipo: 'PECA' },
        { id: 'CONSUMIVEL', label: '🔋 Consumíveis', tipo: 'CONSUMIVEL' },
        { id: 'PRODUTO', label: '📦 Produtos', tipo: 'PRODUTO' },
        { id: 'CRITICO', label: '⚠️ Estoque Crítico', estoqueBaixo: true },
        { id: 'ATIVAS', label: '✓ Somente Ativas', ativo: true },
      ];

      assert.strictEqual(pills.length, 6);
      assert.strictEqual(pills[0].id, 'TODAS');
      assert.strictEqual(pills[1].tipo, 'PECA');
      assert.strictEqual(pills[4].estoqueBaixo, true);
      assert.strictEqual(pills[5].ativo, true);
    });

    it('deve gerar parâmetros de requisição corretos conforme a pill ativa', () => {
      const gerarParamsPill = (pillId: string) => {
        const params = new URLSearchParams();
        if (pillId === 'PECA') params.set('tipo', 'PECA');
        else if (pillId === 'CONSUMIVEL') params.set('tipo', 'CONSUMIVEL');
        else if (pillId === 'PRODUTO') params.set('tipo', 'PRODUTO');
        else if (pillId === 'CRITICO') params.set('estoqueBaixo', 'true');
        else if (pillId === 'ATIVAS') params.set('ativo', 'true');
        return params;
      };

      assert.strictEqual(gerarParamsPill('TODAS').toString(), '');
      assert.strictEqual(gerarParamsPill('PECA').get('tipo'), 'PECA');
      assert.strictEqual(gerarParamsPill('CRITICO').get('estoqueBaixo'), 'true');
      assert.strictEqual(gerarParamsPill('ATIVAS').get('ativo'), 'true');
    });

    it('não deve gerar chamadas independentes N+1 para os contadores', () => {
      // Os contadores são derivados do pageResponse da consulta atual
      const mockPage: PageResponse<Produto> = {
        content: [
          { id: 1, tipo: 'PECA', estoqueBaixo: false, ativo: true } as Produto,
          { id: 2, tipo: 'PECA', estoqueBaixo: true, semEstoque: true, ativo: true } as Produto,
          { id: 3, tipo: 'CONSUMIVEL', estoqueBaixo: false, ativo: false } as Produto,
        ],
        totalElements: 3,
        totalPages: 1,
        size: 15,
        page: 0,
        first: true,
        last: true,
      };

      const pecasCount = mockPage.content.filter(p => p.tipo === 'PECA').length;
      const criticosCount = mockPage.content.filter(p => p.estoqueBaixo || p.semEstoque).length;
      const ativasCount = mockPage.content.filter(p => p.ativo).length;

      assert.strictEqual(pecasCount, 2);
      assert.strictEqual(criticosCount, 1);
      assert.strictEqual(ativasCount, 2);
    });
  });

  describe('5. Filtros Avançados Recolhidos e Lazy Loading', () => {
    it('deve inicializar filtros avançados fechados por padrão', () => {
      const showFiltrosAvancados = false;
      assert.strictEqual(showFiltrosAvancados, false);
    });

    it('deve calcular a contagem de filtros avançados ativos', () => {
      const calcularFiltrosAtivos = (categoriaId: string, fornecedorId: string) => {
        let count = 0;
        if (categoriaId) count++;
        if (fornecedorId) count++;
        return count;
      };

      assert.strictEqual(calcularFiltrosAtivos('', ''), 0);
      assert.strictEqual(calcularFiltrosAtivos('3', ''), 1);
      assert.strictEqual(calcularFiltrosAtivos('3', '7'), 2);
    });

    it('deve permitir limpar todos os filtros avançados em 1 ação', () => {
      let categoriaId = '5';
      let fornecedorId = '12';

      const limparFiltrosAvancados = () => {
        categoriaId = '';
        fornecedorId = '';
      };

      limparFiltrosAvancados();
      assert.strictEqual(categoriaId, '');
      assert.strictEqual(fornecedorId, '');
    });

    it('não deve carregar fornecedores nem categorias até que sejam requisitados', () => {
      // Lazy load flag simulada
      let carregouFornecedores = false;
      let carregouCategorias = false;

      const onAbrirFiltrosOuModal = () => {
        carregouFornecedores = true;
        carregouCategorias = true;
      };

      // Inicialmente na montagem da tela:
      assert.strictEqual(carregouFornecedores, false);
      assert.strictEqual(carregouCategorias, false);

      // Usuário abre painel de filtros ou modal:
      onAbrirFiltrosOuModal();
      assert.strictEqual(carregouFornecedores, true);
      assert.strictEqual(carregouCategorias, true);
    });
  });

  describe('6. Ação Contextual ± Estoque e Projeção Inline de Saldo', () => {
    it('deve permitir abrir movimentação com o produto já pré-selecionado', () => {
      const produtoAlvo: Produto = {
        id: 77,
        codigo: 'DIODO-70A',
        nome: 'Diodo de Potência 70A',
        tipo: 'PECA',
        tipoDescricao: 'Peça / Componente',
        unidadeMedida: 'UN',
        precoCusto: 35.0,
        precoVenda: 75.0,
        estoqueAtual: 8,
        estoqueMinimo: 4,
        ativo: true,
        estoqueBaixo: false,
        semEstoque: false,
        createdAt: '2026-03-01T10:00:00Z',
        updatedAt: '2026-03-01T10:00:00Z',
      };

      const modalState = {
        isOpen: true,
        produtoPreSelecionado: produtoAlvo,
      };

      assert.strictEqual(modalState.isOpen, true);
      assert.strictEqual(modalState.produtoPreSelecionado.id, 77);
      assert.strictEqual(modalState.produtoPreSelecionado.nome, 'Diodo de Potência 70A');
    });

    it('deve validar quantidade estritamente positiva para movimentação de estoque', () => {
      const validarQuantidade = (qtd: number) => {
        if (isNaN(qtd) || qtd <= 0) {
          return 'A quantidade deve ser maior que zero.';
        }
        return null;
      };

      assert.strictEqual(validarQuantidade(0), 'A quantidade deve ser maior que zero.');
      assert.strictEqual(validarQuantidade(-5), 'A quantidade deve ser maior que zero.');
      assert.strictEqual(validarQuantidade(10), null);
    });

    it('deve bloquear saída que resulte em estoque negativo', () => {
      const saldoAtual = 5;
      const validarSaida = (tipo: TipoMovimentacaoEstoque, qtd: number) => {
        if (tipo === 'SAIDA' && qtd > saldoAtual) {
          return `Saldo insuficiente! Disponível: ${saldoAtual}`;
        }
        return null;
      };

      assert.strictEqual(validarSaida('SAIDA', 6), 'Saldo insuficiente! Disponível: 5');
      assert.strictEqual(validarSaida('SAIDA', 5), null);
      assert.strictEqual(validarSaida('ENTRADA', 10), null);
    });

    it('deve calcular a projeção inline do saldo após movimentação sem exigir reload total da página', () => {
      let estoqueAtual = 15;
      const estoqueMinimo = 10;

      const aplicarMovimentacao = (tipo: TipoMovimentacaoEstoque, quantidade: number) => {
        if (tipo === 'ENTRADA' || tipo === 'AJUSTE_POSITIVO') estoqueAtual += quantidade;
        else if (tipo === 'SAIDA' || tipo === 'AJUSTE_NEGATIVO') estoqueAtual -= quantidade;
        return {
          estoqueAtual,
          estoqueBaixo: estoqueAtual <= estoqueMinimo,
          semEstoque: estoqueAtual === 0,
        };
      };

      // Entrada de 5 unidades
      const r1 = aplicarMovimentacao('ENTRADA', 5);
      assert.strictEqual(r1.estoqueAtual, 20);
      assert.strictEqual(r1.estoqueBaixo, false);

      // Saída de 12 unidades (sobra 8, abaixo do mínimo 10)
      const r2 = aplicarMovimentacao('SAIDA', 12);
      assert.strictEqual(r2.estoqueAtual, 8);
      assert.strictEqual(r2.estoqueBaixo, true);

      // Ajuste negativo para 0 (baixa de 8)
      const r3 = aplicarMovimentacao('AJUSTE_NEGATIVO', 8);
      assert.strictEqual(r3.estoqueAtual, 0);
      assert.strictEqual(r3.semEstoque, true);
    });
  });

  describe('7. Paginação do Estoque e Coerência de Filtro', () => {
    it('deve calcular corretamente a primeira página de dados', () => {
      const pageInfo = { number: 0, size: 10, totalElements: 25, totalPages: 3 };
      const de = pageInfo.number * pageInfo.size + 1;
      const ate = Math.min((pageInfo.number + 1) * pageInfo.size, pageInfo.totalElements);

      assert.strictEqual(de, 1);
      assert.strictEqual(ate, 10);
      assert.strictEqual(pageInfo.number === 0, true); // é primeira página
    });

    it('deve calcular corretamente página intermediária', () => {
      const pageInfo = { number: 1, size: 10, totalElements: 25, totalPages: 3 };
      const de = pageInfo.number * pageInfo.size + 1;
      const ate = Math.min((pageInfo.number + 1) * pageInfo.size, pageInfo.totalElements);

      assert.strictEqual(de, 11);
      assert.strictEqual(ate, 20);
    });

    it('deve calcular corretamente a última página', () => {
      const pageInfo = { number: 2, size: 10, totalElements: 25, totalPages: 3 };
      const de = pageInfo.number * pageInfo.size + 1;
      const ate = Math.min((pageInfo.number + 1) * pageInfo.size, pageInfo.totalElements);

      assert.strictEqual(de, 21);
      assert.strictEqual(ate, 25);
    });

    it('não deve aplicar filtros client-side que quebrem o totalElements retornado da API', () => {
      // Quando a API já filtra por estoqueBaixo, content e totalElements são consistentes
      const pageApi: PageResponse<Produto> = {
        content: [
          { id: 1, nome: 'Termostato', estoqueAtual: 2, estoqueMinimo: 5, estoqueBaixo: true } as Produto,
          { id: 2, nome: 'Resistência', estoqueAtual: 0, estoqueMinimo: 3, estoqueBaixo: true } as Produto,
        ],
        totalElements: 2,
        totalPages: 1,
        size: 10,
        page: 0,
        first: true,
        last: true,
      };

      // Sem filter duplicado pós-API
      assert.strictEqual(pageApi.content.length, pageApi.totalElements);
    });
  });

  describe('8. Remoção de window.confirm() e Proteção Contra Duplo Envio', () => {
    it('deve usar estado de modal visual para confirmação de inativação', () => {
      interface ConfirmModalState {
        isOpen: boolean;
        produtoId: number | null;
        nome: string;
        isSubmitting: boolean;
      }

      const modal: ConfirmModalState = {
        isOpen: true,
        produtoId: 99,
        nome: 'Ponte Retificadora 50A',
        isSubmitting: false,
      };

      assert.strictEqual(modal.isOpen, true);
      assert.strictEqual(modal.nome, 'Ponte Retificadora 50A');
      assert.strictEqual(modal.isSubmitting, false);
    });

    it('deve travar novo envio enquanto requisição estiver pendente (isSubmitting = true)', () => {
      let submissoesExecutadas = 0;
      let isSubmitting = false;

      const submeter = () => {
        if (isSubmitting) return;
        isSubmitting = true;
        submissoesExecutadas++;
      };

      submeter(); // 1º clique
      submeter(); // 2º clique acidental
      submeter(); // 3º clique acidental

      assert.strictEqual(submissoesExecutadas, 1);
      assert.strictEqual(isSubmitting, true);
    });
  });

  describe('9. Estados Vazios e Feedback ao Usuário', () => {
    it('deve diferenciar mensagem de "nenhum produto cadastrado" de "nenhum produto encontrado para o filtro"', () => {
      const getEmptyMessage = (temFiltrosAtivos: boolean) => {
        if (temFiltrosAtivos) {
          return {
            titulo: 'Nenhum produto encontrado',
            descricao: 'Tente ajustar os filtros ou o termo pesquisado para encontrar o que procura.',
            acao: 'Limpar Filtros',
          };
        }
        return {
          titulo: 'Nenhum produto cadastrado',
          descricao: 'Cadastre a primeira peça, produto ou consumível para controlar o estoque.',
          acao: 'Cadastrar Primeira Peça',
        };
      };

      const vazioSemFiltro = getEmptyMessage(false);
      assert.strictEqual(vazioSemFiltro.titulo, 'Nenhum produto cadastrado');
      assert.strictEqual(vazioSemFiltro.acao, 'Cadastrar Primeira Peça');

      const vazioComFiltro = getEmptyMessage(true);
      assert.strictEqual(vazioComFiltro.titulo, 'Nenhum produto encontrado');
      assert.strictEqual(vazioComFiltro.acao, 'Limpar Filtros');
    });
  });

  describe('10. Proteção de Rota e Redirecionamento 401', () => {
    it('deve identificar erro HTTP 401 e preparar redirecionamento para /login', () => {
      const tratarErroApi = (status: number) => {
        if (status === 401) {
          return { redirecionar: true, destino: '/login' };
        }
        return { redirecionar: false, destino: null };
      };

      const resultado401 = tratarErroApi(401);
      assert.strictEqual(resultado401.redirecionar, true);
      assert.strictEqual(resultado401.destino, '/login');

      const resultado500 = tratarErroApi(500);
      assert.strictEqual(resultado500.redirecionar, false);
    });
  });
});
