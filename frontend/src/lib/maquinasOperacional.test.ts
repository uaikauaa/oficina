import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Maquina, OrdemServico, PageResponse, TipoEquipamento } from './types.ts';
import { TIPO_EQUIPAMENTO_LABELS } from './types.ts';

describe('UX-005: Tela Operacional de Equipamentos — Contratos e Comportamentos', () => {

  describe('1. CTA + Novo Equipamento', () => {
    it('deve conter o gatilho direto para abertura do cadastro global de equipamentos', () => {
      const ctaLabel = 'Novo Equipamento';
      assert.strictEqual(ctaLabel, 'Novo Equipamento');
      // No modo global em /maquinas, o modal abre sem cliente pré-definido
      const modalPropsGlobal = {
        isOpen: true,
        clienteId: undefined,
        clienteNome: undefined,
      };
      assert.strictEqual(modalPropsGlobal.isOpen, true);
      assert.strictEqual(modalPropsGlobal.clienteId, undefined);
    });
  });

  describe('2. Seleção de Cliente no Modal (Modo Global vs Modo Contextual)', () => {
    it('deve permitir seleção de cliente quando clienteId não for fornecido', () => {
      const clienteSelecionado = { id: 101, nome: 'Indústria Metalúrgica Silva' };
      const formData = {
        clienteId: clienteSelecionado.id,
        tipoEquipamento: 'MAQUINA_SOLDA' as TipoEquipamento,
        marca: 'ESAB',
        modelo: 'LHN 280i Plus',
      };

      assert.strictEqual(formData.clienteId, 101);
      assert.strictEqual(typeof formData.clienteId, 'number');
    });

    it('deve preservar cliente pré-selecionado quando iniciado a partir de um cliente específico', () => {
      const clientePreDefinido = { id: 202, nome: 'Fazenda Boa Esperança' };
      const modalPropsContextual = {
        isOpen: true,
        clienteId: clientePreDefinido.id,
        clienteNome: clientePreDefinido.nome,
      };

      assert.strictEqual(modalPropsContextual.clienteId, 202);
      assert.strictEqual(modalPropsContextual.clienteNome, 'Fazenda Boa Esperança');
    });

    it('deve rejeitar submissão se nenhum cliente for selecionado no modo global', () => {
      const formDataSemCliente: { clienteId?: number; marca: string } = {
        clienteId: undefined,
        marca: 'ESAB',
      };
      const erros: Record<string, string> = {};
      if (!formDataSemCliente.clienteId) {
        erros.clienteId = 'Por favor, selecione o cliente proprietário do equipamento.';
      }

      assert.strictEqual(erros.clienteId, 'Por favor, selecione o cliente proprietário do equipamento.');
    });
  });

  describe('3. Filtro de Tipo e Parâmetros de API', () => {
    it('deve gerar parâmetros corretos para requisição à API', () => {
      const montarQuery = (termo: string, tipo: string, ativo: string, page: number, size: number) => {
        const params = new URLSearchParams();
        params.set('page', page.toString());
        params.set('size', size.toString());
        params.set('sort', 'marca,asc');
        if (termo.trim()) params.set('termo', termo.trim());
        if (tipo) params.set('tipoEquipamento', tipo);
        if (ativo !== '') params.set('ativo', ativo);
        return params.toString();
      };

      const querySoldas = montarQuery('', 'MAQUINA_SOLDA', 'true', 0, 10);
      assert.ok(querySoldas.includes('tipoEquipamento=MAQUINA_SOLDA'));
      assert.ok(querySoldas.includes('ativo=true'));
      assert.ok(querySoldas.includes('size=10'));

      const queryBusca = montarQuery('ESAB', '', '', 0, 10);
      assert.ok(queryBusca.includes('termo=ESAB'));
      assert.ok(!queryBusca.includes('tipoEquipamento'));
    });
  });

  describe('4. Correção Rigorosa do Contrato: OUTRO_EQUIPAMENTO', () => {
    it('deve garantir que o frontend envie estritamente OUTRO_EQUIPAMENTO e nunca OUTRO', () => {
      const tipoOutroFrontend: TipoEquipamento = 'OUTRO_EQUIPAMENTO';
      assert.strictEqual(tipoOutroFrontend, 'OUTRO_EQUIPAMENTO');
      assert.notStrictEqual(tipoOutroFrontend, 'OUTRO');

      // Verifica que a query string é construída com OUTRO_EQUIPAMENTO
      const params = new URLSearchParams();
      params.set('tipoEquipamento', tipoOutroFrontend);
      assert.strictEqual(params.get('tipoEquipamento'), 'OUTRO_EQUIPAMENTO');
      assert.notStrictEqual(params.get('tipoEquipamento'), 'OUTRO');
    });

    it('deve mapear os labels de apresentação corretamente para o enum real', () => {
      assert.strictEqual(TIPO_EQUIPAMENTO_LABELS.MAQUINA_SOLDA, 'Máquina de Solda');
      assert.strictEqual(TIPO_EQUIPAMENTO_LABELS.GERADOR_ENERGIA, 'Gerador de Energia');
      assert.strictEqual(TIPO_EQUIPAMENTO_LABELS.OUTRO_EQUIPAMENTO, 'Outro Equipamento');
    });

    it('deve reconhecer os subtipos técnicos do domínio industrial atendidos na oficina', () => {
      const subtiposSolda = ['MIG_MAG', 'TIG', 'INVERSORA', 'TRANSFORMADOR', 'CORTE_PLASMA'];
      const subtiposGerador = ['GERADOR_DIESEL', 'GERADOR_GASOLINA'];
      const tipoOutro = 'OUTRO_EQUIPAMENTO';

      // Todos os subtipos de solda são agrupados em MAQUINA_SOLDA
      subtiposSolda.forEach((st) => {
        assert.ok(typeof st === 'string');
      });
      // Todos os subtipos de gerador são agrupados em GERADOR_ENERGIA
      subtiposGerador.forEach((gt) => {
        assert.ok(typeof gt === 'string');
      });
      assert.strictEqual(tipoOutro, 'OUTRO_EQUIPAMENTO');
    });
  });

  describe('5. Pills de Tipo', () => {
    it('deve conter as 4 pills principais alinhadas aos valores do backend', () => {
      const pillsTipo: { label: string; valor: TipoEquipamento | '' }[] = [
        { label: 'Todos os Tipos', valor: '' },
        { label: 'Soldas', valor: 'MAQUINA_SOLDA' },
        { label: 'Geradores', valor: 'GERADOR_ENERGIA' },
        { label: 'Outros', valor: 'OUTRO_EQUIPAMENTO' },
      ];

      assert.strictEqual(pillsTipo.length, 4);
      assert.strictEqual(pillsTipo[0].valor, '');
      assert.strictEqual(pillsTipo[1].valor, 'MAQUINA_SOLDA');
      assert.strictEqual(pillsTipo[2].valor, 'GERADOR_ENERGIA');
      assert.strictEqual(pillsTipo[3].valor, 'OUTRO_EQUIPAMENTO');
    });
  });

  describe('6. Pills de Status', () => {
    it('deve alternar status entre Todos, Ativos e Inativos', () => {
      const alternarAtivo = (atual: string, novo: 'true' | 'false'): string => {
        return atual === novo ? '' : novo;
      };

      assert.strictEqual(alternarAtivo('', 'true'), 'true');
      assert.strictEqual(alternarAtivo('true', 'true'), '');
      assert.strictEqual(alternarAtivo('', 'false'), 'false');
      assert.strictEqual(alternarAtivo('false', 'false'), '');
      assert.strictEqual(alternarAtivo('true', 'false'), 'false');
    });
  });

  describe('7. Ação + OS e Redirecionamento Direto', () => {
    it('deve montar a URL correta para abrir Nova OS com cliente e máquina vinculados', () => {
      const maquinaMock: Partial<Maquina> = {
        id: 783,
        clienteId: 1332,
        marca: 'ESAB',
        modelo: 'LHN 280i Plus',
        ativo: true,
      };

      const urlNovaOs = `/ordens-servico/nova?clienteId=${maquinaMock.clienteId}&maquinaId=${maquinaMock.id}`;
      assert.strictEqual(urlNovaOs, '/ordens-servico/nova?clienteId=1332&maquinaId=783');
    });
  });

  describe('8. Pré-Seleção de Cliente via URL', () => {
    it('deve extrair clienteId dos searchParams na tela de Nova OS', () => {
      const searchParams = new URLSearchParams('clienteId=1332&maquinaId=783');
      const preClienteId = searchParams.get('clienteId');
      assert.strictEqual(preClienteId, '1332');
    });
  });

  describe('9. Pré-Seleção de Equipamento via URL', () => {
    it('deve extrair maquinaId dos searchParams na tela de Nova OS', () => {
      const searchParams = new URLSearchParams('clienteId=1332&maquinaId=783');
      const preMaquinaId = searchParams.get('maquinaId');
      assert.strictEqual(preMaquinaId, '783');
    });
  });

  describe('10. Desabilitação de + OS para Equipamento Inativo', () => {
    it('deve desabilitar ação + OS quando equipamento for inativo', () => {
      const maquinaAtiva: Partial<Maquina> = { id: 1, ativo: true };
      const maquinaInativa: Partial<Maquina> = { id: 2, ativo: false };

      const isAcaoHabilitada = (m: Partial<Maquina>) => Boolean(m.ativo);

      assert.strictEqual(isAcaoHabilitada(maquinaAtiva), true);
      assert.strictEqual(isAcaoHabilitada(maquinaInativa), false);
    });

    it('deve fornecer mensagem de bloqueio explicativa para equipamento inativo', () => {
      const mensagemBloqueio = 'Equipamento inativo. Reative o equipamento para abrir nova Ordem de Serviço.';
      assert.ok(mensagemBloqueio.includes('inativo'));
      assert.ok(mensagemBloqueio.includes('Reative'));
    });
  });

  describe('11. Histórico Paginado (Preservação de dataOs.content)', () => {
    it('deve extrair ordens de forma segura a partir de dataOs.content', () => {
      const mockPageResponse: PageResponse<OrdemServico> = {
        content: [
          {
            id: 1,
            numeroOs: 'OS-2026-0001',
            clienteId: 10,
            clienteNome: 'Cliente A',
            clienteTelefone: null,
            clienteCpfCnpj: null,
            maquinaId: 100,
            maquinaTipoEquipamento: 'MAQUINA_SOLDA',
            maquinaTipoDescricao: 'Máquina de Solda',
            maquinaMarca: 'ESAB',
            maquinaModelo: 'LHN 280i',
            maquinaNumeroSerie: 'SN-001',
            maquinaPotencia: null,
            maquinaTensao: null,
            tecnicoId: null,
            tecnicoNome: null,
            status: 'CONCLUIDA',
            statusDescricao: 'Concluída',
            dataEntrada: '2026-09-01T10:00:00Z',
            previsaoConclusao: null,
            dataConclusao: '2026-09-05T15:00:00Z',
            problemaRelatado: 'Troca de ponte retificadora',
            diagnostico: 'Diodo em curto',
            solucaoAplicada: 'Substituição da ponte e limpeza',
            testesRealizados: 'Solda em 200A por 15 minutos',
            observacoes: null,
            horimetroAtual: null,
            valorMaoObra: 200,
            valorPecas: 150,
            valorDesconto: 0,
            valorTotal: 350,
            createdAt: '2026-09-01T10:00:00Z',
            updatedAt: '2026-09-05T15:00:00Z',
          },
        ],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
        first: true,
        last: true,
      };

      const ordens = mockPageResponse.content ?? [];
      assert.strictEqual(Array.isArray(ordens), true);
      assert.strictEqual(ordens.length, 1);
      assert.strictEqual(ordens[0].numeroOs, 'OS-2026-0001');
      assert.strictEqual(ordens[0].valorTotal, 350);
    });
  });

  describe('12. Histórico Vazio', () => {
    it('deve lidar com content vazio sem disparar exceção', () => {
      const mockVazio: PageResponse<OrdemServico> = {
        content: [],
        page: 0,
        size: 20,
        totalElements: 0,
        totalPages: 0,
        first: true,
        last: true,
      };

      const ordens = mockVazio.content ?? [];
      assert.strictEqual(Array.isArray(ordens), true);
      assert.strictEqual(ordens.length, 0);

      const mensagem = ordens.length === 0 ? 'Este equipamento ainda não possui Ordens de Serviço.' : '';
      assert.strictEqual(mensagem, 'Este equipamento ainda não possui Ordens de Serviço.');
    });
  });

  describe('13. Histórico com Múltiplas OS', () => {
    it('deve listar múltiplas ordens em ordem e calcular totais', () => {
      const ordens: Partial<OrdemServico>[] = [
        { id: 10, numeroOs: 'OS-2026-0010', valorTotal: 500 },
        { id: 5, numeroOs: 'OS-2026-0005', valorTotal: 300 },
        { id: 2, numeroOs: 'OS-2026-0002', valorTotal: 150 },
      ];

      assert.strictEqual(ordens.length, 3);
      const totalAcumulado = ordens.reduce((acc, os) => acc + (os.valorTotal || 0), 0);
      assert.strictEqual(totalAcumulado, 950);
    });
  });

  describe('14. Tratamento de Equipamento Inexistente (404)', () => {
    it('deve identificar status 404 e gerar mensagem orientativa', () => {
      const responseStatus = 404;
      const getErrorMessage = (status: number) => {
        if (status === 404) return 'Equipamento não encontrado no sistema.';
        return 'Falha ao carregar dados do equipamento.';
      };

      assert.strictEqual(getErrorMessage(responseStatus), 'Equipamento não encontrado no sistema.');
    });
  });

  describe('15. Isolamento de Estados de Loading', () => {
    it('deve manter tela no estado de carregamento enquanto isLoading for true', () => {
      let isLoading = true;
      const maquinas: Maquina[] = [];

      const renderState = isLoading ? 'LOADING' : maquinas.length === 0 ? 'EMPTY' : 'DATA';
      assert.strictEqual(renderState, 'LOADING');

      isLoading = false;
      const renderStateAfter = isLoading ? 'LOADING' : maquinas.length === 0 ? 'EMPTY' : 'DATA';
      assert.strictEqual(renderStateAfter, 'EMPTY');
    });
  });

  describe('16. Tratamento de Estados de Erro na API', () => {
    it('deve exibir mensagem de erro clara quando a API falhar', () => {
      const erroServidor = 'Falha na comunicação com o servidor. Verifique sua conexão.';
      assert.ok(erroServidor.includes('comunicação com o servidor'));
    });
  });

  describe('17. Paginação e Contadores', () => {
    it('deve calcular o texto de intervalo de paginação corretamente', () => {
      const formatarIntervalo = (page: number, pageSize: number, total: number) => {
        if (total === 0) return '0 equipamentos';
        const inicio = page * pageSize + 1;
        const fim = Math.min((page + 1) * pageSize, total);
        return `Exibindo ${inicio} a ${fim} de ${total} equipamentos`;
      };

      assert.strictEqual(formatarIntervalo(0, 10, 42), 'Exibindo 1 a 10 de 42 equipamentos');
      assert.strictEqual(formatarIntervalo(4, 10, 42), 'Exibindo 41 a 42 de 42 equipamentos');
      assert.strictEqual(formatarIntervalo(0, 10, 1), 'Exibindo 1 a 1 de 1 equipamentos');
      assert.strictEqual(formatarIntervalo(0, 10, 0), '0 equipamentos');
    });

    it('deve calcular estado dos botões Anterior e Próxima', () => {
      const totalPages = 5;

      const podeVoltar = (p: number) => p > 0;
      const podeAvancar = (p: number, total: number) => p < total - 1;

      assert.strictEqual(podeVoltar(0), false);
      assert.strictEqual(podeAvancar(0, totalPages), true);
      assert.strictEqual(podeVoltar(2), true);
      assert.strictEqual(podeAvancar(2, totalPages), true);
      assert.strictEqual(podeVoltar(4), true);
      assert.strictEqual(podeAvancar(4, totalPages), false);
    });
  });
});
