// Always same-origin: the Bun server serves both the bundle and the API on one port.
export const API_BASE = '/api';

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new ApiError(res.status, `${init?.method ?? 'GET'} ${path} → ${res.status} ${detail}`);
  }
  return res;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await request(path);
  return (await res.json()) as T;
}

export async function apiSend<T>(
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown
): Promise<T> {
  const res = await request(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return (await res.json()) as T;
}
