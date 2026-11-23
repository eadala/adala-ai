import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/authFetch";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/**
 * Legacy token injection used by <SuperAdmin>.
 * Shared authFetch + ClerkAuthFetchBridge is the source of truth;
 * keep the setter so existing SuperAdmin wiring does not break.
 */
export let _getToken: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>) {
  _getToken = fn;
}

export async function API(path: string, opts?: RequestInit) {
  const headers = new Headers(opts?.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await authFetch(`${BASE}/api/admin${path}`, { ...opts, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function DEV_API(path: string, opts?: RequestInit) {
  const headers = new Headers(opts?.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await authFetch(`${BASE}/api/developer${path}`, { ...opts, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export function useAdmin<T>(path: string) {
  return useQuery<T>({ queryKey: ["admin", path], queryFn: () => API(path), retry: false });
}
