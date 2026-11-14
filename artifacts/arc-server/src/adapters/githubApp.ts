/**
 * GitHub App installation-token acquisition architecture (Phase 2C-G).
 * Read-only. Does not create apps, install apps, or store private keys in repo.
 * Operator supplies ARC_GITHUB_APP_* via secure env — never committed.
 */

import { createSign } from "node:crypto";
import { githubAllowOrigins, safeFetchJson } from "./httpSafe.js";
import { redactSecrets } from "../lib/auditStore.js";

export type GithubAppPermissionJustification = {
  permission: string;
  access: "read" | "none";
  justification: string;
};

/** Minimal read-only permission set — each justified */
export const GITHUB_APP_PERMISSION_SPEC: GithubAppPermissionJustification[] = [
  {
    permission: "Contents",
    access: "read",
    justification: "Read commits, trees, and file metadata for immutable SHA verification",
  },
  {
    permission: "Metadata",
    access: "read",
    justification: "Required by GitHub for any repository installation",
  },
  {
    permission: "Pull requests",
    access: "read",
    justification: "Read PR metadata and review states as human-review evidence",
  },
  {
    permission: "Checks",
    access: "read",
    justification: "Read check-run / workflow conclusions without mutating checks",
  },
  {
    permission: "Actions",
    access: "read",
    justification: "Read workflow run status; write/actions:write must remain unset",
  },
  {
    permission: "Commit statuses",
    access: "read",
    justification: "Optional legacy status API reads when checks are unavailable",
  },
];

export const GITHUB_APP_FORBIDDEN_PERMISSIONS = [
  "Administration",
  "Contents:write",
  "Pull requests:write",
  "Actions:write",
  "Secrets",
  "Workflows",
  "Deployments:write",
] as const;

export type InstallationTokenResult =
  | { ok: true; token: string; expiresAt: string; source: "installation" }
  | { ok: false; reason: "missing_config" | "sign_failed" | "http_error" | "mutation_forbidden"; detail: string };

export function githubAppConfigPresent(env: NodeJS.ProcessEnv = process.env): boolean {
  return !!(
    env.ARC_GITHUB_APP_ID?.trim() &&
    env.ARC_GITHUB_APP_INSTALLATION_ID?.trim() &&
    env.ARC_GITHUB_APP_PRIVATE_KEY?.trim()
  );
}

/**
 * Build a short-lived App JWT (RS256) for installation token exchange.
 * Private key must be PEM in ARC_GITHUB_APP_PRIVATE_KEY (operator-managed).
 */
export function buildAppJwt(opts: {
  appId: string;
  privateKeyPem: string;
  nowSec?: number;
}): { ok: true; jwt: string } | { ok: false; detail: string } {
  try {
    const now = opts.nowSec ?? Math.floor(Date.now() / 1000);
    const header = Buffer.from(
      JSON.stringify({ alg: "RS256", typ: "JWT" }),
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        iat: now - 60,
        exp: now + 9 * 60,
        iss: opts.appId,
      }),
    ).toString("base64url");
    const data = `${header}.${payload}`;
    const signer = createSign("RSA-SHA256");
    signer.update(data);
    const sig = signer.sign(opts.privateKeyPem, "base64url");
    return { ok: true, jwt: `${data}.${sig}` };
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : "sign_failed",
    };
  }
}

/**
 * Exchange App JWT for installation access token (read-only use).
 * Never logs the token. Returns redacted errors.
 */
export async function fetchInstallationToken(
  env: NodeJS.ProcessEnv = process.env,
): Promise<InstallationTokenResult> {
  const appId = env.ARC_GITHUB_APP_ID?.trim();
  const installationId = env.ARC_GITHUB_APP_INSTALLATION_ID?.trim();
  const privateKey = env.ARC_GITHUB_APP_PRIVATE_KEY?.trim();
  if (!appId || !installationId || !privateKey) {
    return {
      ok: false,
      reason: "missing_config",
      detail: "ARC_GITHUB_APP_ID, ARC_GITHUB_APP_INSTALLATION_ID, ARC_GITHUB_APP_PRIVATE_KEY required",
    };
  }
  if (env.ARC_GITHUB_ALLOW_MUTATION === "true") {
    return {
      ok: false,
      reason: "mutation_forbidden",
      detail: "Refusing token acquisition while mutation flag set",
    };
  }

  const jwt = buildAppJwt({ appId, privateKeyPem: privateKey.replace(/\\n/g, "\n") });
  if (!jwt.ok) {
    return { ok: false, reason: "sign_failed", detail: jwt.detail };
  }

  const url = `https://api.github.com/app/installations/${encodeURIComponent(installationId)}/access_tokens`;
  /* POST is required for installation token mint — not a repository mutation */
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${jwt.jwt}`,
        "User-Agent": "adalah-arc-phase2cg",
      },
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return {
        ok: false,
        reason: "http_error",
        detail: String(redactSecrets(`HTTP ${res.status}`)),
      };
    }
    const body = (await res.json()) as { token?: string; expires_at?: string };
    if (!body.token) {
      return { ok: false, reason: "http_error", detail: "missing_token_field" };
    }
    return {
      ok: true,
      token: body.token,
      expiresAt: body.expires_at ?? new Date(Date.now() + 3600_000).toISOString(),
      source: "installation",
    };
  } catch (e) {
    return {
      ok: false,
      reason: "http_error",
      detail: String(redactSecrets(e instanceof Error ? e.message : "fetch_failed")),
    };
  }
}

/** Endpoint inventory for read-only verification */
export const GITHUB_READONLY_ENDPOINTS = [
  "GET /repos/{owner}/{repo}",
  "GET /repos/{owner}/{repo}/git/commits/{sha}",
  "GET /repos/{owner}/{repo}/commits/{sha}/check-runs",
  "GET /repos/{owner}/{repo}/pulls",
  "GET /repos/{owner}/{repo}/pulls/{n}/reviews",
  "GET /repos/{owner}/{repo}/actions/runs",
  "GET /repos/{owner}/{repo}/releases",
] as const;

export function assertGithubOriginSafe(url: string): boolean {
  const r = safeFetchJson; // type presence
  void r;
  try {
    const u = new URL(url);
    return githubAllowOrigins().has(u.origin);
  } catch {
    return false;
  }
}
