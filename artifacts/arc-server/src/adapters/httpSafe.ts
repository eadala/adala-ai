/**
 * SSRF-safe fetch helpers for provider adapters.
 * Base URLs are administrator-controlled allowlists — never end-user input.
 */

const GITHUB_ORIGINS = new Set(["https://api.github.com"]);

export function coolifyAllowedOrigins(): Set<string> {
  const configured = process.env.ARC_COOLIFY_ALLOWED_ORIGINS?.trim();
  if (configured) {
    return new Set(
      configured
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }
  const base = process.env.ARC_COOLIFY_BASE_URL?.trim();
  if (base) {
    try {
      return new Set([new URL(base).origin]);
    } catch {
      return new Set();
    }
  }
  /* Local fixture origin only */
  return new Set(["https://coolify.local.test"]);
}

export function assertAllowedUrl(
  url: string,
  allowOrigins: Set<string>,
): { ok: true; url: URL } | { ok: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: "malformed_url" };
  }
  if (parsed.protocol !== "https:" && parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
    /* Allow http only to loopback fixtures */
    if (parsed.protocol !== "http:" || (parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost")) {
      return { ok: false, reason: "insecure_protocol" };
    }
  }
  /* Block cloud metadata and link-local */
  const host = parsed.hostname.toLowerCase();
  if (
    host === "169.254.169.254" ||
    host === "metadata.google.internal" ||
    host.endsWith(".internal") ||
    host === "0.0.0.0"
  ) {
    return { ok: false, reason: "ssrf_blocked_host" };
  }
  if (!allowOrigins.has(parsed.origin) && !(host === "127.0.0.1" || host === "localhost")) {
    return { ok: false, reason: "origin_not_allowlisted" };
  }
  return { ok: true, url: parsed };
}

export async function safeFetchJson(
  url: string,
  opts: {
    allowOrigins: Set<string>;
    headers?: Record<string, string>;
    timeoutMs?: number;
    maxRedirects?: number;
  },
): Promise<
  | { ok: true; json: unknown; status: number }
  | { ok: false; error: string; status?: number }
> {
  const checked = assertAllowedUrl(url, opts.allowOrigins);
  if (!checked.ok) return { ok: false, error: checked.reason };

  const timeoutMs = opts.timeoutMs ?? 8000;
  try {
    const res = await fetch(checked.url.toString(), {
      method: "GET",
      headers: opts.headers,
      redirect: "error", /* no arbitrary redirect following */
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}`, status: res.status };
    }
    const json = await res.json();
    return { ok: true, json, status: res.status };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    if (/aborted|timeout/i.test(msg)) return { ok: false, error: "timeout" };
    return { ok: false, error: msg };
  }
}

export function githubAllowOrigins(): Set<string> {
  return new Set(GITHUB_ORIGINS);
}

/** Mutation methods must never be exposed on adapters */
export const PROVIDER_MUTATION_METHODS = [
  "deploy",
  "restart",
  "stop",
  "start",
  "delete",
  "create",
  "patch",
  "execute",
  "shell",
] as const;
