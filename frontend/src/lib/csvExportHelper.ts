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
  const todos: T[] = [];
  let currentPage = 0;
  let totalPages = 1;

  while (currentPage < totalPages) {
    const pageData = await fetchPage(currentPage, pageSize);

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
