import type { Page } from '@playwright/test';

// Respostas somente do navegador Playwright. Nenhum dado operacional é lido ou escrito.
export const visualUser = { id: 1, nome: 'Marina Oficina', email: 'visual@oficina.invalid', roles: ['ROLE_ADMIN'] };
const date = '2026-10-29T10:00:00-03:00';
export const visualClient = { id: 42, tipoPessoa: 'JURIDICA', nomeRazaoSocial: 'Metalúrgica Horizonte', nomeFantasia: 'Horizonte', cpfCnpj: '11222333000181', telefone: '14999990000', email: 'contato@example.invalid', ativo: true, enderecos: [{ logradouro: 'Rua das Oficinas', numero: '120', bairro: 'Centro', cidade: 'Ourinhos', estado: 'SP', cep: '19914080' }], totalEquipamentos: 1, createdAt: date, updatedAt: date };
export const visualMachine = { id: 9, clienteId: 42, clienteNome: visualClient.nomeRazaoSocial, tipoEquipamento: 'MAQUINA_SOLDA', tipoEquipamentoDescricao: 'Máquina de Solda', marca: 'ESAB', modelo: 'LHN 220i', numeroSerie: 'EQ-2026-009', potencia: '220 A', tensao: '220 V', ativo: true, createdAt: date, updatedAt: date };
export const visualOrder = { id: 77, numeroOs: 'OS-2026-077', clienteId: 42, clienteNome: visualClient.nomeRazaoSocial, clienteTelefone: visualClient.telefone, maquinaId: 9, maquinaMarca: 'ESAB', maquinaModelo: 'LHN 220i', maquinaTipoEquipamento: 'MAQUINA_SOLDA', maquinaTipoDescricao: 'Máquina de Solda', status: 'ABERTA', statusDescricao: 'Aberta', dataEntrada: date, problemaRelatado: 'Equipamento desliga durante a soldagem.', valorMaoObra: 180, valorPecas: 95, valorDesconto: 0, valorTotal: 275, createdAt: date, updatedAt: date };
export const visualProduct = { id: 10, codigo: 'P-010', nome: 'Conector de potência', marca: 'ESAB', tipo: 'PECA', tipoDescricao: 'Peça / Componente', unidadeMedida: 'UN', precoCusto: 60, precoVenda: 95, estoqueAtual: 2, estoqueMinimo: 3, estoqueBaixo: true, semEstoque: false, ativo: true, categoriaId: 1, categoriaNome: 'Máquina de Solda', localizacao: 'A-02', createdAt: date, updatedAt: date };
export const visualConfig = { id: 1, nomeSistema: 'Oficina Gestão', nomeFantasia: 'Oficina Horizonte', nomeEmpresarial: 'Oficina Horizonte Ltda', cnpj: '11222333000181', telefone: '14999990000', email: 'oficina@example.invalid', logradouro: 'Rua das Oficinas', numero: '120', bairro: 'Centro', municipio: 'Ourinhos', uf: 'SP', cep: '19914080' };
const movement = { id: 1, produtoId: 10, produtoCodigo: 'P-010', produtoNome: visualProduct.nome, tipoMovimentacao: 'ENTRADA', tipoDescricao: 'Entrada', quantidade: 2, quantidadeAnterior: 0, quantidadePosterior: 2, motivo: 'Reposição de bancada', usuarioNome: 'Marina', dataMovimentacao: date };
const paged = (content: unknown[]) => ({ content, page: 0, size: 15, totalElements: content.length, totalPages: 1, first: true, last: true });

export async function visualMocks(page: Page, login = false) {
  await page.clock.setFixedTime(new Date('2026-10-29T15:00:00Z'));
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = {};
    if (path === '/api/auth/me') {
      return route.fulfill({ status: login ? 401 : 200, json: login ? {} : visualUser });
    }
    if (path === '/api/auth/csrf') data = { token: 'visual-test-csrf' };
    else if (path === '/api/notificacoes') data = { notificacoes: [], naoLidas: 0 };
    else if (path === '/api/configuracao-oficina') data = visualConfig;
    else if (path === '/api/clientes/42') data = visualClient;
    else if (path === '/api/clientes/42/resumo') data = { clienteId: 42, quantidadeEquipamentos: 1, quantidadeTotalOs: 1, quantidadeOsAbertas: 1, valorAcumulado: 275 };
    else if (path === '/api/clientes/contadores-status') data = { total: 1, ativos: 1, inativos: 0, fisicas: 0, juridicas: 1 };
    else if (path === '/api/maquinas/9') data = visualMachine;
    else if (path === '/api/maquinas/9/resumo') data = { maquinaId: 9, totalAtendimentos: 1, valorAcumulado: 275, ultimaOsId: 77, ultimaOsNumero: visualOrder.numeroOs };
    else if (path === '/api/ordens-servico/77') data = visualOrder;
    else if (path.endsWith('/itens')) data = [{ id: 1, ordemServicoId: 77, produtoId: 10, produtoCodigo: 'P-010', produtoNome: visualProduct.nome, tipoItem: 'PECA', tipoItemDescricao: 'Peça', quantidade: 1, valorUnitario: 95, valorDesconto: 0, valorTotal: 95 }];
    else if (path.endsWith('/compatibilidades')) data = [];
    else if (path === '/api/ordens-servico/contadores-dashboard') data = { prontas: 3, aguardandoAprovacao: 2, emManutencao: 5 };
    else if (path === '/api/ordens-servico/contadores-status') data = { total: 12, aberta: 2, emDiagnostico: 0, aguardandoAprovacao: 2, emManutencao: 5, aguardandoPeca: 0, pronta: 3, concluida: 0, cancelada: 0 };
    else if (path === '/api/estoque/resumo') data = { totalProdutos: 18, itensEstoqueBaixo: 4, itensSemEstoque: 1, valorTotalEstoque: 4260 };
    else if (path === '/api/categorias/ativas') data = [{ id: 1, nome: 'Máquina de Solda', ativo: true }];
    else if (path === '/api/relatorios/ordens-servico') data = { resumo: { totalOs: 1, concluidas: 0, abertas: 1, canceladas: 0, valorTotalConcluidas: 0, valorTotalAReceber: 275 }, itens: paged([visualOrder]) };
    else if (path === '/api/relatorios/estoque') data = paged([{ ...visualProduct, produtoId: 10, statusEstoque: 'BAIXO' }]);
    else if (path.includes('movimentacoes')) data = paged([movement]);
    else if (path === '/api/relatorios/pecas-mais-utilizadas') data = paged([{ ...visualProduct, produtoId: 10, quantidadeTotalUtilizada: 4, quantidadeOs: 3 }]);
    else if (path === '/api/relatorios/clientes') data = paged([{ ...visualClient, clienteId: 42, quantidadeEquipamentos: 1, quantidadeOs: 1, valorAcumulado: 275 }]);
    else if (path === '/api/relatorios/equipamentos') data = paged([{ ...visualMachine, maquinaId: 9, tipo: 'MAQUINA_SOLDA', quantidadeOs: 1, valorAcumulado: 275 }]);
    else if (path === '/api/clientes') data = paged([visualClient]);
    else if (path.endsWith('/maquinas') || path === '/api/maquinas') data = paged([visualMachine]);
    else if (path.endsWith('/ordens-servico') || path.endsWith('/historico')) data = paged([visualOrder]);
    else if (path === '/api/produtos' || path === '/api/estoque') data = paged([visualProduct]);
    else if (path === '/api/busca') data = { clientes: [], maquinas: [], ordensServico: [], produtos: [], totalResultados: 0 };
    else data = paged([]);
    await route.fulfill({ status: 200, json: data });
  });
}

export const visualRoutes = [
  ['login', '/login'], ['dashboard', '/dashboard'], ['clientes', '/clientes'], ['cliente', '/clientes/42'],
  ['maquinas', '/maquinas'], ['maquina', '/maquinas/9'], ['ordens', '/ordens-servico'],
  ['nova-os', '/ordens-servico/nova'], ['ordem', '/ordens-servico/77'], ['produtos', '/produtos'],
  ['estoque', '/estoque'], ['movimentacoes', '/estoque/movimentacoes'], ['relatorios', '/relatorios'], ['configuracoes', '/configuracoes'],
] as const;
