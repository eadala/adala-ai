/**
 * Metrics beacon path helpers — public fire-and-forget endpoints.
 * Matching must tolerate proxy rewrites, trailing slashes, and mount prefixes.
 */

export type PathLike = {
  originalUrl?: string;
  url?: string;
  path?: string;
  baseUrl?: string;
};

/** Strip querystring, decode, collapse slashes, remove trailing slash. */
export function normalizeBeaconPath(path: string): string {
  let p = (path ?? "").split("?")[0] || "/";
  try {
    p = decodeURIComponent(p);
  } catch {
    /* keep raw */
  }
  p = p.replace(/\/{2,}/g, "/");
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p || "/";
}

/**
 * Prefer originalUrl (stable across Express mounts) then url then path.
 * Also consider baseUrl+url when inside a mounted middleware.
 */
export function getRequestPathname(req: PathLike): string {
  const candidates = [
    req.originalUrl,
    req.url,
    req.path,
    req.baseUrl && req.url ? `${req.baseUrl}${req.url === "/" ? "" : req.url}` : undefined,
    req.baseUrl,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) {
      return normalizeBeaconPath(c);
    }
  }
  return "/";
}

const BEACON_SUFFIXES = ["/metrics/vitals", "/metrics/route-analytics"] as const;

/** True when pathname is a public metrics beacon (any mount prefix). */
export function isMetricsBeaconPath(path: string): boolean {
  const p = normalizeBeaconPath(path);
  return BEACON_SUFFIXES.some((suffix) => p === suffix || p.endsWith(suffix));
}

/** Request-aware beacon check — use before clerkMiddleware. */
export function isMetricsBeaconRequest(req: PathLike): boolean {
  return isMetricsBeaconPath(getRequestPathname(req));
}
