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
