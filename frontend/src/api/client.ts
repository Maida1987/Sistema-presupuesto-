const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    clearTokens();
    return null;
  }

  const data = await response.json();
  setTokens(data.accessToken, data.refreshToken);
  return data.accessToken as string;
}

/**
 * Cliente HTTP mínimo: agrega el access token, y si la API responde 401
 * intenta refrescar una vez antes de propagar el error (evita forzar
 * re-login por un access token vencido en medio de una sesión activa).
 */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const doFetch = async (token: string | null) => {
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(`/api${path}`, { ...options, headers });
  };

  let response = await doFetch(getAccessToken());

  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      response = await doFetch(newToken);
    }
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(typeof body.message === 'string' ? body.message : 'Error inesperado');
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
