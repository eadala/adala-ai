/**
 * Shared authenticated fetch for the workspace SPA.
 *
 * Clerk getToken() → Authorization: Bearer <token>
 * Cookie auth is NOT used as the primary mechanism.
 *
 * Initialize once via <ClerkAuthFetchBridge /> inside ClerkProvider.
 */

export type ClerkTokenGetter = () => Promise<string | null | undefined>;

let _getToken: ClerkTokenGetter | null = null;
let _authReady = false;

/** Register Clerk getToken (or null on unmount). */
export function setClerkTokenGetter(getter: ClerkTokenGetter | null): void {
  _getToken = getter;
}

/** True when Clerk is loaded and the user is signed in. */
export function setAuthReady(ready: boolean): void {
  _authReady = ready;
}

export function isAuthReady(): boolean {
  return _authReady;
}

/** Test helper — reset module state between cases. */
export function __resetAuthFetchForTests(): void {
  _getToken = null;
  _authReady = false;
}

function hasAuthorizationHeader(headers: Headers): boolean {
  return headers.has("authorization") || headers.has("Authorization");
}

/**
 * Authenticated fetch for protected workspace APIs.
 * - Awaits Clerk token when a getter is registered
 * - Attaches Bearer only when a non-empty token is returned
 * - Never sends "Bearer null" / "Bearer undefined"
 * - Preserves an explicitly supplied Authorization header
 * - Preserves method, body, signal, and other RequestInit fields
 */
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);

  if (!hasAuthorizationHeader(headers) && _getToken) {
    const token = await _getToken();
    if (typeof token === "string" && token.length > 0) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  return fetch(input, { ...init, headers });
}

/**
 * Public / unauthenticated fetch — never attaches Bearer.
 * Use for marketing, health, public tokens, beacons, etc.
 */
export function publicFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return fetch(input, init);
}
