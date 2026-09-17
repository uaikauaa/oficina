export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

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

  // Se o access_token expirou (401), tenta renovar silenciosamente com refresh_token
  if (response.status === 401 && !endpoint.startsWith('/api/auth/')) {
    try {
      const refreshRes = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (refreshRes.ok) {
        // Repete a requisição original com os novos cookies definidos no navegador
        response = await fetch(url, config);
      }
    } catch {
      // Ignora erro de refresh e retorna o 401 original
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

