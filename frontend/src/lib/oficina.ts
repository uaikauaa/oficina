/**
 * oficina.ts — Fonte central de dados da oficina Bruno Soldas
 *
 * Este arquivo é a ÚNICA fonte de verdade dos dados padrão da oficina no frontend.
 * Todos os componentes que precisem exibir dados da oficina devem importar
 * daqui — nunca hardcodar essas informações em outros arquivos.
 *
 * SEPARAÇÃO IMPORTANTE:
 * - "Oficina Gestão" = nome do SISTEMA/SOFTWARE
 * - "Bruno Soldas"   = nome fantasia/comercial da OFICINA
 *
 * O sistema é exclusivamente comercial e operacional (não emite NFS-e).
 */
export const OFICINA = {
  /** Nome do sistema/software. Usado em header, title, login, etc. */
  nomeSistema: 'Oficina Gestão',

  /** Nome fantasia/comercial da oficina. Usado em documentos, WhatsApp, etc. */
  nomeFantasia: 'Bruno Soldas',

  /** Nome empresarial conforme cadastro da Receita Federal. */
  nomeEmpresarial: '45.076.507 BRUNO SOARES RODRIGUES',

  /** CNPJ formatado. */
  cnpj: '45.076.507/0001-67',

  /** Responsável/proprietária da oficina (dado administrativo). */
  responsavel: 'Geisa',

  /** Telefone de contato. */
  telefone: '(14) 9886-7223',

  /** E-mail de contato. */
  email: 'INDUTECSERVICE@HOTMAIL.COM',

  // --- Endereço ---
  logradouro: 'Avenida Jacinto Ferreira de Sá - de 1272/1273 ao fim',
  numero: '1538',
  bairro: 'Vila Sandano',
  cep: '19.914-080',
  municipio: 'Ourinhos',
  uf: 'SP',
} as const;

/** Endereço completo formatado para uso em documentos e telas. */
export function formatarEnderecoOficina(): string {
  const { logradouro, numero, bairro, cep, municipio, uf } = OFICINA;
  return `${logradouro}, ${numero} — ${bairro}, ${municipio}/${uf} — CEP ${cep}`;
}

/** Linha de contato formatada para uso em documentos. */
export function formatarContatoOficina(): string {
  return `Tel: ${OFICINA.telefone} | ${OFICINA.email}`;
}
