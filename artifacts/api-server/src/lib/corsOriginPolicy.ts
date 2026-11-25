/**
 * Request-aware CORS origin decisions for the API server.
 *
 * The `cors` package calls `origin(origin, callback)` without `req`.
 * Callers must close over the request (options delegate / per-request middleware).
 *
 * Staging incident (asset JSON 403): Vite emits `<script type="module" crossorigin>`
 * and `<link … crossorigin>`, so the browser sends `Origin: https://staging…` even for
 * same-host asset GETs. Rejecting that Origin with application/json 403 prevents SPA bootstrap.
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
  reason?:
    | "missing-origin"
    | "metrics-beacon-null"
    | "allowlist"
    | "same-origin";
};

export type CorsPolicyRequest = PathLike & {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  protocol?: string;
  hostname?: string;
};

function firstHeader(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Public origin of this request (scheme://host[:port]) from proxy-aware headers.
 * Used to allow same-origin Vite `crossorigin` asset loads without env sprawl.
 */
export function requestPublicOrigin(req: CorsPolicyRequest): string | undefined {
  const xfProto = firstHeader(req.headers?.["x-forwarded-proto"]);
  const protoRaw =
    xfProto?.split(",")[0]?.trim() ||
    (req.protocol ? String(req.protocol).replace(/:$/, "") : "") ||
    "https";
  const proto = protoRaw.toLowerCase() === "http" ? "http" : "https";

  const xfHost = firstHeader(req.headers?.["x-forwarded-host"]);
  const hostRaw =
    xfHost?.split(",")[0]?.trim() ||
    firstHeader(req.headers?.host)?.trim() ||
    (req.hostname ? String(req.hostname).trim() : "");
  if (!hostRaw) return undefined;
  // Reject header injection / path smuggling in Host.
  if (/[\s/?#\\]/.test(hostRaw)) return undefined;
  return `${proto}://${hostRaw}`;
}

/**
 * Decide whether a browser Origin is allowed.
 * - Missing Origin (non-browser / same-origin omit): allowed.
 * - Literal "null" (opaque origin, e.g. sendBeacon privacy contexts): allowed
 *   ONLY for public metrics beacon paths (normalized originalUrl/path).
 * - Same as request public origin (Host / X-Forwarded-*): allowed.
 * - Otherwise: production + staging domains, ALLOWED_ORIGINS, localhost.
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

  const self = requestPublicOrigin(req);
  if (self && origin === self) {
    return { allowed: true, reason: "same-origin" };
  }

  if (
    (PRODUCTION_CORS_DOMAINS as readonly string[]).includes(origin) ||
    (STAGING_CORS_DOMAINS as readonly string[]).includes(origin) ||
    allowedOrigins.includes(origin) ||
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
