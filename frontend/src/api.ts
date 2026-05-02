const TOKEN_KEY = 'helpdesk_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(
  path: string,
  options: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.json !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  const t = getToken();
  if (t) headers.set('Authorization', `Bearer ${t}`);

  const res = await fetch(path, {
    ...options,
    headers,
    body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = { error: text };
    }
  }

  if (!res.ok) {
    const msg =
      typeof data === 'object' && data && 'error' in data && typeof (data as { error: string }).error === 'string'
        ? (data as { error: string }).error
        : res.statusText;
    throw new Error(msg);
  }
  return data as T;
}
