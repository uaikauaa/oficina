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
