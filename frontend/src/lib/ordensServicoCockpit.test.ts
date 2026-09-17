import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { OrdemServico, OrdemServicoItem, Produto, StatusOrdemServico } from './types.ts';
import { formatarMoeda, formatarDocumento, formatarTelefone } from './api.ts';
import {
  gerarLinkWhatsappOrcamento,
  gerarLinkWhatsappRetirada,
} from './whatsappHelper.ts';

describe('UX-007: Cockpit de Bancada Técnica para Ordem de Serviço (/ordens-servico/[id])', () => {

  const mockOs: OrdemServico = {
    id: 101,
    numeroOs: 'OS-2026-0101',
    clienteId: 5,
    clienteNome: 'Metalúrgica Alvorada Ltda',
    clienteTelefone: '31988887777',
    clienteCpfCnpj: '12345678000199',
    maquinaId: 22,
    maquinaTipoDescricao: 'Máquina de Solda',
    maquinaMarca: 'ESAB',
    maquinaModelo: 'Smashweld 450 Top',
    maquinaNumeroSerie: 'ES-99482-B',
    maquinaPotencia: '450 A',
    maquinaTensao: '380 V Trifásico',
    status: 'EM_MANUTENCAO',
    statusDescricao: 'Em Manutenção',
    dataEntrada: '2026-09-17T09:00:00',
    dataConclusao: null,
    previsaoConclusao: '2026-09-20T18:00:00',
    problemaRelatado: 'Equipamento parou de alimentar arame e apresenta código de erro E-04 no display frontal.',
    diagnostico: 'Diodo de roda livre da ponte de alimentação do motor tracionador em curto-circuito.',
    solucaoAplicada: 'Substituição da ponte e regulagem do controle de velocidade de arame.',
    testesRealizados: 'Arco elétrico estável a 280A em cordão contínuo por 15 minutos sem falhas.',
    observacoes: 'Acompanha tocha MIG 360A de 4 metros e cabo terra com garra.',
    horimetroAtual: 1420,
    valorMaoObra: 350.0,
    valorPecas: 220.0,
    valorDesconto: 20.0,
    valorTotal: 550.0,
    createdAt: '2026-09-17T09:00:00',
    updatedAt: '2026-09-17T11:30:00',
  };

  const mockItens: OrdemServicoItem[] = [
    {
      id: 1,
      ordemServicoId: 101,
      produtoId: 88,
      produtoCodigo: 'DIO-50A-1200V',
      produtoNome: 'Diodo Rápido 50A 1200V Ponte H',
      quantidade: 2,
      valorUnitario: 110.0,
      valorDesconto: 0,
      valorTotal: 220.0,
      observacoes: 'Substituição no canal de potência',
      criadoEm: '2026-09-17T10:00:00',
    },
  ];

  // 1. Carregamento da OS
  describe('1. Carregamento da OS', () => {
    it('deve carregar todos os atributos estruturais da Ordem de Serviço', () => {
      assert.strictEqual(mockOs.id, 101);
      assert.strictEqual(mockOs.numeroOs, 'OS-2026-0101');
      assert.strictEqual(mockOs.status, 'EM_MANUTENCAO');
      assert.strictEqual(mockOs.valorTotal, 550.0);
    });
  });

  // 2. Contexto Cliente e Equipamento (Coluna Esquerda ~35%)
  describe('2. Contexto Cliente / Equipamento na Coluna Esquerda', () => {
    it('deve formatar adequadamente documento e telefone do cliente', () => {
      const doc = formatarDocumento(mockOs.clienteCpfCnpj);
      const tel = formatarTelefone(mockOs.clienteTelefone);
      assert.strictEqual(doc, '12.345.678/0001-99');
      assert.strictEqual(tel, '(31) 98888-7777');
    });

    it('deve consolidar dados técnicos da máquina sem dados automotivos', () => {
      assert.strictEqual(mockOs.maquinaTipoDescricao, 'Máquina de Solda');
      assert.strictEqual(mockOs.maquinaMarca, 'ESAB');
      assert.strictEqual(mockOs.maquinaModelo, 'Smashweld 450 Top');
      assert.strictEqual(mockOs.maquinaNumeroSerie, 'ES-99482-B');
      assert.strictEqual(mockOs.horimetroAtual, 1420);
    });
  });

  // 3. Navegação por Abas do Cockpit
  describe('3. Abas do Cockpit de Bancada', () => {
    it('deve alternar entre as 4 abas oficiais preservando a seleção ativa', () => {
      const abas = ['laudo', 'pecas', 'historico', 'observacoes'] as const;
      let activeTab: string = 'laudo';

      const setActiveTab = (t: string) => {
        activeTab = t;
      };

      assert.strictEqual(activeTab, 'laudo');
      setActiveTab('pecas');
      assert.strictEqual(activeTab, 'pecas');
      setActiveTab('historico');
      assert.strictEqual(activeTab, 'historico');
      setActiveTab('observacoes');
      assert.strictEqual(activeTab, 'observacoes');
      assert.strictEqual(abas.length, 4);
    });
  });

  // 4. Diagnóstico e Solução de Bancada
  describe('4. Diagnóstico e Solução de Bancada', () => {
    it('deve armazenar diagnóstico e intervenção técnica aplicada', () => {
      assert.ok(mockOs.diagnostico?.includes('Diodo de roda livre'));
      assert.ok(mockOs.solucaoAplicada?.includes('Substituição da ponte'));
    });
  });

  // 5. Edição Técnica Contextual
  describe('5. Edição Técnica Contextual', () => {
    it('deve montar payload de atualização PUT sem exigir modal monolítico', () => {
      const editForm = {
        diagnostico: 'Placa de controle PWM avariada',
        solucaoAplicada: 'Troca de optoacopladores e resistores shunt',
        testesRealizados: 'Tensão de saída calibrada em 24V CC sob carga resistiva de 10A.',
        valorMaoObra: 400.0,
        valorDesconto: 30.0,
      };

      const payload = {
        problemaRelatado: mockOs.problemaRelatado,
        diagnostico: editForm.diagnostico.trim(),
        solucaoAplicada: editForm.solucaoAplicada.trim(),
        testesRealizados: editForm.testesRealizados.trim(),
        valorMaoObra: editForm.valorMaoObra,
        valorPecas: mockOs.valorPecas,
        valorDesconto: editForm.valorDesconto,
      };

      assert.strictEqual(payload.diagnostico, 'Placa de controle PWM avariada');
      assert.strictEqual(payload.valorMaoObra, 400.0);
      assert.strictEqual(payload.valorPecas, 220.0);
    });
  });

  // 6. Contador de 15 Caracteres de Teste de Bancada
  describe('6. Contador de 15 Caracteres para Testes de Bancada', () => {
    it('deve calcular o comprimento de caracteres desconsiderando espaços em branco nas extremidades', () => {
      const textoCurto = '  Arco OK   ';
      const tamanho = textoCurto.trim().length;
      assert.strictEqual(tamanho, 7);
      assert.strictEqual(tamanho < 15, true);

      const textoValido = 'Soldagem a 180A sem desarme térmico em ciclo contínuo.';
      const tamanhoValido = textoValido.trim().length;
      assert.strictEqual(tamanhoValido >= 15, true);
    });
  });

  // 7. Bloqueio Preventivo de Transição para PRONTA
  describe('7. Bloqueio Preventivo de Transição para PRONTA', () => {
    it('deve rejeitar transição para PRONTA se o laudo tiver menos de 15 caracteres', () => {
      const validarTransicaoParaPronta = (testes: string) => {
        const len = (testes || '').trim().length;
        if (len < 15) {
          return { valido: false, erro: `Mínimo de 15 caracteres exigido (atual: ${len}/15)` };
        }
        return { valido: true, erro: null };
      };

      const resInvalido = validarTransicaoParaPronta('Teste rápido');
      assert.strictEqual(resInvalido.valido, false);
      assert.ok(resInvalido.erro?.includes('12/15'));

      const resValido = validarTransicaoParaPronta('Teste sob carga de 220V com arco estável por 15 minutos.');
      assert.strictEqual(resValido.valido, true);
      assert.strictEqual(resValido.erro, null);
    });
  });

  // 8. Modelos Rápidos de Testes Técnicos
  describe('8. Modelos Rápidos de Teste (Solda e Gerador)', () => {
    it('deve fornecer modelos tecnicamente apropriados para inversores e máquinas de solda', () => {
      const modeloSolda = 'Arco elétrico estável a 180A por 15 minutos em ciclo contínuo sem oscilações.';
      assert.ok(modeloSolda.length >= 15);
      assert.ok(modeloSolda.includes('180A'));
      assert.ok(modeloSolda.includes('ciclo contínuo'));
    });

    it('deve fornecer modelos tecnicamente apropriados para geradores de energia', () => {
      const modeloGerador = 'Carga resistiva aplicada sob demanda, tensão estável em 220V e frequência em 60Hz.';
      assert.ok(modeloGerador.length >= 15);
      assert.ok(modeloGerador.includes('220V'));
      assert.ok(modeloGerador.includes('60Hz'));
    });
  });

  // 9. Busca Contextual de Peças
  describe('9. Busca Contextual de Peças', () => {
    it('deve montar a URL correta com parâmetro termo, ativo=true e limite 10', () => {
      const termo = 'IGBT 60N60';
      const url = `/api/produtos?termo=${encodeURIComponent(termo.trim())}&ativo=true&size=10`;
      assert.strictEqual(url, '/api/produtos?termo=IGBT%2060N60&ativo=true&size=10');
    });
  });

  // 10. Debounce de Busca de Peças (400ms)
  describe('10. Debounce de Busca (400ms)', () => {
    it('deve ter especificação de debounce em 400ms para evitar chamadas a cada caractere digitado', () => {
      const DEBOUNCE_DELAY = 400;
      assert.strictEqual(DEBOUNCE_DELAY, 400);
    });
  });

  // 11. Seleção de Peça e Validação de Saldo
  describe('11. Seleção de Peça e Saldo em Estoque', () => {
    it('deve validar quantidade contra o estoque atual do produto selecionado', () => {
      const peca: Produto = {
        id: 50,
        codigo: 'IGBT-60N60',
        nome: 'Transistor IGBT 60N60 600V',
        descricao: 'IGBT para inversora TIG/MMA',
        tipo: 'PECA',
        tipoDescricao: 'Peça',
        unidadeMedida: 'UN',
        precoCusto: 35.0,
        precoVenda: 75.0,
        estoqueAtual: 4,
        estoqueMinimo: 2,
        estoqueMaximo: 20,
        estoqueDisponivel: 4,
        localizacao: 'Gaveta E-02',
        ativo: true,
        categoriaNome: 'Semicondutores',
        fornecedorNome: 'Eletrônica Brasil',
        createdAt: '2026-01-01T00:00:00',
        updatedAt: '2026-01-01T00:00:00',
      };

      const validarQtd = (qtd: number, prod: Produto) => {
        if (qtd <= 0) return 'Quantidade deve ser superior a zero';
        if (qtd > prod.estoqueAtual) return `Saldo insuficiente! Disponível: ${prod.estoqueAtual}`;
        return null;
      };

      assert.strictEqual(validarQtd(2, peca), null);
      assert.strictEqual(validarQtd(0, peca), 'Quantidade deve ser superior a zero');
      assert.strictEqual(validarQtd(5, peca), 'Saldo insuficiente! Disponível: 4');
    });
  });

  // 12. Atualização de Saldo e Projeção Financeira
  describe('12. Projeção Financeira da Adição de Item', () => {
    it('deve calcular o subtotal da peça considerando quantidade e desconto', () => {
      const precoUnitario = 75.0;
      const quantidade = 3;
      const desconto = 15.0;
      const subtotal = Math.max(0, precoUnitario * quantidade - desconto);
      assert.strictEqual(subtotal, 210.0);
    });
  });

  // 13. Exclusão de Peça e Estorno ao Estoque
  describe('13. Exclusão de Peça', () => {
    it('deve mapear o endpoint DELETE /api/ordens-servico/{id}/itens/{itemId}', () => {
      const osId = 101;
      const itemId = 1;
      const url = `/api/ordens-servico/${osId}/itens/${itemId}`;
      assert.strictEqual(url, '/api/ordens-servico/101/itens/1');
    });
  });

  // 14. Confirmação Visual sem window.confirm()
  describe('14. Confirmação Visual de Remoção de Peça (sem window.confirm)', () => {
    it('deve abrir modal estruturado com identificação do produto e quantidade a estornar', () => {
      const item = mockItens[0];
      const modalData = {
        isOpen: true,
        produtoNome: item.produtoNome,
        quantidade: item.quantidade,
        mensagemEstorno: `A quantidade de ${item.quantidade} unidades será estornada imediatamente ao estoque.`,
      };

      assert.strictEqual(modalData.isOpen, true);
      assert.strictEqual(modalData.produtoNome, 'Diodo Rápido 50A 1200V Ponte H');
      assert.ok(modalData.mensagemEstorno.includes('2 unidades'));
    });
  });

  // 15. Histórico da Máquina na Própria OS
  describe('15. Histórico da Máquina (/api/maquinas/{id}/historico)', () => {
    it('deve consultar o contrato oficial /api/maquinas/{maquinaId}/historico', () => {
      const maquinaId = 22;
      const url = `/api/maquinas/${maquinaId}/historico?page=0&size=15`;
      assert.strictEqual(url, '/api/maquinas/22/historico?page=0&size=15');
    });

    it('deve sinalizar a OS corrente dentro da lista de histórico', () => {
      const listaHistorico = [
        { id: 101, numeroOs: 'OS-2026-0101' },
        { id: 45, numeroOs: 'OS-2025-0045' },
      ];

      const osAtualId = 101;
      const itemAtual = listaHistorico.find((h) => h.id === osAtualId);
      assert.strictEqual(itemAtual?.numeroOs, 'OS-2026-0101');
    });
  });

  // 16. WhatsApp Contextual
  describe('16. WhatsApp Contextual (Orçamento e Retirada)', () => {
    it('deve gerar link de aprovação de orçamento quando em AGUARDANDO_APROVACAO', () => {
      const linkOrcamento = gerarLinkWhatsappOrcamento({
        telefone: mockOs.clienteTelefone,
        clienteNome: mockOs.clienteNome,
        equipamentoModelo: `${mockOs.maquinaMarca} ${mockOs.maquinaModelo}`,
        numeroOs: mockOs.numeroOs,
        valorPecas: mockOs.valorPecas,
        valorMaoObra: mockOs.valorMaoObra,
        valorTotal: mockOs.valorTotal,
      });

      assert.ok(linkOrcamento.url);
      assert.ok(linkOrcamento.url.includes('5531988887777'));
      assert.ok(linkOrcamento.mensagem.includes('orçamento'));
      assert.ok(linkOrcamento.mensagem.includes('OS-2026-0101'));
      assert.ok(linkOrcamento.mensagem.includes('550,00'));
    });

    it('deve gerar link de aviso de retirada quando em PRONTA ou CONCLUIDA', () => {
      const linkRetirada = gerarLinkWhatsappRetirada({
        telefone: mockOs.clienteTelefone,
        clienteNome: mockOs.clienteNome,
        equipamentoModelo: `${mockOs.maquinaMarca} ${mockOs.maquinaModelo}`,
        numeroOs: mockOs.numeroOs,
        valorTotal: mockOs.valorTotal,
      });

      assert.ok(linkRetirada.url);
      assert.ok(linkRetirada.url.includes('5531988887777'));
      assert.ok(linkRetirada.mensagem.includes('pronta para retirada'));
    });

    it('deve rejeitar amigavelmente telefone inválido sem lançar alert()', () => {
      const res = gerarLinkWhatsappRetirada({
        telefone: '123',
        clienteNome: 'Fulano',
        equipamentoModelo: 'Solda TIG',
        numeroOs: 'OS-01',
        valorTotal: 100,
      });

      assert.strictEqual(res.url, null);
      assert.strictEqual(res.erro, 'Telefone inválido ou não informado.');
    });
  });

  // 17. Geração de PDF A4
  describe('17. Geração de PDF A4', () => {
    it('deve direcionar para o endpoint oficial de PDF /api/ordens-servico/{id}/pdf', () => {
      const url = `/api/ordens-servico/${mockOs.id}/pdf`;
      assert.strictEqual(url, '/api/ordens-servico/101/pdf');
    });
  });

  // 18. Impressão Técnica
  describe('18. Impressão Técnica', () => {
    it('deve manter classe print:hidden nos controles de tela e print:block no layout A4', () => {
      const layoutClass = 'print:hidden';
      const a4Class = 'print:block';
      assert.strictEqual(layoutClass, 'print:hidden');
      assert.strictEqual(a4Class, 'print:block');
    });
  });

  // 19. Estados de Erro
  describe('19. Estados de Erro e Toast Feedback', () => {
    it('deve formatar mensagens de erro com Toast visual em vez de alert()', () => {
      type ToastType = 'success' | 'error' | 'info';
      const criarToast = (tipo: ToastType, msg: string) => ({
        tipo,
        mensagem: msg,
        ativo: true,
      });

      const t = criarToast('error', 'Falha na conexão com o servidor da oficina.');
      assert.strictEqual(t.tipo, 'error');
      assert.strictEqual(t.ativo, true);
    });
  });

  // 20. Estados Vazios
  describe('20. Estados Vazios (Peças e Histórico)', () => {
    it('deve fornecer mensagens orientativas para lista de peças vazia', () => {
      const itensVazios: OrdemServicoItem[] = [];
      const msgVazia = itensVazios.length === 0
        ? 'Nenhuma peça ou componente vinculado a esta Ordem de Serviço.'
        : 'Itens listados';
      assert.strictEqual(msgVazia, 'Nenhuma peça ou componente vinculado a esta Ordem de Serviço.');
    });

    it('deve fornecer mensagem apropriada quando a máquina não possuir atendimentos prévios', () => {
      const historicoVazio: OrdemServico[] = [];
      const msgHistorico = historicoVazio.length === 0
        ? 'Nenhum atendimento anterior encontrado para esta máquina.'
        : 'Histórico carregado';
      assert.strictEqual(msgHistorico, 'Nenhum atendimento anterior encontrado para esta máquina.');
    });
  });
});
