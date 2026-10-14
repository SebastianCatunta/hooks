export interface User { id: string; email: string; name: string }
export interface SessionResponse { user: User }
export interface ProtectedResponse extends SessionResponse { message: string }

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '');

async function request<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'include',
      cache: 'no-store',
      ...(body === undefined ? {} : {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'No pudimos conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.');
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, data?.error?.code || 'UNKNOWN_ERROR',
      data?.error?.message || 'No pudimos completar la solicitud. Inténtalo de nuevo.');
  }
  if (!data) throw new ApiError(response.status, 'INVALID_RESPONSE', 'El servidor devolvió una respuesta no válida.');
  return data as T;
}

export const api = {
  session: () => request<SessionResponse>('/api/auth/session'),
  login: (email: string, password: string) => request<SessionResponse>('/api/auth/login', { email: email.trim().toLowerCase(), password }),
  logout: () => request<void>('/api/auth/logout', {}),
  protected: () => request<ProtectedResponse>('/api/protected'),
};
