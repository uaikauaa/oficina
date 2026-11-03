import type { PageResponse } from './types.ts';

export type { PageResponse };

/**
 * Interface para a função executora de cada página de busca.
 */
export type PageFetcher<T> = (page: number, size: number) => Promise<PageResponse<T>>;

/**
 * Utilitário para buscar todos os registros paginados de um relatório,
 * iterando até esgotar todas as páginas do conjunto de dados filtrado.
 * 
 * Resolve a ISSUE-002 garantindo que o CSV exporte 100% dos dados filtrados.
 */
export async function fetchTodosRegistrosRelatorio<T>(
  fetchPage: PageFetcher<T>,
  pageSize = 100
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 200) throw new Error('Tamanho de pagina invalido.');
  const todos: T[] = [];
  let currentPage = 0;
  let totalPages = 1;

  while (currentPage < totalPages) {
    const pageData = await fetchPage(currentPage, pageSize);

    if ((pageData?.totalElements ?? 0) > 10000 || todos.length + (pageData?.content?.length ?? 0) > 10000 || currentPage >= 100) {
      throw new Error('Exportacao limitada a 10.000 registros. Refine os filtros e tente novamente.');
    }

    if (!pageData || !Array.isArray(pageData.content) || pageData.content.length === 0) {
      break;
    }

    todos.push(...pageData.content);

    totalPages = typeof pageData.totalPages === 'number' ? pageData.totalPages : 1;
    currentPage++;

    if (pageData.last || pageData.content.length < pageSize) {
      break;
    }
  }

  return todos;
}
