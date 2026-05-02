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

/** multipart/form-data with Bearer auth; do not set Content-Type (browser sets boundary). */
export async function apiMultipart<T>(path: string, formData: FormData): Promise<T> {
  const headers = new Headers();
  const t = getToken();
  if (t) headers.set('Authorization', `Bearer ${t}`);

  const res = await fetch(path, {
    method: 'POST',
    headers,
    body: formData,
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

/** Download binary with JWT (for attachment endpoints). */
export async function fetchAuthorizedBlob(path: string): Promise<Blob> {
  const headers = new Headers();
  const t = getToken();
  if (t) headers.set('Authorization', `Bearer ${t}`);
  const res = await fetch(path, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.blob();
}

export async function authorizedDelete(path: string): Promise<void> {
  const headers = new Headers();
  const t = getToken();
  if (t) headers.set('Authorization', `Bearer ${t}`);
  const res = await fetch(path, { method: 'DELETE', headers });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* keep text */
    }
    throw new Error(msg || res.statusText);
  }
}
