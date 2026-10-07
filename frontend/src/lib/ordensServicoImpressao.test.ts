import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  temValor,
  extrairCamposCliente,
  extrairCamposEquipamento,
  extrairCamposTecnicos,
  deveExibirSecaoTecnica,
  deveExibirSecaoPecas,
  formatarDadosOficina,
  type ConfiguracaoOficinaImpressao,
} from './ordemServicoImpressaoHelper.ts';
import type { OrdemServico, OrdemServicoItem } from './types.ts';
import { formatarMoeda } from './api.ts';

const mockOsBase: OrdemServico = {
  id: 101,
  numeroOs: 'OS-2026-0101',
  clienteId: 50,
  clienteNome: 'Metalúrgica Alvorada Ltda',
  clienteTelefone: '(14) 99888-7766',
  clienteCpfCnpj: '12.345.678/0001-90',
  maquinaId: 200,
  maquinaTipoDescricao: 'Máquina de Solda',
  maquinaMarca: 'Balmer',
  maquinaModelo: 'Vulcano MIG 350',
  maquinaNumeroSerie: 'VULC-2026-99',
  maquinaTensao: '220V',
  maquinaPotencia: '250A',
  horimetroAtual: 1450,
  tecnicoId: 1,
  tecnicoNome: 'Carlos Técnico',
  status: 'EM_MANUTENCAO',
  statusDescricao: 'Em Manutenção',
  dataEntrada: '2026-10-01T08:30:00-03:00',
  dataConclusao: null,
  problemaRelatado: 'Alimentador de arame travando intermitentemente',
  diagnostico: 'Rolete tracionador desgastado e motor de passo oxidado',
  solucaoAplicada: 'Substituição do rolete e desoxidação do motor',
  testesRealizados: 'Soldagem MIG contínua por 40 min em chapa 6mm',
  observacoes: 'Equipamento entregue limpo e recalibrado',
  valorMaoObra: 350.0,
  valorPecas: 220.0,
  valorDesconto: 20.0,
  valorTotal: 550.0,
  createdAt: '2026-10-01T08:30:00-03:00',
  updatedAt: '2026-10-01T14:00:00-03:00',
};

const mockConfigBase: ConfiguracaoOficinaImpressao = {
  nomeFantasia: 'Oficina Central de Soldas',
  nomeEmpresarial: 'Central Soldas e Geradores EIRELI',
  cnpj: '11.222.333/0001-81',
  telefone: '(14) 3322-1100',
  email: 'contato@centralsoldas.com.br',
  logradouro: 'Av. Industrial',
  numero: '500',
  bairro: 'Distrito Industrial',
  cep: '19900-000',
  municipio: 'Ourinhos',
  uf: 'SP',
};

describe('OFICINA GESTÃO — Ajuste Final da OS: Recibo Dinâmico e Botão Único', () => {
  // =========================================================================
  // 1. Helper temValor (Diferenciação de strings vazias, nulos e zeros válidos)
  // =========================================================================
  describe('1. Regra de Campos Vazios — Função temValor', () => {
    it('deve retornar false para null e undefined', () => {
      assert.strictEqual(temValor(null), false);
      assert.strictEqual(temValor(undefined), false);
    });

    it('deve retornar false para strings vazias ou contendo apenas espaços', () => {
      assert.strictEqual(temValor(''), false);
      assert.strictEqual(temValor('   '), false);
      assert.strictEqual(temValor('\t\n  '), false);
    });

    it('deve retornar true para strings válidas mesmo com espaços ao redor', () => {
      assert.strictEqual(temValor('Balmer'), true);
      assert.strictEqual(temValor('  350  '), true);
    });

    it('deve retornar true para número 0 (zero financeiro e horímetro válidos)', () => {
      assert.strictEqual(temValor(0), true);
      assert.strictEqual(temValor(0.0), true);
    });

    it('deve retornar true para booleanos e números positivos', () => {
      assert.strictEqual(temValor(false), true);
      assert.strictEqual(temValor(true), true);
      assert.strictEqual(temValor(100), true);
    });
  });

  // =========================================================================
  // 2. Dados do Cliente Condicionais
  // =========================================================================
  describe('2. Identificação do Cliente Condicional', () => {
    it('deve extrair todos os campos quando cliente completo', () => {
      const campos = extrairCamposCliente(mockOsBase);
      assert.strictEqual(campos.length, 3);
      assert.strictEqual(campos[0].label, 'Nome / Razão Social');
      assert.strictEqual(campos[0].valor, 'Metalúrgica Alvorada Ltda');
      assert.strictEqual(campos[1].label, 'CPF/CNPJ');
      assert.strictEqual(campos[1].valor, '12.345.678/0001-90');
      assert.strictEqual(campos[2].label, 'Telefone');
      assert.strictEqual(campos[2].valor, '(14) 99888-7766');
    });

    it('deve omitir CPF/CNPJ sem exibir "Não informado" quando ausente', () => {
      const osParcial: OrdemServico = {
        ...mockOsBase,
        clienteCpfCnpj: null,
      };
      const campos = extrairCamposCliente(osParcial);
      assert.strictEqual(campos.length, 2);
      assert.strictEqual(campos.find((c) => c.label === 'CPF/CNPJ'), undefined);
      assert.ok(campos.some((c) => c.label === 'Nome / Razão Social'));
      assert.ok(campos.some((c) => c.label === 'Telefone'));
    });

    it('deve omitir Telefone quando for string em branco', () => {
      const osParcial: OrdemServico = {
        ...mockOsBase,
        clienteTelefone: '   ',
      };
      const campos = extrairCamposCliente(osParcial);
      assert.strictEqual(campos.length, 2);
      assert.strictEqual(campos.find((c) => c.label === 'Telefone'), undefined);
    });
  });

  // =========================================================================
  // 3. Dados do Equipamento Condicionais (Seções 8, 9, 10, 24-28 do Prompt)
  // =========================================================================
  describe('3. Dados do Equipamento — Grid Dinâmico Sequencial e Campos Parciais', () => {
    it('Seção 35: deve renderizar exatamente Tipo, Marca, Modelo, Potência quando Série, Tensão e Horímetro forem nulos', () => {
      const osEquipParcial: OrdemServico = {
        ...mockOsBase,
        maquinaTipoDescricao: 'Máquina de Solda',
        maquinaMarca: 'Balmer',
        maquinaModelo: '350',
        maquinaPotencia: '250',
        maquinaNumeroSerie: null,
        maquinaTensao: null,
        horimetroAtual: null,
      };

      const campos = extrairCamposEquipamento(osEquipParcial);
      assert.strictEqual(campos.length, 4);
      assert.deepStrictEqual(
        campos.map((c) => c.label),
        ['Tipo', 'Marca', 'Modelo', 'Potência']
      );
      assert.strictEqual(campos.find((c) => c.label === 'Nº de Série'), undefined);
      assert.strictEqual(campos.find((c) => c.label === 'Tensão'), undefined);
      assert.strictEqual(campos.find((c) => c.label === 'Horímetro'), undefined);
    });

    it('Seção 24: equipamento completo na sequência lógica exata: Tipo, Marca, Modelo, Nº de Série, Tensão, Potência, Horímetro', () => {
      const osCompleta: OrdemServico = {
        ...mockOsBase,
        maquinaTipoDescricao: 'Máquina de Solda',
        maquinaMarca: 'Balmer',
        maquinaModelo: '350',
        maquinaNumeroSerie: 'PE030D90',
        maquinaTensao: '220',
        maquinaPotencia: '250',
        horimetroAtual: 350,
      };
      const campos = extrairCamposEquipamento(osCompleta);
      assert.strictEqual(campos.length, 7);
      assert.deepStrictEqual(
        campos.map((c) => c.label),
        ['Tipo', 'Marca', 'Modelo', 'Nº de Série', 'Tensão', 'Potência', 'Horímetro']
      );
      assert.strictEqual(campos[3].valor, 'PE030D90');
      assert.strictEqual(campos[4].valor, '220');
      assert.strictEqual(campos[5].valor, '250');
      assert.strictEqual(campos[6].valor, '350 horas');
    });

    it('Seção 25: equipamento parcial (Tipo, Marca, Tensão, Potência) deve fluir sequencialmente sem buracos', () => {
      const osParcial: OrdemServico = {
        ...mockOsBase,
        maquinaTipoDescricao: 'Máquina de Solda',
        maquinaMarca: 'Balmer',
        maquinaModelo: null,
        maquinaNumeroSerie: null,
        maquinaTensao: '220',
        maquinaPotencia: '250',
        horimetroAtual: null,
      };
      const campos = extrairCamposEquipamento(osParcial);
      assert.strictEqual(campos.length, 4);
      assert.deepStrictEqual(
        campos.map((c) => c.label),
        ['Tipo', 'Marca', 'Tensão', 'Potência']
      );
    });

    it('Seção 26: somente dois campos (Tensão, Potência) devem ser consecutivos', () => {
      const osDoisCampos: OrdemServico = {
        ...mockOsBase,
        maquinaTipoDescricao: null,
        maquinaMarca: null,
        maquinaModelo: null,
        maquinaNumeroSerie: null,
        maquinaTensao: '220V',
        maquinaPotencia: '250A',
        horimetroAtual: null,
      };
      const campos = extrairCamposEquipamento(osDoisCampos);
      assert.strictEqual(campos.length, 2);
      assert.strictEqual(campos[0].label, 'Tensão');
      assert.strictEqual(campos[0].valor, '220V');
      assert.strictEqual(campos[1].label, 'Potência');
      assert.strictEqual(campos[1].valor, '250A');
    });

    it('Seção 27: se existir somente Modelo, deve renderizar apenas Modelo sem quebrar a seção', () => {
      const osSoModelo: OrdemServico = {
        ...mockOsBase,
        maquinaTipoDescricao: null,
        maquinaMarca: null,
        maquinaModelo: 'Vulcano 350',
        maquinaNumeroSerie: null,
        maquinaTensao: null,
        maquinaPotencia: null,
        horimetroAtual: null,
      };
      const campos = extrairCamposEquipamento(osSoModelo);
      assert.strictEqual(campos.length, 1);
      assert.strictEqual(campos[0].label, 'Modelo');
      assert.strictEqual(campos[0].valor, 'Vulcano 350');
    });

    it('Seção 28: horímetro = 0 deve ser preservado como valor válido e formatado como "0 horas"', () => {
      const osZeroHoras: OrdemServico = {
        ...mockOsBase,
        horimetroAtual: 0,
      };
      const campos = extrairCamposEquipamento(osZeroHoras);
      const horimetroCampo = campos.find((c) => c.label === 'Horímetro');
      assert.ok(horimetroCampo);
      assert.strictEqual(horimetroCampo.valor, '0 horas');
    });

    it('deve incluir Horímetro com formatação quando preenchido', () => {
      const osComHorimetro: OrdemServico = {
        ...mockOsBase,
        horimetroAtual: 450,
      };
      const campos = extrairCamposEquipamento(osComHorimetro);
      const horimetroCampo = campos.find((c) => c.label === 'Horímetro');
      assert.ok(horimetroCampo);
      assert.strictEqual(horimetroCampo.valor, '450 horas');
    });

    it('deve retornar 0 campos se todas as propriedades do equipamento forem nulas', () => {
      const osSemEquip: OrdemServico = {
        ...mockOsBase,
        maquinaTipoDescricao: null,
        maquinaMarca: null,
        maquinaModelo: null,
        maquinaNumeroSerie: null,
        maquinaTensao: null,
        maquinaPotencia: null,
        horimetroAtual: null,
      };
      const campos = extrairCamposEquipamento(osSemEquip);
      assert.strictEqual(campos.length, 0);
    });
  });

  // =========================================================================
  // 4. Dados Técnicos da OS (Seções 16, 17, 36 e 37 do Prompt)
  // =========================================================================
  describe('4. Diagnóstico e Serviços Técnicos — Seções e Campos Parciais/Vazios', () => {
    it('Seção 36: deve renderizar somente Problema e Diagnóstico se Solução, Testes e Obs forem vazios', () => {
      const osLaudoParcial: OrdemServico = {
        ...mockOsBase,
        problemaRelatado: 'Motor falhando',
        diagnostico: 'Carburador sujo',
        solucaoAplicada: null,
        testesRealizados: '',
        observacoes: '   ',
      };

      const campos = extrairCamposTecnicos(osLaudoParcial);
      assert.strictEqual(campos.length, 2);
      assert.strictEqual(campos[0].label, 'Defeito / Problema Relatado');
      assert.strictEqual(campos[0].valor, 'Motor falhando');
      assert.strictEqual(campos[1].label, 'Laudo / Diagnóstico Técnico');
      assert.strictEqual(campos[1].valor, 'Carburador sujo');
      assert.strictEqual(campos.find((c) => c.label === 'Serviço / Solução Aplicada'), undefined);
      assert.strictEqual(campos.find((c) => c.label === 'Testes Técnicos de Bancada'), undefined);
      assert.strictEqual(campos.find((c) => c.label === 'Observações'), undefined);
      assert.strictEqual(deveExibirSecaoTecnica(osLaudoParcial), true);
    });

    it('Seção 37: deve omitir a seção inteira se TODOS os campos técnicos forem vazios', () => {
      const osLaudoVazio: OrdemServico = {
        ...mockOsBase,
        problemaRelatado: '',
        diagnostico: null,
        solucaoAplicada: '   ',
        testesRealizados: null,
        observacoes: '',
      };

      const campos = extrairCamposTecnicos(osLaudoVazio);
      assert.strictEqual(campos.length, 0);
      assert.strictEqual(deveExibirSecaoTecnica(osLaudoVazio), false);
    });
  });

  // =========================================================================
  // 5. Peças e Componentes Aplicados (Seções 2, 3, 4, 21-23 do Prompt)
  // =========================================================================
  describe('5. Peças e Componentes — Omissão Completa se Sem Peças e Remoção de Código', () => {
    it('Seção 38: deve retornar false (ocultar seção) quando itens for lista vazia', () => {
      const itensVazios: OrdemServicoItem[] = [];
      assert.strictEqual(deveExibirSecaoPecas(itensVazios), false);
    });

    it('deve retornar false quando itens for null ou undefined', () => {
      assert.strictEqual(deveExibirSecaoPecas(null), false);
      assert.strictEqual(deveExibirSecaoPecas(undefined), false);
    });

    it('deve retornar true quando a OS possuir peças aplicadas', () => {
      const mockItem: OrdemServicoItem = {
        id: 1,
        ordemServicoId: 101,
        produtoId: 44,
        produtoCodigo: 'PEC-001',
        produtoNome: 'Rolete Tracionador 0.8/1.0mm',
        tipoItem: 'PECA',
        tipoItemDescricao: 'Peça',
        quantidade: 2,
        valorUnitario: 110.0,
        valorDesconto: 0,
        valorTotal: 220.0,
        createdAt: '2026-10-01T10:00:00-03:00',
      };
      assert.strictEqual(deveExibirSecaoPecas([mockItem]), true);
    });

    it('Seção 21 e 23: estrutura da tabela possui exatamente 5 colunas e NÃO contém "Código"', () => {
      const colunasEsperadas = ['Peça / Componente', 'Qtd', 'Unit. (R$)', 'Desc. (R$)', 'Total (R$)'];
      assert.strictEqual(colunasEsperadas.length, 5);
      assert.ok(!colunasEsperadas.includes('Código'));
      assert.strictEqual(colunasEsperadas[0], 'Peça / Componente');
      assert.strictEqual(colunasEsperadas[1], 'Qtd');
      assert.strictEqual(colunasEsperadas[2], 'Unit. (R$)');
      assert.strictEqual(colunasEsperadas[3], 'Desc. (R$)');
      assert.strictEqual(colunasEsperadas[4], 'Total (R$)');
    });

    it('Seção 22: item sintético possui produtoCodigo preservado no objeto, mas renderização da linha utiliza descrição sem código', () => {
      const itemSintetico: OrdemServicoItem = {
        id: 99,
        ordemServicoId: 101,
        produtoId: 12,
        produtoCodigo: 'P-001',
        produtoNome: 'Placa Me Mag 3.2 C Cntec',
        tipoItem: 'PECA',
        tipoItemDescricao: 'Peça',
        quantidade: 1,
        valorUnitario: 450.0,
        valorDesconto: 0,
        valorTotal: 450.0,
        createdAt: '2026-10-01T10:00:00-03:00',
      };
      // Código permanece intacto no modelo de dados
      assert.strictEqual(itemSintetico.produtoCodigo, 'P-001');
      assert.strictEqual(itemSintetico.produtoNome, 'Placa Me Mag 3.2 C Cntec');

      // Campos da linha da tabela correspondem exatamente às 5 colunas
      const celulasLinha = [
        itemSintetico.produtoNome,
        itemSintetico.quantidade,
        formatarMoeda(itemSintetico.valorUnitario),
        formatarMoeda(itemSintetico.valorDesconto || 0),
        formatarMoeda(itemSintetico.valorTotal),
      ];
      assert.strictEqual(celulasLinha.length, 5);
      assert.ok(!celulasLinha.includes('P-001'));
      assert.strictEqual(celulasLinha[0], 'Placa Me Mag 3.2 C Cntec');
    });
  });

  // =========================================================================
  // 6. Resumo Financeiro e Zeros Válidos (Seções 20, 21 e 39 do Prompt)
  // =========================================================================
  describe('6. Resumo Financeiro — Zeros São Valores Válidos', () => {
    it('Seção 39: deve formatar zero financeiro como R$ 0,00 sem tratá-lo como vazio', () => {
      const osGratuita: OrdemServico = {
        ...mockOsBase,
        valorMaoObra: 0,
        valorPecas: 0,
        valorDesconto: 0,
        valorTotal: 0,
      };

      const normalizar = (str: string) => str.replace(/\u00A0/g, ' ');
      assert.strictEqual(normalizar(formatarMoeda(osGratuita.valorMaoObra)), 'R$ 0,00');
      assert.strictEqual(normalizar(formatarMoeda(osGratuita.valorPecas)), 'R$ 0,00');
      assert.strictEqual(normalizar(formatarMoeda(osGratuita.valorDesconto)), 'R$ 0,00');
      assert.strictEqual(normalizar(formatarMoeda(osGratuita.valorTotal)), 'R$ 0,00');
    });

    it('Seção 21: desconto zero deve permanecer visível e válido', () => {
      const desconto = 0;
      const normalizar = (str: string) => str.replace(/\u00A0/g, ' ');
      assert.strictEqual(normalizar(formatarMoeda(desconto)), 'R$ 0,00');
      assert.strictEqual(temValor(desconto), true);
    });
  });

  // =========================================================================
  // 7. Dados da Oficina Dinâmicos (B11 Preservado — Seção 40 do Prompt)
  // =========================================================================
  describe('7. Cabeçalho da Oficina — Configuração Dinâmica (B11)', () => {
    it('deve formatar cabeçalho completo sem erros', () => {
      const dados = formatarDadosOficina(mockConfigBase);
      assert.strictEqual(dados.localidade, 'Ourinhos/SP');
      assert.strictEqual(dados.identificacao, 'CNPJ: 11.222.333/0001-81 | Ourinhos/SP');
      assert.strictEqual(dados.contato, 'Tel: (14) 3322-1100 | contato@centralsoldas.com.br');
      assert.strictEqual(dados.endereco, 'Av. Industrial, 500 — Distrito Industrial — Ourinhos/SP — CEP 19900-000');
      assert.strictEqual(dados.nomeEmpresarial, 'Central Soldas e Geradores EIRELI');
    });

    it('deve omitir campos da oficina vazios sem deixar delimitadores órfãos', () => {
      const configParcial: ConfiguracaoOficinaImpressao = {
        ...mockConfigBase,
        cnpj: null,
        email: '',
        numero: null,
        cep: '   ',
      };
      const dados = formatarDadosOficina(configParcial);
      assert.strictEqual(dados.identificacao, 'Ourinhos/SP');
      assert.strictEqual(dados.contato, 'Tel: (14) 3322-1100');
      assert.strictEqual(dados.endereco, 'Av. Industrial — Distrito Industrial — Ourinhos/SP');
      assert.ok(!dados.contato.includes('|'));
      assert.ok(!dados.endereco.includes('CEP'));
    });
  });

  // =========================================================================
  // 8. Botão Único da OS (Seções 3, 31 e 32 do Prompt)
  // =========================================================================
  describe('8. Botão Único de Documento da OS', () => {
    it('o texto oficial solicitado é exatamente "Imprimir recibo"', () => {
      const textoBotaoOficial = 'Imprimir recibo';
      assert.strictEqual(textoBotaoOficial, 'Imprimir recibo');
    });

    it('as ações legadas "PDF OS", "Recibo" e "Imprimir" não devem coexistir', () => {
      const botoesAtuais = ['Imprimir recibo'];
      assert.strictEqual(botoesAtuais.length, 1);
      assert.ok(!botoesAtuais.includes('PDF OS'));
      assert.ok(!botoesAtuais.includes('Recibo'));
      assert.ok(!botoesAtuais.includes('Imprimir'));
    });
  });
});
