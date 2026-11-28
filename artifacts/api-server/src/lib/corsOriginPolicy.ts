/**
 * Request-aware CORS origin decisions for the API server.
 *
 * The `cors` package calls `origin(origin, callback)` without `req`.
 * Callers must close over the request (options delegate / per-request middleware).
 *
 * Staging incident (asset JSON 403): Vite emits `<script type="module" crossorigin>`
 * and `<link … crossorigin>`, so the browser sends `Origin: https://staging…` even for
 * same-host asset GETs. Rejecting that Origin with application/json 403 prevents SPA bootstrap.
 *
 * Security contract:
 * - Trusted origins are an explicit allowlist only (code + validated env).
 * - Never reflect Host / X-Forwarded-Host into the allowlist.
 * - Never allow wildcards or unrestricted origin reflection.
 */

import {
  isMetricsBeaconRequest,
  type PathLike,
} from "./metricsBeaconPath";

export const PRODUCTION_CORS_DOMAINS = [
  "https://adalahai.com",
  "https://www.adalahai.com",
] as const;

/** Isolated staging frontends (Clerk Development / Coolify). */
export const STAGING_CORS_DOMAINS = [
  "https://staging.adalahai.com",
] as const;

export type CorsOriginDecision = {
  allowed: boolean;
  /** Why the origin was accepted (diagnostic only). */
  reason?: "missing-origin" | "metrics-beacon-null" | "allowlist";
};

export type CorsPolicyRequest = PathLike & {
  method?: string;
};

/**
 * Strict origin parser for allowlist entries.
 * Accepts only `http(s)://host[:port]` with no path/query/hash/userinfo/wildcard.
 */
export function parseTrustedOrigin(raw: string): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  if (value.includes("*")) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if (url.pathname !== "/" || url.search || url.hash) return null;
  if (!url.hostname) return null;
  // Reconstruct canonical origin (scheme://host[:port]).
  return url.origin;
}

/** Split + validate comma-separated env allowlist entries. Invalid entries dropped. */
export function parseAllowedOriginsEnv(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of String(raw).split(",")) {
    const origin = parseTrustedOrigin(part);
    if (!origin || seen.has(origin)) continue;
    seen.add(origin);
    out.push(origin);
  }
  return out;
}

/**
 * Decide whether a browser Origin is allowed.
 * - Missing Origin (non-browser / same-origin omit): allowed.
 * - Literal "null" (opaque origin): allowed ONLY for public metrics beacons.
 * - Otherwise: production + staging code allowlists, validated ALLOWED_ORIGINS,
 *   and localhost only when NODE_ENV !== "production".
 *
 * Does NOT trust Host / X-Forwarded-Host.
 */
export function evaluateCorsOrigin(
  origin: string | undefined,
  req: CorsPolicyRequest,
  allowedOrigins: readonly string[] = [],
): CorsOriginDecision {
  if (!origin) {
    return { allowed: true, reason: "missing-origin" };
  }

  // Opaque origin — never allow globally; public beacons only.
  if (origin === "null") {
    if (isMetricsBeaconRequest(req)) {
      return { allowed: true, reason: "metrics-beacon-null" };
    }
    return { allowed: false };
  }

  // Reject malformed / non-canonical Origin strings (paths, wildcards, junk).
  const normalized = parseTrustedOrigin(origin);
  if (!normalized || normalized !== origin) {
    return { allowed: false };
  }

  const envAllow = allowedOrigins
    .map((o) => parseTrustedOrigin(o))
    .filter((o): o is string => Boolean(o));

  const localhostOk =
    process.env.NODE_ENV !== "production" &&
    /^http:\/\/localhost(:\d+)?$/.test(origin);

  if (
    (PRODUCTION_CORS_DOMAINS as readonly string[]).includes(origin) ||
    (STAGING_CORS_DOMAINS as readonly string[]).includes(origin) ||
    envAllow.includes(origin) ||
    localhostOk
  ) {
    return { allowed: true, reason: "allowlist" };
  }

  return { allowed: false };
}

/** Rejected CORS origins should not surface as INTERNAL_ERROR 500. */
export function createCorsOriginRejectedError(origin: string): Error & {
  status: number;
  statusCode: number;
  code: string;
} {
  const err = new Error(`CORS: origin not allowed — ${origin}`) as Error & {
    status: number;
    statusCode: number;
    code: string;
  };
  err.status = 403;
  err.statusCode = 403;
  err.code = "CORS_ORIGIN_NOT_ALLOWED";
  return err;
}
