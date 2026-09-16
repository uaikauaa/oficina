import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fetchTodosRegistrosRelatorio } from './csvExportHelper.ts';
import type { PageResponse } from './csvExportHelper.ts';
import { gerarCsv } from './csvHelper.ts';
import type { ColunaCsv } from './csvHelper.ts';

interface ItemTeste {
  id: number;
  codigo: string;
  cliente: string;
  equipamento: string;
  status: string;
  data: string;
  valor: number;
}

function mockPageResponse<T>(
  todos: T[],
  page: number,
  size: number
): PageResponse<T> {
  const start = page * size;
  const end = Math.min(start + size, todos.length);
  const content = todos.slice(start, end);
  const totalPages = Math.ceil(todos.length / size) || 1;

  return {
    content,
    page,
    size,
    totalElements: todos.length,
    totalPages,
    first: page === 0,
    last: page >= totalPages - 1,
  };
}

function gerarItensMock(quantidade: number, filtroStatus = 'CONCLUIDA'): ItemTeste[] {
  return Array.from({ length: quantidade }, (_, i) => ({
    id: i + 1,
    codigo: `OS-2026-${String(i + 1).padStart(4, '0')}`,
    cliente: `Cliente ${i + 1}`,
    equipamento: `Equipamento ${i + 1}`,
    status: filtroStatus,
    data: '2026-03-15T10:00:00Z',
    valor: (i + 1) * 150.5,
  }));
}

const colunasTeste: ColunaCsv<ItemTeste>[] = [
  { cabecalho: 'ID', acessar: (i) => i.id },
  { cabecalho: 'Código OS', acessar: (i) => i.codigo },
  { cabecalho: 'Cliente', acessar: (i) => i.cliente },
  { cabecalho: 'Equipamento', acessar: (i) => i.equipamento },
  { cabecalho: 'Status', acessar: (i) => i.status },
  { cabecalho: 'Valor', acessar: (i) => i.valor.toFixed(2) },
];

describe('ISSUE-002: Exportação CSV Completa sem Truncamento na Página Atual', () => {
  it('deve exportar exatamente 1 registro quando o conjunto filtrado tiver 1 item', async () => {
    const itens = gerarItensMock(1);
    const resultado = await fetchTodosRegistrosRelatorio<ItemTeste>(
      async (p, s) => mockPageResponse(itens, p, s),
      20
    );

    assert.equal(resultado.length, 1);
    assert.equal(resultado[0].id, 1);

    const csv = gerarCsv(colunasTeste, resultado);
    const linhas = csv.trim().split('\n');
    assert.equal(linhas.length, 2); // 1 cabeçalho + 1 registro
  });

  it('deve exportar exatamente 19 registros em página única', async () => {
    const itens = gerarItensMock(19);
    const resultado = await fetchTodosRegistrosRelatorio<ItemTeste>(
      async (p, s) => mockPageResponse(itens, p, s),
      20
    );

    assert.equal(resultado.length, 19);
    const csv = gerarCsv(colunasTeste, resultado);
    const linhas = csv.trim().split('\n');
    assert.equal(linhas.length, 20); // cabeçalho + 19
  });

  it('deve exportar exatamente 20 registros preenchendo o limite da primeira página', async () => {
    const itens = gerarItensMock(20);
    const resultado = await fetchTodosRegistrosRelatorio<ItemTeste>(
      async (p, s) => mockPageResponse(itens, p, s),
      20
    );

    assert.equal(resultado.length, 20);
    const csv = gerarCsv(colunasTeste, resultado);
    const linhas = csv.trim().split('\n');
    assert.equal(linhas.length, 21);
  });

  it('deve exportar exatamente 21 registros divididos em 2 páginas sem perder o 21º item', async () => {
    const itens = gerarItensMock(21);
    let requisicoesFeitas = 0;

    const resultado = await fetchTodosRegistrosRelatorio<ItemTeste>(
      async (p, s) => {
        requisicoesFeitas++;
        return mockPageResponse(itens, p, s);
      },
      20
    );

    assert.equal(resultado.length, 21);
    assert.equal(requisicoesFeitas, 2);
    assert.equal(resultado[20].id, 21);

    const csv = gerarCsv(colunasTeste, resultado);
    const linhas = csv.trim().split('\n');
    assert.equal(linhas.length, 22); // cabeçalho + 21
  });

  it('deve exportar exatamente 40 registros em 2 páginas completas', async () => {
    const itens = gerarItensMock(40);
    const resultado = await fetchTodosRegistrosRelatorio<ItemTeste>(
      async (p, s) => mockPageResponse(itens, p, s),
      20
    );

    assert.equal(resultado.length, 40);
    assert.equal(resultado[39].id, 40);
  });

  it('deve exportar exatamente 41 registros em 3 páginas sem truncamento', async () => {
    const itens = gerarItensMock(41);
    let requisicoes = 0;

    const resultado = await fetchTodosRegistrosRelatorio<ItemTeste>(
      async (p, s) => {
        requisicoes++;
        return mockPageResponse(itens, p, s);
      },
      20
    );

    assert.equal(resultado.length, 41);
    assert.equal(requisicoes, 3);
    assert.equal(resultado[40].id, 41);

    const csv = gerarCsv(colunasTeste, resultado);
    const linhas = csv.trim().split('\n');
    assert.equal(linhas.length, 42); // cabeçalho + 41
  });

  it('deve exportar 100+ registros com múltiplos lotes respeitando filtros ativos', async () => {
    const totalItens = 155;
    const todosItens = gerarItensMock(totalItens, 'PRONTA');

    // Simula passagem de parâmetros de filtros na requisição paginada
    const filtrosChamados: Record<string, string>[] = [];

    const resultado = await fetchTodosRegistrosRelatorio<ItemTeste>(
      async (page, size) => {
        filtrosChamados.push({
          page: String(page),
          size: String(size),
          status: 'PRONTA',
          periodo: '2026-03',
          cliente: 'Auto Mecânica',
        });
        return mockPageResponse(todosItens, page, size);
      },
      50 // lotes de 50
    );

    assert.equal(resultado.length, 155);
    assert.equal(filtrosChamados.length, 4); // 50 + 50 + 50 + 5 = 4 requisições

    // Todos os filtros foram mantidos em todas as páginas iteradas
    for (const f of filtrosChamados) {
      assert.equal(f.status, 'PRONTA');
      assert.equal(f.periodo, '2026-03');
      assert.equal(f.cliente, 'Auto Mecânica');
    }

    const csv = gerarCsv(colunasTeste, resultado);
    const linhas = csv.trim().split('\n');
    assert.equal(linhas.length, 156); // cabeçalho + 155
  });

  it('deve retornar array vazio quando resposta não contiver nenhum registro', async () => {
    const resultado = await fetchTodosRegistrosRelatorio<ItemTeste>(
      async (p, s) => mockPageResponse([], p, s),
      20
    );

    assert.equal(resultado.length, 0);
  });
});
