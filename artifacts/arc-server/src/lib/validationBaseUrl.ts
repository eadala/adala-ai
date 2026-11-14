/**
 * Strict ARC_BASE_URL destination validation (F-PRELIVE-001 closure).
 * Default policy: loopback-only HTTP(S) for local validation fixtures.
 * Does not contact production. AI/operators cannot expand allowlist via request input —
 * only process env administered by operators.
 */

import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

export type BaseUrlPolicy = "loopback" | "staging_allowlist";

export type BaseUrlDenial =
  | "malformed_url"
  | "embedded_credentials"
  | "unexpected_scheme"
  | "unexpected_query"
  | "unexpected_fragment"
  | "unapproved_port"
  | "ambiguous_host"
  | "control_characters"
  | "unauthorized_hostname"
  | "unauthorized_resolved_ip"
  | "dns_failure"
  | "missing_allowlist"
  | "cloud_metadata"
  | "proxy_env_present"
  | "production_target"
  | "empty_url";

export type BaseUrlValidation =
  | {
      ok: true;
      normalized: string;
      hostname: string;
      port: number;
      scheme: "http" | "https";
      resolvedAddresses: string[];
      policy: BaseUrlPolicy;
    }
  | { ok: false; reason: BaseUrlDenial; detail: string };

const DEFAULT_LOOPBACK_PORTS = new Set([8787, 5177, 3000, 5000, 8080]);
const PRODUCTION_HOST_BLOCKLIST = [
  "adalah.ai",
  "www.adalah.ai",
  "api.adalah.ai",
  "clerk.adalah.ai",
  "coolify.adalah.ai",
];

function hasControlChars(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return true;
  }
  return false;
}

function isLoopbackHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h === "localhost.") return true;
  if (h === "127.0.0.1" || h === "::1" || h === "0:0:0:0:0:0:0:1") return true;
  /* IPv4-mapped IPv6 loopback */
  if (h === "::ffff:127.0.0.1") return true;
  return false;
}

function isCloudMetadataHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    h === "169.254.169.254" ||
    h === "metadata.google.internal" ||
    h.endsWith(".internal") ||
    h === "metadata" ||
    h === "0.0.0.0"
  );
}

function isPrivateNonLoopbackIp(ip: string): boolean {
  if (isLoopbackHost(ip)) return false;
  if (ip.includes(":")) {
    /* IPv6 ULA fc00::/7, link-local fe80::/10 — treat as private non-loopback */
    const lower = ip.toLowerCase();
    if (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) {
      return true;
    }
    return false;
  }
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

export function proxyEnvPresent(env: NodeJS.ProcessEnv = process.env): string[] {
  const keys = ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"];
  return keys.filter((k) => !!(env[k] && String(env[k]).trim()));
}

export function parseBaseUrlAllowlist(raw: string | undefined): string[] | null {
  if (raw == null || !raw.trim()) return null;
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Validate ARC_BASE_URL before any HTTP client use.
 * Default policy loopback-only. Staging hosts require ARC_BASE_URL_POLICY=staging_allowlist
 * and ARC_BASE_URL_ALLOWLIST=host1,host2 (administrator env only).
 */
export async function validateArcBaseUrl(
  rawUrl: string | undefined,
  opts?: {
    env?: NodeJS.ProcessEnv;
    resolveDns?: boolean;
    /** Test hook: override DNS resolution */
    dnsLookup?: (hostname: string) => Promise<string[]>;
  },
): Promise<BaseUrlValidation> {
  const env = opts?.env ?? process.env;
  const resolveDns = opts?.resolveDns !== false;

  if (rawUrl == null || !String(rawUrl).trim()) {
    return { ok: false, reason: "empty_url", detail: "ARC_BASE_URL empty" };
  }
  const raw = String(rawUrl);
  if (hasControlChars(raw)) {
    return { ok: false, reason: "control_characters", detail: "control characters in URL" };
  }
  const input = raw.trim();

  /* Proxy ambiguity: deny unless explicitly allowed for this process */
  const proxies = proxyEnvPresent(env);
  if (proxies.length && (env.ARC_ALLOW_HTTP_PROXY ?? "").toLowerCase() !== "true") {
    return {
      ok: false,
      reason: "proxy_env_present",
      detail: `proxy env set: ${proxies.join(",")}`,
    };
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: "malformed_url", detail: "URL parse failed" };
  }

  if (url.username || url.password) {
    return { ok: false, reason: "embedded_credentials", detail: "userinfo forbidden" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "unexpected_scheme", detail: url.protocol };
  }
  /* Base URL must not carry query/hash — path may be empty or / only */
  if (url.search) {
    return { ok: false, reason: "unexpected_query", detail: url.search };
  }
  if (url.hash) {
    return { ok: false, reason: "unexpected_fragment", detail: url.hash };
  }
  if (url.pathname && url.pathname !== "/" && url.pathname !== "") {
    return {
      ok: false,
      reason: "malformed_url",
      detail: "base URL must not include a resource path",
    };
  }

  const hostname = url.hostname;
  if (!hostname || hostname.includes("%") || hostname.includes(" ")) {
    return { ok: false, reason: "ambiguous_host", detail: "encoded or empty host" };
  }

  /* Reject decimal/octal weird IPv4 forms that URL parser might normalize differently —
     require canonical hostname match after round-trip */
  const roundTrip = new URL(url.toString());
  if (roundTrip.hostname.toLowerCase() !== hostname.toLowerCase()) {
    return { ok: false, reason: "ambiguous_host", detail: "hostname normalization mismatch" };
  }

  if (isCloudMetadataHost(hostname)) {
    return { ok: false, reason: "cloud_metadata", detail: hostname };
  }

  const hostLower = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (PRODUCTION_HOST_BLOCKLIST.some((h) => hostLower === h || hostLower.endsWith(`.${h}`))) {
    return { ok: false, reason: "production_target", detail: hostname };
  }

  const port =
    url.port !== ""
      ? Number(url.port)
      : url.protocol === "https:"
        ? 443
        : 80;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, reason: "unapproved_port", detail: String(url.port) };
  }

  const policy: BaseUrlPolicy =
    (env.ARC_BASE_URL_POLICY ?? "loopback").toLowerCase() === "staging_allowlist"
      ? "staging_allowlist"
      : "loopback";

  if (policy === "loopback") {
    if (url.protocol !== "http:") {
      /* Local fixtures use http on loopback; https to loopback unusual — deny to reduce MITM confusion */
      return {
        ok: false,
        reason: "unexpected_scheme",
        detail: "loopback policy requires http scheme",
      };
    }
    if (!DEFAULT_LOOPBACK_PORTS.has(port) && (env.ARC_BASE_URL_ALLOW_ANY_LOOPBACK_PORT ?? "") !== "true") {
      return {
        ok: false,
        reason: "unapproved_port",
        detail: `loopback port ${port} not in default fixture ports`,
      };
    }
    if (!isLoopbackHost(hostname)) {
      return {
        ok: false,
        reason: "unauthorized_hostname",
        detail: `loopback policy rejects host ${hostname}`,
      };
    }
  } else {
    const allow = parseBaseUrlAllowlist(env.ARC_BASE_URL_ALLOWLIST);
    if (!allow || allow.length === 0) {
      return {
        ok: false,
        reason: "missing_allowlist",
        detail: "ARC_BASE_URL_ALLOWLIST required for staging_allowlist policy",
      };
    }
    if (!allow.includes(hostLower)) {
      return {
        ok: false,
        reason: "unauthorized_hostname",
        detail: `host ${hostname} not in allowlist`,
      };
    }
    if (url.protocol !== "https:") {
      return {
        ok: false,
        reason: "unexpected_scheme",
        detail: "staging_allowlist requires https",
      };
    }
  }

  let resolvedAddresses: string[] = [];
  if (resolveDns) {
    const lookTarget = hostLower.replace(/^\[|\]$/g, "");
    if (isIP(lookTarget)) {
      resolvedAddresses = [lookTarget];
    } else if (opts?.dnsLookup) {
      try {
        resolvedAddresses = await opts.dnsLookup(lookTarget);
      } catch (e) {
        return {
          ok: false,
          reason: "dns_failure",
          detail: e instanceof Error ? e.message : "dns_lookup_failed",
        };
      }
    } else {
      try {
        const records = await lookup(lookTarget, { all: true, verbatim: true });
        resolvedAddresses = records.map((r) => r.address);
      } catch (e) {
        return {
          ok: false,
          reason: "dns_failure",
          detail: e instanceof Error ? e.message : "dns_lookup_failed",
        };
      }
    }
    if (!resolvedAddresses.length) {
      return { ok: false, reason: "dns_failure", detail: "no addresses" };
    }
    for (const addr of resolvedAddresses) {
      if (isCloudMetadataHost(addr)) {
        return { ok: false, reason: "cloud_metadata", detail: addr };
      }
      if (policy === "loopback") {
        if (!isLoopbackHost(addr)) {
          return {
            ok: false,
            reason: "unauthorized_resolved_ip",
            detail: `resolved ${addr} is not loopback`,
          };
        }
      } else {
        /* staging: reject unexpected private/metadata unless allowlist explicitly includes that IP host */
        if (isPrivateNonLoopbackIp(addr) && !allowIncludesIp(env.ARC_BASE_URL_ALLOWLIST, addr)) {
          return {
            ok: false,
            reason: "unauthorized_resolved_ip",
            detail: `resolved private IP ${addr} not explicitly allowlisted`,
          };
        }
      }
    }
  }

  const normalized = `${url.protocol}//${hostname}${url.port ? `:${url.port}` : ""}`;
  return {
    ok: true,
    normalized,
    hostname,
    port,
    scheme: url.protocol === "https:" ? "https" : "http",
    resolvedAddresses,
    policy,
  };
}

function allowIncludesIp(raw: string | undefined, ip: string): boolean {
  const allow = parseBaseUrlAllowlist(raw);
  return !!allow?.includes(ip.toLowerCase());
}

/** Synchronous structural checks only (no DNS) — for shell preflight */
export function validateArcBaseUrlSync(
  rawUrl: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): BaseUrlValidation {
  /* Re-run without DNS by temporarily using resolveDns:false via async sync trick —
     implement structural subset inline for shell CLI. */
  return structuralValidate(rawUrl, env);
}

function structuralValidate(
  rawUrl: string | undefined,
  env: NodeJS.ProcessEnv,
): BaseUrlValidation {
  if (rawUrl == null || !String(rawUrl).trim()) {
    return { ok: false, reason: "empty_url", detail: "ARC_BASE_URL empty" };
  }
  const raw = String(rawUrl);
  if (hasControlChars(raw)) {
    return { ok: false, reason: "control_characters", detail: "control characters in URL" };
  }
  const input = raw.trim();
  const proxies = proxyEnvPresent(env);
  if (proxies.length && (env.ARC_ALLOW_HTTP_PROXY ?? "").toLowerCase() !== "true") {
    return {
      ok: false,
      reason: "proxy_env_present",
      detail: `proxy env set: ${proxies.join(",")}`,
    };
  }
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: "malformed_url", detail: "URL parse failed" };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "embedded_credentials", detail: "userinfo forbidden" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "unexpected_scheme", detail: url.protocol };
  }
  if (url.search) return { ok: false, reason: "unexpected_query", detail: url.search };
  if (url.hash) return { ok: false, reason: "unexpected_fragment", detail: url.hash };
  if (url.pathname && url.pathname !== "/" && url.pathname !== "") {
    return {
      ok: false,
      reason: "malformed_url",
      detail: "base URL must not include a resource path",
    };
  }
  const hostname = url.hostname;
  if (!hostname || hostname.includes("%")) {
    return { ok: false, reason: "ambiguous_host", detail: "encoded or empty host" };
  }
  if (isCloudMetadataHost(hostname)) {
    return { ok: false, reason: "cloud_metadata", detail: hostname };
  }
  const hostLower = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (PRODUCTION_HOST_BLOCKLIST.some((h) => hostLower === h || hostLower.endsWith(`.${h}`))) {
    return { ok: false, reason: "production_target", detail: hostname };
  }
  const port =
    url.port !== "" ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, reason: "unapproved_port", detail: String(url.port) };
  }
  const policy: BaseUrlPolicy =
    (env.ARC_BASE_URL_POLICY ?? "loopback").toLowerCase() === "staging_allowlist"
      ? "staging_allowlist"
      : "loopback";
  if (policy === "loopback") {
    if (url.protocol !== "http:") {
      return {
        ok: false,
        reason: "unexpected_scheme",
        detail: "loopback policy requires http scheme",
      };
    }
    if (!DEFAULT_LOOPBACK_PORTS.has(port) && (env.ARC_BASE_URL_ALLOW_ANY_LOOPBACK_PORT ?? "") !== "true") {
      return {
        ok: false,
        reason: "unapproved_port",
        detail: `loopback port ${port} not in default fixture ports`,
      };
    }
    if (!isLoopbackHost(hostname)) {
      return {
        ok: false,
        reason: "unauthorized_hostname",
        detail: `loopback policy rejects host ${hostname}`,
      };
    }
  } else {
    const allow = parseBaseUrlAllowlist(env.ARC_BASE_URL_ALLOWLIST);
    if (!allow || allow.length === 0) {
      return {
        ok: false,
        reason: "missing_allowlist",
        detail: "ARC_BASE_URL_ALLOWLIST required for staging_allowlist policy",
      };
    }
    if (!allow.includes(hostLower)) {
      return {
        ok: false,
        reason: "unauthorized_hostname",
        detail: `host ${hostname} not in allowlist`,
      };
    }
    if (url.protocol !== "https:") {
      return {
        ok: false,
        reason: "unexpected_scheme",
        detail: "staging_allowlist requires https",
      };
    }
  }
  const normalized = `${url.protocol}//${hostname}${url.port ? `:${url.port}` : ""}`;
  return {
    ok: true,
    normalized,
    hostname,
    port,
    scheme: url.protocol === "https:" ? "https" : "http",
    resolvedAddresses: [],
    policy,
  };
}

/** CLI entry for shell script — prints normalized URL or errors to stderr */
export async function mainCli(argv = process.argv.slice(2)): Promise<number> {
  const url = argv[0] ?? process.env.ARC_BASE_URL;
  const result = await validateArcBaseUrl(url);
  if (!result.ok) {
    console.error(`ARC_BASE_URL_DENIED:${result.reason}:${result.detail}`);
    return 1;
  }
  console.log(result.normalized);
  return 0;
}
