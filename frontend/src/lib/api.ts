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
    const errorData = await response.json().catch(() => ({}));
    if (errorData?.error === 'CSRF_INVALID') {
      return errorData?.message || 'Sessão de segurança expirada. Tente novamente.';
    }
    return 'Conta desativada. Entre em contato com o suporte.';
  }

  return 'Falha de conexão com o servidor. Tente novamente mais tarde.';
}

// Mutex / Promise compartilhada para evitar disparos concorrentes de refresh token (ISSUE-01)
let activeRefreshPromise: Promise<boolean> | null = null;
let refreshGeneration = 0;
let csrfTokenPromise: Promise<string> | null = null;

function isMutating(method?: string): boolean {
  return !['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes((method || 'GET').toUpperCase());
}

async function getCsrfToken(): Promise<string> {
  if (!csrfTokenPromise) {
    csrfTokenPromise = fetch(`${API_URL}/api/auth/csrf`, {
      credentials: 'include',
      cache: 'no-store',
    }).then(async response => {
      if (!response.ok) throw new Error('Não foi possível obter o token CSRF.');
      const body: { token?: string } = await response.json();
      if (!body.token) throw new Error('Resposta CSRF inválida.');
      return body.token;
    }).catch(error => {
      csrfTokenPromise = null;
      throw error;
    });
  }
  return csrfTokenPromise;
}

async function withCsrfHeader(headers?: HeadersInit): Promise<Headers> {
  const result = new Headers(headers);
  if (typeof window !== 'undefined') result.set('X-XSRF-TOKEN', await getCsrfToken());
  return result;
}

export async function executeSilentRefresh(): Promise<boolean> {
  if (!activeRefreshPromise) {
    activeRefreshPromise = (async () => {
      try {
        const refreshRes = await fetch(`${API_URL}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: await withCsrfHeader(),
        });
        if (refreshRes.status === 403) csrfTokenPromise = null;
        if (refreshRes.ok) refreshGeneration++;
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

const REDIRECT_FALLBACK = '/dashboard';
const REDIRECT_VALIDATION_ORIGIN = 'https://oficina.invalid';

function decodeRedirectPath(candidate: string): string | null {
  let path = candidate.split(/[?#]/, 1)[0];

  // URLSearchParams já decodifica uma camada. Repetir até estabilizar também
  // bloqueia separadores duplamente codificados antes que outra camada os interprete.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(path);
    } catch {
      return null;
    }
    if (decoded === path) return path;
    path = decoded;
  }

  return null;
}

export function sanitizarRedirect(url: string | null): string {
  if (!url) return REDIRECT_FALLBACK;

  const candidate = url.trim();
  if (!candidate) return REDIRECT_FALLBACK;

  const decodedPath = decodeRedirectPath(candidate);
  if (
    decodedPath === null ||
    !decodedPath.startsWith('/') ||
    decodedPath.startsWith('//') ||
    decodedPath.includes('\\')
  ) {
    return REDIRECT_FALLBACK;
  }

  try {
    const parsed = new URL(candidate, REDIRECT_VALIDATION_ORIGIN);
    if (
      parsed.origin !== REDIRECT_VALIDATION_ORIGIN ||
      parsed.username !== '' ||
      parsed.password !== ''
    ) {
      return REDIRECT_FALLBACK;
    }

    // Entrega ao router somente a forma interna já normalizada pelo parser WHATWG.
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return REDIRECT_FALLBACK;
  }
}

export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const url = `${API_URL}${endpoint}`;
  const generationAtStart = refreshGeneration;
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (isMutating(options.method)) {
    const csrfHeaders = await withCsrfHeader(headers);
    csrfHeaders.forEach((value, key) => headers.set(key, value));
  }
  const config: RequestInit = {
    ...options,
    credentials: 'include',
    headers,
  };

  let response = await fetch(url, config);
  if (response.status === 403 && isMutating(options.method)) csrfTokenPromise = null;

  // Se o access_token expirou (401), aguarda ou executa renovação silenciosa com refresh_token compartilhado
  if (response.status === 401 && (endpoint === '/api/auth/me' || !endpoint.startsWith('/api/auth/'))) {
    // Outra requisição pode ter concluído o refresh enquanto esta aguardava seu 401.
    // Nesse caso, usar o cookie novo sem girar o refresh token mais uma vez.
    if (refreshGeneration !== generationAtStart) {
      return fetch(url, config);
    }
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

