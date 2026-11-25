/**
 * Paths that must be served as compiled frontend assets without Clerk/API auth.
 * Scoped allowlist — never a blanket auth bypass.
 */

const EXACT_PUBLIC_FILES = new Set([
  "/favicon.svg",
  "/favicon.ico",
  "/logo.svg",
  "/robots.txt",
  "/sw.js",
  "/opengraph.jpg",
  "/invoice-preview.html",
  "/404.html",
]);

/** True for Vite-built `/assets/*` and a small allowlist of root static files. */
export function isPublicFrontendAssetPath(rawPath: string): boolean {
  const pathOnly = String(rawPath ?? "").split("?")[0].split("#")[0];
  if (!pathOnly || pathOnly.includes("..")) return false;
  if (pathOnly === "/assets" || pathOnly.startsWith("/assets/")) {
    // Reject nested sensitive segments under /assets
    const rest = pathOnly.slice("/assets".length);
    if (rest.includes("/.") || rest.includes("..")) return false;
    return rest.length > 1; // require a filename under /assets/
  }
  return EXACT_PUBLIC_FILES.has(pathOnly);
}

/** True when SPA HTML fallback should run (not API, not hashed assets). */
export function isSpaFallbackPath(rawPath: string): boolean {
  const pathOnly = String(rawPath ?? "").split("?")[0].split("#")[0] || "/";
  if (pathOnly.startsWith("/api")) return false;
  if (isPublicFrontendAssetPath(pathOnly)) return false;
  return true;
}
