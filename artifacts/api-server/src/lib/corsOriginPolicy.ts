/**
 * Request-aware CORS origin decisions for the API server.
 *
 * The `cors` package calls `origin(origin, callback)` without `req`.
 * Callers must close over the request (options delegate / per-request middleware).
 */

import {
  isMetricsBeaconRequest,
  type PathLike,
} from "./metricsBeaconPath";

export const PRODUCTION_CORS_DOMAINS = [
  "https://adalahai.com",
  "https://www.adalahai.com",
] as const;

export type CorsOriginDecision = {
  allowed: boolean;
  /** Why null Origin header string was accepted (diagnostic only). */
  reason?: "missing-origin" | "metrics-beacon-null" | "allowlist";
};

export type CorsPolicyRequest = PathLike & {
  method?: string;
};

/**
 * Decide whether a browser Origin is allowed.
 * - Missing Origin (non-browser / same-origin omit): allowed.
 * - Literal "null" (opaque origin, e.g. sendBeacon privacy contexts): allowed
 *   ONLY for public metrics beacon paths (normalized originalUrl/path).
 * - Otherwise: production domains, ALLOWED_ORIGINS, replit, localhost.
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

  if (
    (PRODUCTION_CORS_DOMAINS as readonly string[]).includes(origin) ||
    allowedOrigins.includes(origin) ||
    /^https:\/\/.*\.replit\.app$/.test(origin) ||
    /^https:\/\/.*\.replit\.dev$/.test(origin) ||
    /^http:\/\/localhost(:\d+)?$/.test(origin)
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
