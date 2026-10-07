import type { OrdemServico, OrdemServicoItem } from './types.ts';

export interface ConfiguracaoOficinaImpressao {
  nomeFantasia: string;
  nomeEmpresarial: string | null;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cep: string | null;
  municipio: string | null;
  uf: string | null;
}

/**
 * Verifica se um valor é válido e não vazio.
 * Considera como vazio: null, undefined, string vazia ("") ou string somente com espaços.
 * Valores numéricos como 0 são válidos (zero financeiro/horímetro).
 */
export function temValor(valor: unknown): boolean {
  if (valor === null || valor === undefined) return false;
  if (typeof valor === 'string') return valor.trim().length > 0;
  return true;
}

export interface CampoRecibo {
  label: string;
  valor: string;
  mono?: boolean;
}

/**
 * Extrai campos do cliente omitindo qualquer campo vazio ou sem valor.
 */
export function extrairCamposCliente(os: OrdemServico): CampoRecibo[] {
  const campos: CampoRecibo[] = [];
  if (temValor(os.clienteNome)) {
    campos.push({ label: 'Nome / Razão Social', valor: os.clienteNome.trim() });
  }
  if (temValor(os.clienteCpfCnpj)) {
    campos.push({ label: 'CPF/CNPJ', valor: os.clienteCpfCnpj!.trim() });
  }
  if (temValor(os.clienteTelefone)) {
    campos.push({ label: 'Telefone', valor: os.clienteTelefone!.trim() });
  }
  return campos;
}

/**
 * Extrai campos do equipamento individualmente.
 * Se um campo não estiver preenchido, é omitido sem deixar célula vazia ou placeholder.
 */
export function extrairCamposEquipamento(os: OrdemServico): CampoRecibo[] {
  const campos: CampoRecibo[] = [];
  if (temValor(os.maquinaTipoDescricao)) {
    campos.push({ label: 'Tipo', valor: os.maquinaTipoDescricao!.trim() });
  }
  if (temValor(os.maquinaMarca)) {
    campos.push({ label: 'Marca', valor: os.maquinaMarca!.trim() });
  }
  if (temValor(os.maquinaModelo)) {
    campos.push({ label: 'Modelo', valor: os.maquinaModelo!.trim() });
  }
  if (temValor(os.maquinaNumeroSerie)) {
    campos.push({ label: 'Nº de Série', valor: os.maquinaNumeroSerie!.trim(), mono: true });
  }
  if (temValor(os.maquinaTensao)) {
    campos.push({ label: 'Tensão', valor: os.maquinaTensao!.trim() });
  }
  if (temValor(os.maquinaPotencia)) {
    campos.push({ label: 'Potência', valor: os.maquinaPotencia!.trim() });
  }
  if (os.horimetroAtual != null) {
    campos.push({ label: 'Horímetro na Entrada', valor: `${os.horimetroAtual} horas` });
  }
  return campos;
}

/**
 * Extrai dados técnicos/laudo técnico omitindo campos vazios.
 */
export function extrairCamposTecnicos(os: OrdemServico): CampoRecibo[] {
  const campos: CampoRecibo[] = [];
  if (temValor(os.problemaRelatado)) {
    campos.push({ label: 'Defeito / Problema Relatado', valor: os.problemaRelatado.trim() });
  }
  if (temValor(os.diagnostico)) {
    campos.push({ label: 'Laudo / Diagnóstico Técnico', valor: os.diagnostico!.trim() });
  }
  if (temValor(os.solucaoAplicada)) {
    campos.push({ label: 'Serviço / Solução Aplicada', valor: os.solucaoAplicada!.trim() });
  }
  if (temValor(os.testesRealizados)) {
    campos.push({ label: 'Testes Técnicos de Bancada', valor: os.testesRealizados!.trim() });
  }
  if (temValor(os.observacoes)) {
    campos.push({ label: 'Observações', valor: os.observacoes!.trim() });
  }
  return campos;
}

/**
 * Verifica se a seção técnica deve ser exibida.
 * Retorna false se todos os campos técnicos estiverem vazios.
 */
export function deveExibirSecaoTecnica(os: OrdemServico): boolean {
  return extrairCamposTecnicos(os).length > 0;
}

/**
 * Verifica se a seção de peças deve ser exibida.
 * Retorna false se a lista for nula ou vazia.
 */
export function deveExibirSecaoPecas(itens: OrdemServicoItem[] | null | undefined): boolean {
  return Boolean(itens && itens.length > 0);
}

/**
 * Formata os blocos de dados comerciais da oficina omitindo dados ausentes.
 */
export function formatarDadosOficina(configuracao: ConfiguracaoOficinaImpressao) {
  const municipio = temValor(configuracao.municipio) ? configuracao.municipio!.trim() : null;
  const uf = temValor(configuracao.uf) ? configuracao.uf!.trim() : null;
  const localidade = [municipio, uf].filter(Boolean).join('/');
  const cnpj = temValor(configuracao.cnpj) ? configuracao.cnpj!.trim() : null;
  const identificacao = [cnpj && `CNPJ: ${cnpj}`, localidade].filter(Boolean).join(' | ');
  const telefone = temValor(configuracao.telefone) ? configuracao.telefone!.trim() : null;
  const email = temValor(configuracao.email) ? configuracao.email!.trim() : null;
  const contato = [telefone && `Tel: ${telefone}`, email].filter(Boolean).join(' | ');

  const logradouro = temValor(configuracao.logradouro) ? configuracao.logradouro!.trim() : null;
  const numero = temValor(configuracao.numero) ? configuracao.numero!.trim() : null;
  const ruaNumero = [logradouro, numero].filter(Boolean).join(', ');
  const bairro = temValor(configuracao.bairro) ? configuracao.bairro!.trim() : null;
  const cep = temValor(configuracao.cep) ? configuracao.cep!.trim() : null;
  const endereco = [
    ruaNumero,
    bairro,
    localidade,
    cep && `CEP ${cep}`,
  ].filter(Boolean).join(' — ');

  return {
    localidade,
    identificacao,
    contato,
    endereco,
    nomeEmpresarial: temValor(configuracao.nomeEmpresarial) ? configuracao.nomeEmpresarial!.trim() : null,
  };
}
