/** Neutral UI labels only. Business identity/contact must come from the backend configuration. */
export const OFICINA = {
  nomeSistema: 'Oficina Gestão',
  nomeFantasia: 'Oficina não configurada',
  nomeEmpresarial: '', cnpj: '', responsavel: '', telefone: '', email: '',
  logradouro: '', numero: '', bairro: '', cep: '', municipio: '', uf: '',
} as const;

/** No built-in business address/contact may be used as a fallback. */
export function formatarEnderecoOficina(): string { return ''; }
export function formatarContatoOficina(): string { return ''; }
