// AUDIT-001: Suporte à arquitetura de mesma origem (Next.js rewrites: /api/* -> Spring Boot).
// Se NEXT_PUBLIC_API_URL estiver definido, usa seu valor;
// Se em produção (NODE_ENV === 'production') e não definido, usa '' para chamadas relativas à mesma origem;
// Em ambiente de desenvolvimento local, o fallback é 'http://localhost:8080'.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL !== undefined
    ? process.env.NEXT_PUBLIC_API_URL
    : process.env.NODE_ENV === 'production'
      ? ''
      : 'http://localhost:8080';

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

