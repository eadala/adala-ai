import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import { SignJWT } from "jose";
import { createApp } from "../app.js";
import { issueDevCredential } from "../lib/identity.js";
import {
  clearRevocations,
  dropFixtureKid,
  ensureFixtureKeys,
  issueExpiredFixtureToken,
  issueFixtureAccessToken,
  issueWrongIssuerToken,
  liveOidcStatus,
  revokeOperator,
  rotateFixtureJwks,
  verifyOidcBearer,
} from "../lib/oidc.js";
import { DurableAuditStore, redactSecrets } from "../lib/auditStore.js";
import { githubAdapter } from "../adapters/github.js";
import { classifyReleaseFacts } from "../lib/evidence.js";
import { roleHasPermission } from "../lib/permissions.js";

async function listen(): Promise<{ server: Server; base: string }> {
  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const addr = server.address();
  assert.ok(addr && typeof addr === "object");
  return { server, base: `http://127.0.0.1:${addr.port}` };
}

describe("ARC Phase 2C-1 identity & GitHub validation", () => {
  let server: Server;
  let base: string;

  before(async () => {
    await ensureFixtureKeys();
    ({ server, base } = await listen());
  });
  after(async () => {
    await new Promise<void>((r) => server.close(() => r()));
  });
  beforeEach(() => {
    clearRevocations();
    githubAdapter.simulateRateLimit = false;
    githubAdapter.simulateTimeout = false;
    delete process.env.ARC_OIDC_REQUIRE_MFA;
    delete process.env.ARC_OIDC_OPERATOR_ALLOWLIST;
  });

  it("live OIDC status BLOCKED without authorized IdP", () => {
    const prev = process.env.ARC_OIDC_MODE;
    process.env.ARC_OIDC_MODE = "live";
    delete process.env.ARC_OIDC_JWKS_URL;
    try {
      const s = liveOidcStatus();
      assert.equal(s.status, "BLOCKED");
    } finally {
      if (prev === undefined) delete process.env.ARC_OIDC_MODE;
      else process.env.ARC_OIDC_MODE = prev;
    }
  });

  it("invalid OIDC issuer rejected", async () => {
    const t = await issueWrongIssuerToken("owner");
    const r = await verifyOidcBearer(`Bearer ${t}`);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "wrong_issuer");
  });

  it("invalid OIDC audience rejected", async () => {
    const prev = process.env.ARC_OIDC_AUDIENCE;
    process.env.ARC_OIDC_AUDIENCE = "other-aud";
    let minted: string;
    try {
      minted = await issueFixtureAccessToken("owner");
    } finally {
      if (prev === undefined) delete process.env.ARC_OIDC_AUDIENCE;
      else process.env.ARC_OIDC_AUDIENCE = prev;
    }
    const r = await verifyOidcBearer(`Bearer ${minted}`);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "wrong_audience");
  });

  it("expired token rejected", async () => {
    const t = await issueExpiredFixtureToken("owner");
    const r = await verifyOidcBearer(`Bearer ${t}`);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "expired");
  });

  it("invalid signature rejected", async () => {
    const t = await issueFixtureAccessToken("owner");
    const bad = `${t.slice(0, -8)}AAAAAAAA`;
    const r = await verifyOidcBearer(`Bearer ${bad}`);
    assert.equal(r.ok, false);
  });

  it("JWKS rotation: old kid verifies until dropped; unknown kid fails", async () => {
    const before = await issueFixtureAccessToken("auditor");
    const { previousKid, activeKid } = await rotateFixtureJwks("arc-fixture-rotated");
    assert.notEqual(previousKid, activeKid);
    const oldOk = await verifyOidcBearer(`Bearer ${before}`);
    assert.equal(oldOk.ok, true);
    const after = await issueFixtureAccessToken("auditor");
    assert.equal((await verifyOidcBearer(`Bearer ${after}`)).ok, true);
    dropFixtureKid(previousKid);
    const dropped = await verifyOidcBearer(`Bearer ${before}`);
    assert.equal(dropped.ok, false);
    if (!dropped.ok) assert.equal(dropped.reason, "unknown_kid");
  });

  it("revoked operator rejected", async () => {
    const t = await issueFixtureAccessToken("owner");
    revokeOperator("owner");
    const r = await verifyOidcBearer(`Bearer ${t}`);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "revoked");
  });

  it("operator allowlist enforced", async () => {
    process.env.ARC_OIDC_OPERATOR_ALLOWLIST = "oidc|auditor";
    const denied = await verifyOidcBearer(
      `Bearer ${await issueFixtureAccessToken("owner")}`,
    );
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.equal(denied.reason, "not_allowlisted");
    const ok = await verifyOidcBearer(
      `Bearer ${await issueFixtureAccessToken("auditor")}`,
    );
    assert.equal(ok.ok, true);
  });

  it("MFA enforcement design: require ACR when enabled", async () => {
    process.env.ARC_OIDC_REQUIRE_MFA = "true";
    const noMfa = await verifyOidcBearer(
      `Bearer ${await issueFixtureAccessToken("owner")}`,
    );
    assert.equal(noMfa.ok, false);
    if (!noMfa.ok) assert.equal(noMfa.reason, "mfa_required");
    const withMfa = await verifyOidcBearer(
      `Bearer ${await issueFixtureAccessToken("owner", {
        acr: "urn:adalah:acr:mfa",
        amr: ["mfa", "pwd"],
      })}`,
    );
    assert.equal(withMfa.ok, true);
  });

  it("forged roles still rejected", async () => {
    const t = await issueFixtureAccessToken("auditor");
    const res = await fetch(`${base}/api/arc/deployments/execute`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${t}`,
        "x-arc-role": "platform_owner",
        "content-type": "application/json",
      },
      body: "{}",
    });
    assert.equal(res.status, 403);
  });

  it("AI agent privilege escalation blocked", async () => {
    const t = await issueFixtureAccessToken("agent");
    const res = await fetch(`${base}/api/arc/deployments/request`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${t}`,
        "content-type": "application/json",
      },
      body: "{}",
    });
    assert.equal(res.status, 403);
  });

  it("unauthorized repository access denied", async () => {
    const r = await githubAdapter.getRepositoryFor("evil/not-allowed");
    assert.equal(r.state, "UNAVAILABLE");
    assert.equal(r.note, "repository_not_allowlisted");
  });

  it("GitHub token leakage prevented in sanitize/redact", () => {
    const red = githubAdapter.sanitizeForLog({
      authorization: "Bearer ghp_SUPERSECRETTOKEN",
      body: "ok",
    }) as Record<string, unknown>;
    assert.equal(red.authorization, "[REDACTED]");
    assert.equal(red.body, "ok");
    assert.equal(
      redactSecrets("Authorization: Bearer ghp_abc123xyz"),
      "Authorization: Bearer [REDACTED]",
    );
  });

  it("GitHub provider timeout simulated", async () => {
    githubAdapter.simulateTimeout = true;
    githubAdapter.setModeForTest("live");
    const r = await githubAdapter.getRepository();
    assert.equal(r.note, "timeout");
    assert.equal(r.state, "UNAVAILABLE");
    githubAdapter.setModeForTest("fixture");
  });

  it("GitHub API rate limiting simulated", async () => {
    githubAdapter.simulateRateLimit = true;
    githubAdapter.setModeForTest("live");
    const r = await githubAdapter.getRepository();
    assert.equal(r.note, "rate_limited");
    assert.equal(r.state, "DEGRADED");
    githubAdapter.setModeForTest("fixture");
  });

  it("live GitHub BLOCKED without token", () => {
    const prev = process.env.ARC_GITHUB_MODE;
    process.env.ARC_GITHUB_MODE = "live";
    delete process.env.ARC_GITHUB_TOKEN;
    try {
      githubAdapter.setModeForTest("live");
      assert.equal(githubAdapter.liveStatus().status, "BLOCKED");
    } finally {
      githubAdapter.setModeForTest("fixture");
      if (prev === undefined) delete process.env.ARC_GITHUB_MODE;
      else process.env.ARC_GITHUB_MODE = prev;
    }
  });

  it("stale release evidence expires / blocks", () => {
    const facts = classifyReleaseFacts({
      commitSha: "a".repeat(40),
      treeSha: "b".repeat(40),
      workflowSuccess: true,
      humanReviewComplete: null,
      imageDigest: null,
      productionCommitSha: null,
      productionShaVerified: false,
    });
    assert.equal(facts.ci_workflow.state, "PASS");
    assert.equal(facts.human_review.state, "NOT_RUN");
    assert.equal(facts.container_digest.state, "UNVERIFIED");
    assert.equal(facts.deployed_production_identity.state, "UNVERIFIED");
    assert.match(facts.deployed_production_identity.note, /not be inferred from GitHub/);
  });

  it("GitHub must not imply deployed production identity", () => {
    const obs = githubAdapter.productionDeployedIdentityFromGithub();
    assert.equal(obs.state, "UNVERIFIED");
    assert.equal(obs.value?.commitSha, null);
  });

  it("pagination metadata present on PR list", async () => {
    const r = await githubAdapter.listOpenPullRequests(1);
    assert.equal(r.page, 1);
    assert.ok(r.pageSize > 0 && r.pageSize <= 50);
  });

  it("cache freshness meta included", async () => {
    const repo = await githubAdapter.getRepository();
    const meta = githubAdapter.withMeta(repo, "repos/eadala/adala-ai", null, Date.now() - 5000);
    assert.ok(meta.meta.cacheAgeMs >= 4000);
    assert.equal(meta.meta.verificationStatus, "UNVERIFIED");
  });

  it("deployment execution denial remains", async () => {
    const issued = issueDevCredential("owner");
    assert.ok("token" in issued);
    const res = await fetch(`${base}/api/arc/deployments/execute`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${issued.token}`,
        "content-type": "application/json",
      },
      body: "{}",
    });
    assert.equal(res.status, 403);
    assert.equal(roleHasPermission("platform_owner", "deployment:execute"), false);
  });

  it("audit integrity + denial logging + redaction", async () => {
    const dir = mkdtempSync(join(tmpdir(), "arc-2c1-"));
    const s = new DurableAuditStore(join(dir, "a.sqlite"));
    s.append({
      actorId: "anonymous",
      action: "authz.denied",
      resource: "/deployments/execute",
      requestCorrelationId: "c1",
      outcome: "denied",
      metadata: { authorization: "Bearer secret-token", reason: "forbidden" },
    });
    assert.equal(s.verifyChain().ok, true);
    const ev = s.list(1)[0]!;
    assert.match(ev.metadataSanitized, /REDACTED/);
    assert.doesNotMatch(ev.metadataSanitized, /secret-token/);
    s.close();
    const s2 = new DurableAuditStore(join(dir, "a.sqlite"));
    assert.equal(s2.verifyChain().ok, true);
    s2.close();
  });

  it("healthz reports 2C1 and Coolify not connected", async () => {
    const res = await fetch(`${base}/api/arc/healthz`);
    const body = (await res.json()) as {
      phase: string;
      deploymentExecutionEnabled: boolean;
      coolifyProduction: string;
      liveOidc: string;
      liveGithub: string;
    };
    assert.equal(body.phase, "2C1");
    assert.equal(body.deploymentExecutionEnabled, false);
    assert.equal(body.coolifyProduction, "NOT_CONNECTED");
    assert.equal(body.liveOidc, "UNVERIFIED");
    assert.equal(body.liveGithub, "UNVERIFIED");
  });

  it("unsupported alg still rejected", async () => {
    const secret = new TextEncoder().encode("a".repeat(32));
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("oidc|owner")
      .setIssuer("https://arc.local/oidc")
      .setAudience("adalah-arc")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(secret);
    const r = await verifyOidcBearer(`Bearer ${token}`);
    assert.equal(r.ok, false);
  });

  it("evidence API exposes distinct facts and UNVERIFIED deploy identity", async () => {
    const res = await fetch(`${base}/api/arc/evidence/rel-guc-rc`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      distinctFacts: { deployed_production_identity: { state: string } };
      deployedProductionIdentity: { state: string };
    };
    assert.equal(body.distinctFacts.deployed_production_identity.state, "UNVERIFIED");
    assert.equal(body.deployedProductionIdentity.state, "UNVERIFIED");
  });
});
