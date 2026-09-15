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

