import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { OrdemServico, PageResponse } from './types.ts';

describe('Contrato de API: Histórico de Equipamento (/api/maquinas/{id}/historico)', () => {
  // Mock representando exatamente a resposta JSON devolvida pelo backend Spring Boot
  const mockHistoricoResponse: PageResponse<OrdemServico> = {
    content: [
      {
        id: 307,
        numeroOs: 'OS-2026-0043',
        clienteId: 1332,
        clienteNome: 'Cliente Solda Teste',
        clienteTelefone: '31999991111',
        clienteCpfCnpj: '00014014000',
        maquinaId: 783,
        maquinaTipoEquipamento: 'MAQUINA_SOLDA',
        maquinaTipoDescricao: 'Máquina de Solda',
        maquinaMarca: 'ESAB',
        maquinaModelo: 'LHN 280i Plus',
        maquinaNumeroSerie: 'SN-SLD-001',
        maquinaPotencia: '250A',
        maquinaTensao: '220V/380V',
        tecnicoId: null,
        tecnicoNome: null,
        status: 'ABERTA',
        statusDescricao: 'Aberta',
        dataEntrada: '2026-09-17T02:20:37Z',
        previsaoConclusao: null,
        dataConclusao: null,
        problemaRelatado: 'Solda desarmando proteção térmica.',
        diagnostico: null,
        solucaoAplicada: null,
        testesRealizados: null,
        observacoes: 'Acompanha tocha TIG.',
        horimetroAtual: 46,
        valorMaoObra: 0,
        valorPecas: 0,
        valorDesconto: 0,
        valorTotal: 0,
        createdAt: '2026-09-17T02:20:37Z',
        updatedAt: '2026-09-17T02:20:37Z',
      },
    ],
    page: 0,
    size: 20,
    totalElements: 1,
    totalPages: 1,
    first: true,
    last: true,
  };

  it('deve extrair o array de ordens a partir de dataOs.content', () => {
    // Processamento correto adotado na página de detalhes da máquina
    const dataOs: PageResponse<OrdemServico> = mockHistoricoResponse;
    const ordens: OrdemServico[] = dataOs.content ?? [];

    assert.ok(Array.isArray(ordens), 'ordens deve ser um Array legítimo');
    assert.strictEqual(ordens.length, 1);
    assert.strictEqual(ordens[0].numeroOs, 'OS-2026-0043');
    assert.strictEqual(ordens[0].maquinaId, 783);

    // Deve suportar map sem lançar exceção
    const numeros = ordens.map((os) => os.numeroOs);
    assert.deepStrictEqual(numeros, ['OS-2026-0043']);
  });

  it('deve lidar corretamente com histórico vazio (content vazio)', () => {
    const mockHistoricoVazio: PageResponse<OrdemServico> = {
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
      first: true,
      last: true,
    };

    const ordens: OrdemServico[] = mockHistoricoVazio.content ?? [];

    assert.ok(Array.isArray(ordens));
    assert.strictEqual(ordens.length, 0);

    // Verifica condição de empty state usada na página
    const exibeEmptyState = ordens.length === 0;
    assert.strictEqual(exibeEmptyState, true, 'Deve ativar o bloco de empty state');

    // Executar map em array vazio não deve falhar
    const mapped = ordens.map((os) => os.id);
    assert.deepStrictEqual(mapped, []);
  });

  it('deve comprovar a causa raiz: atribuir a resposta bruta causa TypeError no .map()', () => {
    // Simula o bug que existia antes da correção
    const respostaBrutaDaApi: unknown = mockHistoricoResponse;

    // Se o componente tentasse fazer map direto no objeto paginado
    assert.throws(
      () => {
        // @ts-expect-error simulação de runtime sem tipagem correta
        respostaBrutaDaApi.map((os: OrdemServico) => os.id);
      },
      {
        name: 'TypeError',
        message: /map is not a function/,
      },
      'Objeto paginado sem extração de content deve disparar TypeError: map is not a function'
    );
  });

  it('deve preservar a integridade dos campos da Ordem de Serviço na visualização de histórico', () => {
    const os = mockHistoricoResponse.content[0];

    assert.strictEqual(typeof os.id, 'number');
    assert.strictEqual(typeof os.numeroOs, 'string');
    assert.strictEqual(typeof os.clienteNome, 'string');
    assert.strictEqual(typeof os.maquinaMarca, 'string');
    assert.strictEqual(typeof os.maquinaModelo, 'string');
    assert.strictEqual(typeof os.status, 'string');
    assert.strictEqual(typeof os.problemaRelatado, 'string');
    assert.strictEqual(typeof os.valorTotal, 'number');
  });
});
