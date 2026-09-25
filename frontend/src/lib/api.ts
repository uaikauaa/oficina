// AUDIT-001: Suporte à arquitetura de mesma origem (Next.js rewrites: /api/* -> Spring Boot).
// No navegador (client-side), as requisições utilizam caminho relativo ('') para mesma origem via rewrite do Next.js.
// No servidor (SSR/testes), utiliza INTERNAL_BACKEND_URL ou NEXT_PUBLIC_API_URL se definidos.
export const API_URL =
  typeof window !== 'undefined'
    ? ''
    : (process.env.INTERNAL_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || '');

/**
 * AUDIT-002: Extrai mensagem amigável e segura de erro de login com base no status HTTP e corpo da resposta.
 * Preserva:
 * - 401 -> Credenciais inválidas (e-mail ou senha incorretos)
 * - 400 -> Dados de login inválidos
 * - 429 -> Bloqueio temporário por tentativas excessivas (lockout)
 * - 403 -> Conta desativada
 * - Outros -> Erro genérico de conexão com o servidor
 */
export async function extrairMensagemErroLogin(response: Response): Promise<string> {
  if (response.status === 429) {
    const errorData = await response.json().catch(() => ({}));
    return (
      errorData?.message ||
      'Conta temporariamente bloqueada por excesso de tentativas. Tente novamente mais tarde.'
    );
  }

  if (response.status === 401) {
    const errorData = await response.json().catch(() => ({}));
    return errorData?.message || 'E-mail ou senha incorretos.';
  }

  if (response.status === 400) {
    const errorData = await response.json().catch(() => ({}));
    return errorData?.message || 'Dados de login inválidos.';
  }

  if (response.status === 403) {
    return 'Conta desativada. Entre em contato com o suporte.';
  }

  return 'Falha de conexão com o servidor. Tente novamente mais tarde.';
}

// Mutex / Promise compartilhada para evitar disparos concorrentes de refresh token (ISSUE-01)
let activeRefreshPromise: Promise<boolean> | null = null;

export async function executeSilentRefresh(): Promise<boolean> {
  if (!activeRefreshPromise) {
    activeRefreshPromise = (async () => {
      try {
        const refreshRes = await fetch(`${API_URL}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        return refreshRes.ok;
      } catch {
        return false;
      } finally {
        activeRefreshPromise = null;
      }
    })();
  }
  return activeRefreshPromise;
}

export function sanitizarRedirect(url: string | null): string {
  if (!url) return '/dashboard';
  const trimmed = url.trim();
  // Deve ser caminho relativo interno iniciando com '/', não pode ser protocol-relative ('//') e não pode conter esquema ('://')
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('://')) {
    return trimmed;
  }
  return '/dashboard';
}

export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const url = `${API_URL}${endpoint}`;
  const config: RequestInit = {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  let response = await fetch(url, config);

  // Se o access_token expirou (401), aguarda ou executa renovação silenciosa com refresh_token compartilhado
  if (response.status === 401 && !endpoint.startsWith('/api/auth/')) {
    const refreshSuccess = await executeSilentRefresh();
    if (refreshSuccess) {
      // Repete a requisição original com os novos cookies definidos no navegador
      response = await fetch(url, config);
    }
  }

  return response;
}

export async function apiFetchJson<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await apiFetch(endpoint, options);
  if (!res.ok) {
    let errorMsg = `Erro na requisição (${res.status})`;
    try {
      const errBody = await res.json();
      if (errBody?.message) errorMsg = errBody.message;
    } catch {
      // Ignora erro de parse
    }
    throw new Error(errorMsg);
  }
  if (res.status === 204) return {} as T;
  return res.json() as Promise<T>;
}

export function formatarDocumento(doc?: string | null): string {
  if (!doc) return '-';
  const limpo = doc.replace(/\D/g, '');
  if (limpo.length === 11) {
    return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (limpo.length === 14) {
    return limpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return doc;
}

export function formatarTelefone(tel?: string | null): string {
  if (!tel) return '-';
  const limpo = tel.replace(/\D/g, '');
  if (limpo.length === 10) {
    return limpo.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  if (limpo.length === 11) {
    return limpo.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  return tel;
}

export function formatarCep(cep?: string | null): string {
  if (!cep) return '-';
  const limpo = cep.replace(/\D/g, '');
  if (limpo.length === 8) {
    return limpo.replace(/(\d{5})(\d{3})/, '$1-$2');
  }
  return cep;
}

export function formatarMoeda(valor?: number | string | null): string {
  if (valor === undefined || valor === null || valor === '') return 'R$ 0,00';
  const num = typeof valor === 'string' ? parseFloat(valor) : valor;
  if (isNaN(num)) return 'R$ 0,00';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarDataHora(dataStr?: string | null): string {
  if (!dataStr) return '-';
  try {
    const data = new Date(dataStr);
    if (isNaN(data.getTime())) return dataStr;
    return data.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dataStr;
  }
}

export function formatarData(dataStr?: string | null): string {
  if (!dataStr) return '-';
  try {
    const data = new Date(dataStr);
    if (isNaN(data.getTime())) return dataStr;
    return data.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dataStr;
  }
}

/**
 * Formata um código de produto/peça para exibição compacta e profissional.
 * - Códigos com timestamp longo (ex: 'IGBT-1789603117312', 'P-1789605039194')
 *   são formatados visualmente como 'IGBT-001', 'P-001' (utilizando o ID do produto ou sufixo numérico).
 * - Códigos regulares (ex: 'IGBT-60N60', 'AVR-5KW') são mantidos exatamente como foram cadastrados.
 */
export function formatarCodigoSku(codigo?: string | null, id?: number | null): string {
  if (!codigo) return '-';
  const limpo = codigo.trim();
  const match = limpo.match(/^([A-Za-z0-9_]+)-(\d{8,})$/);
  if (match) {
    const [, prefixo, numStr] = match;
    if (id !== undefined && id !== null && id > 0) {
      return `${prefixo}-${String(id).padStart(3, '0')}`;
    }
    const sufixo = numStr.slice(-3).padStart(3, '0');
    return `${prefixo}-${sufixo}`;
  }
  return limpo;
}

/**
 * Retorna o nome por extenso da unidade de medida para exibição na interface sem abreviações.
 */
export function formatarUnidadeMedida(unidade?: string | null): string {
  if (!unidade) return 'Unidade';
  const mapa: Record<string, string> = {
    UN: 'Unidade',
    UNIDADE: 'Unidade',
    PC: 'Peça',
    PECA: 'Peça',
    KG: 'Quilograma',
    M: 'Metro',
    MT: 'Metro',
    PAR: 'Par',
    CJ: 'Conjunto',
    L: 'Litro',
    LT: 'Litro',
  };
  return mapa[unidade.toUpperCase()] || unidade;
}

