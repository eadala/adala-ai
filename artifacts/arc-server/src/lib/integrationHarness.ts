import { issueFixtureAccessToken, liveOidcStatus, verifyOidcBearer } from "./oidc.js";
import { githubAdapter } from "../adapters/github.js";
import {
  type IntegrationGateResult,
  validateGithubEnv,
  validateOidcEnv,
  redactEnvSnapshot,
  OIDC_ENV_KEYS,
  GITHUB_ENV_KEYS,
} from "./integrationConfig.js";
import { coolifyAdapter } from "../adapters/coolify.js";
import { roleHasPermission } from "./permissions.js";

export type HarnessCaseResult = {
  id: string;
  category: "oidc" | "github" | "safety";
  result: IntegrationGateResult;
  detail: string;
  observedAt: string;
};

export type HarnessReport = {
  phase: "2CG";
  deploymentExecutionEnabled: false;
  coolifyExecuteDeploy: false;
  cases: HarnessCaseResult[];
  oidcEnv: ReturnType<typeof validateOidcEnv>;
  githubEnv: ReturnType<typeof validateGithubEnv>;
  envSnapshotRedacted: Record<string, string>;
  summary: Record<IntegrationGateResult, number>;
};

function caseResult(
  id: string,
  category: HarnessCaseResult["category"],
  result: IntegrationGateResult,
  detail: string,
): HarnessCaseResult {
  return { id, category, result, detail, observedAt: new Date().toISOString() };
}

/**
 * Isolated integration harness.
 * Never reports fixture success as live. Never triggers deploy/mutation.
 */
export async function runIntegrationHarness(): Promise<HarnessReport> {
  const cases: HarnessCaseResult[] = [];
  const oidcEnv = validateOidcEnv();
  const githubEnv = validateGithubEnv();

  /* --- OIDC fixture --- */
  try {
    const token = await issueFixtureAccessToken("auditor");
    const v = await verifyOidcBearer(`Bearer ${token}`);
    cases.push(
      caseResult(
        "oidc.fixture.verify",
        "oidc",
        v.ok ? "VERIFIED_FIXTURE" : "FAILED",
        v.ok ? "Fixture RS256 token verified" : `fixture_verify_failed:${!v.ok && v.reason}`,
      ),
    );
  } catch (e) {
    cases.push(
      caseResult(
        "oidc.fixture.verify",
        "oidc",
        "FAILED",
        e instanceof Error ? e.message : "fixture_error",
      ),
    );
  }

  /* --- OIDC live (optional) --- */
  const oidcLive = liveOidcStatus();
  if (oidcLive.status === "fixture") {
    cases.push(
      caseResult(
        "oidc.live",
        "oidc",
        "VERIFIED_FIXTURE",
        "Live not requested (ARC_OIDC_MODE≠live) — fixture path only; not claimed as live",
      ),
    );
  } else if (oidcLive.status === "BLOCKED" || !oidcEnv.ok) {
    cases.push(
      caseResult(
        "oidc.live",
        "oidc",
        oidcEnv.liveGate === "BLOCKED_NO_AUTHORIZATION"
          ? "BLOCKED_NO_AUTHORIZATION"
          : "BLOCKED_NO_CREDENTIALS",
        oidcLive.reason,
      ),
    );
  } else {
    /* Credentials appear configured — attempt JWKS reachability without inventing success */
    try {
      const cfgJwks = process.env.ARC_OIDC_JWKS_URL?.trim();
      if (!cfgJwks) {
        cases.push(
          caseResult("oidc.live", "oidc", "BLOCKED_NO_CREDENTIALS", "JWKS URL missing at run"),
        );
      } else {
        const res = await fetch(cfgJwks, {
          method: "GET",
          redirect: "error",
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) {
          cases.push(
            caseResult(
              "oidc.live",
              "oidc",
              "FAILED",
              `JWKS HTTP ${res.status}`,
            ),
          );
        } else {
          cases.push(
            caseResult(
              "oidc.live",
              "oidc",
              "VERIFIED_LIVE_TEST",
              "JWKS endpoint reachable under authorized test configuration",
            ),
          );
        }
      }
    } catch (e) {
      cases.push(
        caseResult(
          "oidc.live",
          "oidc",
          "FAILED",
          e instanceof Error ? e.message : "jwks_fetch_failed",
        ),
      );
    }
  }

  /* --- GitHub fixture --- */
  try {
    const repo = await githubAdapter.getRepository();
    cases.push(
      caseResult(
        "github.fixture.repository",
        "github",
        repo.source.includes("fixture") || repo.state === "UNVERIFIED"
          ? "VERIFIED_FIXTURE"
          : repo.state === "VERIFIED"
            ? "VERIFIED_LIVE_TEST"
            : "FAILED",
        `source=${repo.source} state=${repo.state}`,
      ),
    );
  } catch (e) {
    cases.push(
      caseResult(
        "github.fixture.repository",
        "github",
        "FAILED",
        e instanceof Error ? e.message : "github_fixture_error",
      ),
    );
  }

  const denied = await githubAdapter.getRepositoryFor("evil/not-allowed");
  cases.push(
    caseResult(
      "github.allowlist.deny",
      "github",
      denied.note === "repository_not_allowlisted" ? "VERIFIED_FIXTURE" : "FAILED",
      String(denied.note),
    ),
  );

  /* --- GitHub live (optional) --- */
  const ghLive = githubAdapter.liveStatus();
  if (ghLive.status === "fixture") {
    cases.push(
      caseResult(
        "github.live",
        "github",
        "VERIFIED_FIXTURE",
        "Live not requested — fixture only; not claimed as live",
      ),
    );
  } else if (ghLive.status === "BLOCKED" || !githubEnv.ok) {
    cases.push(
      caseResult(
        "github.live",
        "github",
        githubEnv.liveGate === "BLOCKED_NO_AUTHORIZATION"
          ? "BLOCKED_NO_AUTHORIZATION"
          : "BLOCKED_NO_CREDENTIALS",
        ghLive.reason,
      ),
    );
  } else {
    githubAdapter.setModeForTest("live");
    try {
      const liveRepo = await githubAdapter.getRepository();
      cases.push(
        caseResult(
          "github.live",
          "github",
          liveRepo.state === "VERIFIED" && liveRepo.source === "github-api"
            ? "VERIFIED_LIVE_TEST"
            : liveRepo.note === "rate_limited"
              ? "FAILED"
              : "FAILED",
          `state=${liveRepo.state} source=${liveRepo.source} note=${liveRepo.note ?? ""}`,
        ),
      );
    } finally {
      githubAdapter.setModeForTest("fixture");
    }
  }

  /* --- Safety gates --- */
  cases.push(
    caseResult(
      "safety.deployment_execute_permission",
      "safety",
      roleHasPermission("platform_owner", "deployment:execute") ||
        roleHasPermission("ai_agent", "deployment:execute")
        ? "FAILED"
        : "VERIFIED_FIXTURE",
      "deployment:execute never granted",
    ),
  );
  cases.push(
    caseResult(
      "safety.coolify_executeDeploy",
      "safety",
      coolifyAdapter.capabilities().executeDeploy === false
        ? "VERIFIED_FIXTURE"
        : "FAILED",
      "Coolify executeDeploy capability false",
    ),
  );
  cases.push(
    caseResult(
      "safety.ai_approval_permission",
      "safety",
      !roleHasPermission("ai_agent", "approval:decide") &&
        !roleHasPermission("ai_agent", "deployment:request")
        ? "VERIFIED_FIXTURE"
        : "FAILED",
      "AI agent lacks approval/deploy request",
    ),
  );

  const summary: Record<IntegrationGateResult, number> = {
    VERIFIED_FIXTURE: 0,
    VERIFIED_LIVE_TEST: 0,
    BLOCKED_NO_CREDENTIALS: 0,
    BLOCKED_NO_AUTHORIZATION: 0,
    FAILED: 0,
  };
  for (const c of cases) summary[c.result]++;

  return {
    phase: "2CG",
    deploymentExecutionEnabled: false,
    coolifyExecuteDeploy: false,
    cases,
    oidcEnv,
    githubEnv,
    envSnapshotRedacted: {
      ...redactEnvSnapshot([...OIDC_ENV_KEYS]),
      ...redactEnvSnapshot([...GITHUB_ENV_KEYS]),
    },
    summary,
  };
}

/** Harness must refuse to expose a deploy trigger */
export function harnessDeployTriggerAvailable(): boolean {
  return false;
}
