/**
 * Stage 9 — reject sensitive filesystem-like paths before SPA fallback.
 * Paths such as /.git/config and /.env must not return HTTP 200 index.html.
 */

/** True when the request path looks like a hidden/dotfile or VCS path. */
export function isSensitiveDotPath(rawPath: string): boolean {
  const pathOnly = String(rawPath ?? "").split("?")[0].split("#")[0];
  const segments = pathOnly.split("/").filter(Boolean);
  return segments.some((seg) => seg.startsWith("."));
}
