export type TipoPessoa = 'FISICA' | 'JURIDICA';

export type TipoEndereco = 'PRINCIPAL' | 'COBRANCA' | 'ENTREGA' | 'OUTRO';

export type TipoEquipamento = 'MAQUINA_SOLDA' | 'GERADOR_ENERGIA' | 'OUTRO_EQUIPAMENTO';

export const TIPO_EQUIPAMENTO_LABELS: Record<TipoEquipamento, string> = {
  MAQUINA_SOLDA: 'Máquina de Solda',
  GERADOR_ENERGIA: 'Gerador de Energia',
  OUTRO_EQUIPAMENTO: 'Outro Equipamento',
};

export interface Maquina {
  id: number;
  clienteId: number;
  clienteNome: string;
  tipoEquipamento: TipoEquipamento;
  tipoEquipamentoDescricao: string;
  marca: string;
  modelo: string;
  anoFabricacao?: number | null;
  numeroSerie?: string | null;
  horimetro?: number | null;
  potencia?: string | null;
  tensao?: string | null;
  especificacoesTecnicas?: string | null;
  observacoes?: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MaquinaFormData {
  clienteId: number;
  tipoEquipamento: TipoEquipamento;
  marca: string;
  modelo: string;
  anoFabricacao?: string;
  numeroSerie?: string;
  horimetro?: string;
  potencia?: string;
  tensao?: string;
  observacoes?: string;
}

export interface Endereco {
  id?: number;
  cep?: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  tipoEndereco?: TipoEndereco;
}

export interface Cliente {
  id: number;
  tipoPessoa: TipoPessoa;
  nomeRazaoSocial: string;
  nomeFantasia?: string | null;
  cpfCnpj?: string | null;
  rgIe?: string | null;
  telefone?: string | null;
  celular?: string | null;
  email?: string | null;
  ativo: boolean;
  observacoes?: string | null;
  enderecos: Endereco[];
  totalEquipamentos: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClienteFormData {
  tipoPessoa: TipoPessoa;
  nomeRazaoSocial: string;
  nomeFantasia?: string;
  cpfCnpj?: string;
  rgIe?: string;
  telefone?: string;
  celular?: string;
  email?: string;
  observacoes?: string;
  ativo?: boolean;
  endereco?: {
    cep?: string;
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    estado: string;
    tipoEndereco?: TipoEndereco;
  };
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface CurrentUser {
  id: number;
  nome: string;
  email: string;
  roles: string[];
}

export type StatusOrdemServico =
  | 'ABERTA'
  | 'EM_DIAGNOSTICO'
  | 'AGUARDANDO_APROVACAO'
  | 'EM_MANUTENCAO'
  | 'AGUARDANDO_PECA'
  | 'PRONTA'
  | 'CONCLUIDA'
  | 'CANCELADA';

export const STATUS_ORDEM_SERVICO_LABELS: Record<StatusOrdemServico, string> = {
  ABERTA: 'Aberta',
  EM_DIAGNOSTICO: 'Em Diagnóstico',
  AGUARDANDO_APROVACAO: 'Aguardando Aprovação',
  EM_MANUTENCAO: 'Em Manutenção',
  AGUARDANDO_PECA: 'Aguardando Peça',
  PRONTA: 'Pronta',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
};

export const STATUS_ORDEM_SERVICO_BADGES: Record<
  StatusOrdemServico,
  { bg: string; text: string; border: string }
> = {
  ABERTA: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
  },
  EM_DIAGNOSTICO: {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    border: 'border-cyan-500/30',
  },
  AGUARDANDO_APROVACAO: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
  },
  EM_MANUTENCAO: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
  },
  AGUARDANDO_PECA: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
  },
  PRONTA: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
  },
  CONCLUIDA: {
    bg: 'bg-green-500/10',
    text: 'text-green-400',
    border: 'border-green-500/30',
  },
  CANCELADA: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/30',
  },
};

export interface OrdemServico {
  id: number;
  numeroOs: string;
  clienteId: number;
  clienteNome: string;
  clienteTelefone?: string | null;
  clienteCpfCnpj?: string | null;
  maquinaId: number;
  maquinaTipoEquipamento?: TipoEquipamento | null;
  maquinaTipoDescricao?: string | null;
  maquinaMarca?: string | null;
  maquinaModelo?: string | null;
  maquinaNumeroSerie?: string | null;
  maquinaPotencia?: string | null;
  maquinaTensao?: string | null;
  tecnicoId?: number | null;
  tecnicoNome?: string | null;
  status: StatusOrdemServico;
  statusDescricao: string;
  dataEntrada: string;
  previsaoConclusao?: string | null;
  dataConclusao?: string | null;
  problemaRelatado: string;
  diagnostico?: string | null;
  solucaoAplicada?: string | null;
  testesRealizados?: string | null;
  observacoes?: string | null;
  horimetroAtual?: number | null;
  valorMaoObra: number;
  valorPecas: number;
  valorDesconto: number;
  valorTotal: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrdemServicoFormData {
  clienteId: number;
  maquinaId: number;
  numeroOs?: string;
  dataEntrada?: string;
  previsaoConclusao?: string;
  problemaRelatado: string;
  horimetroAtual?: string;
  observacoes?: string;
}

export interface OrdemServicoUpdateData {
  problemaRelatado?: string;
  diagnostico?: string;
  solucaoAplicada?: string;
  testesRealizados?: string;
  observacoes?: string;
  horimetroAtual?: string;
  valorMaoObra?: number;
  valorPecas?: number;
  valorDesconto?: number;
  previsaoConclusao?: string;
}

export interface OrdemServicoStatusData {
  status: StatusOrdemServico;
  testesRealizados?: string;
  observacoes?: string;
}

// =============================================================================
// FASE 6 — MÓDULO DE PRODUTOS, FORNECEDORES, ESTOQUE E ITENS DE OS
// =============================================================================

export interface Categoria {
  id: number;
  nome: string;
  descricao?: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoriaFormData {
  nome: string;
  descricao?: string;
}

export interface Fornecedor {
  id: number;
  razaoSocial: string;
  nomeFantasia?: string | null;
  cnpj?: string | null;
  inscricaoEstadual?: string | null;
  telefone?: string | null;
  celular?: string | null;
  email?: string | null;
  contatoPrincipal?: string | null;
  ativo: boolean;
  observacoes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FornecedorFormData {
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj?: string;
  inscricaoEstadual?: string;
  telefone?: string;
  celular?: string;
  email?: string;
  contatoPrincipal?: string;
  observacoes?: string;
}

export type TipoProduto = 'PRODUTO' | 'PECA' | 'SERVICO' | 'CONSUMIVEL';

export const TIPO_PRODUTO_LABELS: Record<TipoProduto, string> = {
  PRODUTO: 'Produto',
  PECA: 'Peça / Componente',
  SERVICO: 'Serviço',
  CONSUMIVEL: 'Consumível',
};

export interface Produto {
  id: number;
  codigo: string;
  codigoBarras?: string | null;
  nome: string;
  descricao?: string | null;
  marca?: string | null;
  tipo: TipoProduto;
  tipoDescricao: string;
  unidadeMedida: string;
  precoCusto: number;
  precoVenda: number;
  margemLucro?: number | null;
  estoqueAtual: number;
  estoqueMinimo: number;
  estoqueMaximo?: number | null;
  localizacao?: string | null;
  ativo: boolean;
  categoriaId?: number | null;
  categoriaNome?: string | null;
  fornecedorId?: number | null;
  fornecedorNome?: string | null;
  estoqueBaixo: boolean;
  semEstoque: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProdutoFormData {
  codigo: string;
  codigoBarras?: string;
  nome: string;
  descricao?: string;
  marca?: string;
  tipo: TipoProduto;
  unidadeMedida?: string;
  precoCusto: number;
  precoVenda: number;
  estoqueMinimo?: number;
  estoqueInicial?: number;
  localizacao?: string;
  categoriaId?: number;
  fornecedorId?: number;
}

export interface Compatibilidade {
  id: number;
  maquinaId: number;
  maquinaTipoEquipamento: string;
  maquinaMarca: string;
  maquinaModelo: string;
  maquinaNumeroSerie?: string | null;
  observacaoCompatibilidade?: string | null;
  createdAt: string;
}

export type TipoMovimentacaoEstoque =
  | 'ENTRADA'
  | 'SAIDA'
  | 'AJUSTE_POSITIVO'
  | 'AJUSTE_NEGATIVO'
  | 'DEVOLUCAO';

export const TIPO_MOVIMENTACAO_ESTOQUE_LABELS: Record<TipoMovimentacaoEstoque, string> = {
  ENTRADA: 'Entrada',
  SAIDA: 'Saída',
  AJUSTE_POSITIVO: 'Ajuste (+)',
  AJUSTE_NEGATIVO: 'Ajuste (-)',
  DEVOLUCAO: 'Devolução',
};

export const TIPO_MOVIMENTACAO_ESTOQUE_BADGES: Record<
  TipoMovimentacaoEstoque,
  { bg: string; text: string; border: string }
> = {
  ENTRADA: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  SAIDA: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  AJUSTE_POSITIVO: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  AJUSTE_NEGATIVO: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
  DEVOLUCAO: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
};

export interface EstoqueMovimentacao {
  id: number;
  produtoId: number;
  produtoCodigo: string;
  produtoNome: string;
  usuarioId?: number | null;
  usuarioNome?: string | null;
  ordemServicoId?: number | null;
  ordemServicoNumero?: string | null;
  tipoMovimentacao: TipoMovimentacaoEstoque;
  tipoDescricao: string;
  quantidade: number;
  valorUnitario?: number | null;
  quantidadeAnterior: number;
  quantidadePosterior: number;
  motivo: string;
  dataMovimentacao: string;
}

export interface EstoqueResumo {
  totalProdutos: number;
  itensSemEstoque: number;
  itensEstoqueBaixo: number;
  valorTotalEstoque: number;
}

export interface MovimentacaoManualFormData {
  produtoId: number;
  tipoMovimentacao: TipoMovimentacaoEstoque;
  quantidade: number;
  valorUnitario?: number;
  motivo: string;
}

export type TipoItemOrdemServico = 'PECA' | 'SERVICO';

export interface OrdemServicoItem {
  id: number;
  ordemServicoId: number;
  produtoId: number;
  produtoCodigo: string;
  produtoNome: string;
  tipoItem: TipoItemOrdemServico;
  tipoItemDescricao: string;
  quantidade: number;
  valorUnitario: number;
  valorDesconto: number;
  valorTotal: number;
  observacoes?: string | null;
  createdAt: string;
}

export interface OrdemServicoItemFormData {
  produtoId: number;
  quantidade: number;
  valorDesconto?: number;
  observacoes?: string;
}

// =========================================================================
// Tipos da Fase 7: Histórico Técnico e Busca Rápida
// =========================================================================

export interface MaquinaResumo {
  maquinaId: number;
  totalAtendimentos: number;
  ultimaManutencaoData?: string | null;
  ultimaOsId?: number | null;
  ultimaOsNumero?: string | null;
  ultimaOsProblema?: string | null;
  ultimaOsStatus?: StatusOrdemServico | null;
  valorAcumulado: number;
}

export interface ClienteResumo {
  clienteId: number;
  quantidadeEquipamentos: number;
  quantidadeTotalOs: number;
  quantidadeOsAbertas: number;
  ultimaVisitaData?: string | null;
  ultimaOsNumero?: string | null;
  valorAcumulado: number;
}

export interface ItemBuscaRapida {
  id: number;
  titulo: string;
  subtitulo: string;
  tag: string;
  url: string;
}

export interface BuscaRapidaResultado {
  clientes: ItemBuscaRapida[];
  maquinas: ItemBuscaRapida[];
  ordensServico: ItemBuscaRapida[];
  produtos: ItemBuscaRapida[];
  totalResultados: number;
}

// =========================================================================
// Tipos da Fase 8: Relatórios e PDF de Ordem de Serviço
// =========================================================================

export interface RelatorioOsResumo {
  totalOs: number;
  concluidas: number;
  abertas: number;
  canceladas: number;
  valorTotalConcluidas: number;
  valorTotalAReceber: number;
}

export interface RelatorioOsResponse {
  resumo: RelatorioOsResumo;
  itens: PageResponse<OrdemServico>;
}

export interface RelatorioEstoqueItem {
  produtoId: number;
  codigo: string;
  nome: string;
  marca?: string | null;
  categoriaNome?: string | null;
  fornecedorNome?: string | null;
  estoqueAtual: number;
  estoqueMinimo: number;
  statusEstoque: 'NORMAL' | 'BAIXO' | 'ZERADO';
}

export interface PecaMaisUtilizada {
  produtoId: number;
  codigo: string;
  nome: string;
  marca?: string | null;
  quantidadeTotalUtilizada: number;
  quantidadeOs: number;
}

export interface RelatorioClienteItem {
  clienteId: number;
  nomeRazaoSocial: string;
  cpfCnpj?: string | null;
  telefone?: string | null;
  quantidadeEquipamentos: number;
  quantidadeOs: number;
  ultimaVisita?: string | null;
  valorAcumulado: number;
}

export interface RelatorioMaquinaItem {
  maquinaId: number;
  clienteNome: string;
  tipo: TipoEquipamento;
  marca?: string | null;
  modelo?: string | null;
  numeroSerie?: string | null;
  quantidadeOs: number;
  ultimaManutencao?: string | null;
  valorAcumulado: number;
}

export interface OrdemServicoContadoresDashboard {
  prontas: number;
  aguardandoAprovacao: number;
  emManutencao: number;
}

export interface EstoqueResumo {
  totalProdutos: number;
  itensSemEstoque: number;
  itensEstoqueBaixo: number;
  valorTotalEstoque: number;
}

export interface OrdemServicoContadoresStatus {
  total: number;
  aberta: number;
  emDiagnostico: number;
  aguardandoAprovacao: number;
  emManutencao: number;
  aguardandoPeca: number;
  pronta: number;
  concluida: number;
  cancelada: number;
}

export interface ClienteContadoresStatus {
  total: number;
  pessoaFisica: number;
  pessoaJuridica: number;
  ativos: number;
  inativos: number;
}


