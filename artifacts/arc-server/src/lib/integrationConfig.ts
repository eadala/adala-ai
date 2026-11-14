/**
 * Phase 2C-G integration configuration validation.
 * Placeholder env names only — never embed real secrets.
 */

export type IntegrationGateResult =
  | "VERIFIED_FIXTURE"
  | "VERIFIED_LIVE_TEST"
  | "BLOCKED_NO_CREDENTIALS"
  | "BLOCKED_NO_AUTHORIZATION"
  | "FAILED";

const PRODUCTION_OIDC_HOST_BLOCKLIST = [
  "clerk.adalah.ai",
  "accounts.adalah.ai",
  /* customer-facing production IdP hosts — test configs must not point here */
];

const PRODUCTION_GITHUB_BLOCKLIST_HOSTS: string[] = [
  /* GitHub API itself is allowed for read-only test; account mutation UIs are out of band */
];

export type EnvValidationIssue = {
  variable: string;
  severity: "error" | "warning";
  message: string;
};

export function validateOidcEnv(env: NodeJS.ProcessEnv = process.env): {
  ok: boolean;
  mode: "fixture" | "live";
  issues: EnvValidationIssue[];
  liveGate: IntegrationGateResult;
} {
  const issues: EnvValidationIssue[] = [];
  const mode = (env.ARC_OIDC_MODE ?? "fixture").toLowerCase() === "live" ? "live" : "fixture";

  if (mode === "fixture") {
    return {
      ok: true,
      mode,
      issues,
      liveGate: "VERIFIED_FIXTURE",
    };
  }

  const issuer = env.ARC_OIDC_ISSUER?.trim();
  const audience = env.ARC_OIDC_AUDIENCE?.trim();
  const jwks = env.ARC_OIDC_JWKS_URL?.trim();
  const allowlist = env.ARC_OIDC_OPERATOR_ALLOWLIST?.trim();

  if (!issuer) {
    issues.push({
      variable: "ARC_OIDC_ISSUER",
      severity: "error",
      message: "Required for live OIDC",
    });
  } else {
    try {
      const u = new URL(issuer);
      if (u.protocol !== "https:") {
        issues.push({
          variable: "ARC_OIDC_ISSUER",
          severity: "error",
          message: "Issuer must be https",
        });
      }
      if (PRODUCTION_OIDC_HOST_BLOCKLIST.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))) {
        issues.push({
          variable: "ARC_OIDC_ISSUER",
          severity: "error",
          message: "Issuer host is blocked for test-only configuration (customer/production IdP)",
        });
      }
    } catch {
      issues.push({
        variable: "ARC_OIDC_ISSUER",
        severity: "error",
        message: "Invalid issuer URL",
      });
    }
  }

  if (!audience) {
    issues.push({
      variable: "ARC_OIDC_AUDIENCE",
      severity: "error",
      message: "Required for live OIDC — must be dedicated ARC audience, not customer SPA",
    });
  }

  if (!jwks) {
    issues.push({
      variable: "ARC_OIDC_JWKS_URL",
      severity: "error",
      message: "Required for live OIDC JWKS retrieval",
    });
  } else {
    try {
      const u = new URL(jwks);
      if (u.protocol !== "https:") {
        issues.push({
          variable: "ARC_OIDC_JWKS_URL",
          severity: "error",
          message: "JWKS URL must be https",
        });
      }
    } catch {
      issues.push({
        variable: "ARC_OIDC_JWKS_URL",
        severity: "error",
        message: "Invalid JWKS URL",
      });
    }
  }

  if (!allowlist) {
    issues.push({
      variable: "ARC_OIDC_OPERATOR_ALLOWLIST",
      severity: "warning",
      message: "Recommended: explicit operator subject allowlist for live mode",
    });
  }

  /* Live mode must not rely on HMAC */
  if ((env.ARC_ALLOW_DEV_HMAC ?? "true").toLowerCase() === "true") {
    issues.push({
      variable: "ARC_ALLOW_DEV_HMAC",
      severity: "error",
      message: "Must be false when ARC_OIDC_MODE=live — HMAC must not substitute for failed OIDC",
    });
  }

  const hasErrors = issues.some((i) => i.severity === "error");
  if (hasErrors && !jwks) {
    return { ok: false, mode, issues, liveGate: "BLOCKED_NO_CREDENTIALS" };
  }
  if (hasErrors) {
    return { ok: false, mode, issues, liveGate: "BLOCKED_NO_AUTHORIZATION" };
  }
  return { ok: true, mode, issues, liveGate: "VERIFIED_LIVE_TEST" /* readiness only — harness must still exercise */ };
}

export function validateGithubEnv(env: NodeJS.ProcessEnv = process.env): {
  ok: boolean;
  mode: "fixture" | "live";
  issues: EnvValidationIssue[];
  liveGate: IntegrationGateResult;
} {
  void PRODUCTION_GITHUB_BLOCKLIST_HOSTS;
  const issues: EnvValidationIssue[] = [];
  const mode = (env.ARC_GITHUB_MODE ?? "fixture").toLowerCase() === "live" ? "live" : "fixture";

  if (mode === "fixture") {
    return { ok: true, mode, issues, liveGate: "VERIFIED_FIXTURE" };
  }

  const token = env.ARC_GITHUB_TOKEN?.trim();
  const allowlist = env.ARC_GITHUB_REPO_ALLOWLIST?.trim();
  const appId = env.ARC_GITHUB_APP_ID?.trim();
  const installId = env.ARC_GITHUB_APP_INSTALLATION_ID?.trim();

  if (!token && !(appId && installId && env.ARC_GITHUB_APP_PRIVATE_KEY?.trim())) {
    issues.push({
      variable: "ARC_GITHUB_TOKEN|ARC_GITHUB_APP_*",
      severity: "error",
      message: "Live GitHub requires installation token or App ID + installation + private key placeholders filled by operator",
    });
  }

  if (!allowlist) {
    issues.push({
      variable: "ARC_GITHUB_REPO_ALLOWLIST",
      severity: "error",
      message: "Repository allowlist required in live mode",
    });
  } else if (allowlist.split(",").some((r) => r.trim() === "*")) {
    issues.push({
      variable: "ARC_GITHUB_REPO_ALLOWLIST",
      severity: "error",
      message: "Wildcard allowlist forbidden",
    });
  }

  if (env.ARC_GITHUB_ALLOW_MUTATION === "true") {
    issues.push({
      variable: "ARC_GITHUB_ALLOW_MUTATION",
      severity: "error",
      message: "Mutation flag must never be enabled",
    });
  }

  const hasErrors = issues.some((i) => i.severity === "error");
  if (hasErrors && !token && !appId) {
    return { ok: false, mode, issues, liveGate: "BLOCKED_NO_CREDENTIALS" };
  }
  if (hasErrors) {
    return { ok: false, mode, issues, liveGate: "BLOCKED_NO_AUTHORIZATION" };
  }
  return { ok: true, mode, issues, liveGate: "VERIFIED_LIVE_TEST" };
}

/** Redact any env snapshot for logging — never print secret values */
export function redactEnvSnapshot(
  keys: string[],
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const secretish = /token|secret|password|private|key|credential|authorization/i;
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = env[k];
    if (v == null || v === "") out[k] = "<unset>";
    else if (secretish.test(k)) out[k] = "<redacted>";
    else out[k] = v;
  }
  return out;
}

export const OIDC_ENV_KEYS = [
  "ARC_OIDC_MODE",
  "ARC_OIDC_ISSUER",
  "ARC_OIDC_AUDIENCE",
  "ARC_OIDC_JWKS_URL",
  "ARC_OIDC_OPERATOR_ALLOWLIST",
  "ARC_OIDC_SUBJECT_ROLE_JSON",
  "ARC_OIDC_REQUIRE_MFA",
  "ARC_OIDC_REQUIRED_ACR",
  "ARC_OIDC_CLOCK_SKEW_SEC",
  "ARC_ALLOW_DEV_HMAC",
] as const;

export const GITHUB_ENV_KEYS = [
  "ARC_GITHUB_MODE",
  "ARC_GITHUB_TOKEN",
  "ARC_GITHUB_APP_ID",
  "ARC_GITHUB_APP_INSTALLATION_ID",
  "ARC_GITHUB_APP_PRIVATE_KEY",
  "ARC_GITHUB_REPO_ALLOWLIST",
  "ARC_GITHUB_PAGE_SIZE",
  "ARC_GITHUB_CACHE_TTL_MS",
  "ARC_GITHUB_ALLOW_MUTATION",
] as const;
