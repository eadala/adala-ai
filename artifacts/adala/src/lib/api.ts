const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

type TokenGetter = () => Promise<string | null | undefined>;

/**
 * Authenticated API helper — attaches Clerk bearer when available and
 * always includes credentials for cookie session fallback.
 *
 * Generic default matches historical JSON payloads used across pages.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- callers historically treat API JSON as any
export async function API<T = any>(
  path: string,
  init?: RequestInit,
  getToken?: TokenGetter,
): Promise<T> {
  const url = `${BASE}/api${path.startsWith("/") ? path : "/" + path}`;
  const headers = new Headers(init?.headers ?? undefined);
  if (getToken) {
    const token = await getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && init?.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(url, { ...init, headers, credentials: "include" });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: res.statusText }))) as {
      error?: string;
    };
    throw new Error(err?.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
