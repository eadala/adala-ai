const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

export async function API(path: string, init?: RequestInit): Promise<any> {
  const url = `${BASE}/api${path.startsWith("/") ? path : "/" + path}`;
  const res = await fetch(url, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err?.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}
