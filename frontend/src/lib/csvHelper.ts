/**
 * Helper para exportação de dados em formato CSV (FEATURE-004)
 * Oficina Gestão — Versão 1.1
 * 
 * Características:
 * - Delimitador ponto e vírgula (;) para compatibilidade nativa com Excel pt-BR
 * - Codificação UTF-8 com Byte Order Mark (BOM: \uFEFF) para visualização correta de acentos
 * - Escape rigoroso de aspas duplas ("" conforme RFC 4180), ponto e vírgula e quebras de linha
 * - Quebra de linha consistente (\r\n)
 */

export interface ColunaCsv<T> {
  cabecalho: string;
  acessar: (item: T) => string | number | boolean | null | undefined;
}

/**
 * Escapa e formata um valor individual para um campo de CSV compatível com RFC 4180.
 */
export function escaparCampoCsv(valor: string | number | boolean | null | undefined): string {
  if (valor === null || valor === undefined) {
    return '';
  }

  const texto = String(valor);

  // Se contiver ponto e vírgula, aspas duplas ou quebras de linha, deve ser envolvido por aspas
  const precisaDeAspas = texto.includes(';') || texto.includes('"') || texto.includes('\n') || texto.includes('\r');

  if (precisaDeAspas) {
    // Escapa aspas duplicando-as
    const escapado = texto.replace(/"/g, '""');
    return `"${escapado}"`;
  }

  return texto;
}

/**
 * Converte uma lista de objetos em uma string CSV formatada com UTF-8 BOM e delimitador ';'.
 */
export function gerarCsv<T>(colunas: ColunaCsv<T>[], dados: T[]): string {
  const BOM = '\uFEFF';

  const linhaCabecalho = colunas
    .map((col) => escaparCampoCsv(col.cabecalho))
    .join(';');

  const linhasDados = dados.map((item) =>
    colunas
      .map((col) => escaparCampoCsv(col.acessar(item)))
      .join(';')
  );

  return BOM + [linhaCabecalho, ...linhasDados].join('\r\n') + '\r\n';
}

/**
 * Dispara o download do arquivo CSV no navegador do usuário.
 */
export function baixarArquivoCsv(conteudoCsv: string, nomeArquivo: string): void {
  const nomeFinal = nomeArquivo.toLowerCase().endsWith('.csv') ? nomeArquivo : `${nomeArquivo}.csv`;

  const blob = new Blob([conteudoCsv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.setAttribute('href', url);
  link.setAttribute('download', nomeFinal);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
