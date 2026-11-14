import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import { createApp } from "../app.js";
import {
  issueDevCredential,
  issueExpiredDevCredential,
  verifyBearerCredential,
} from "../lib/identity.js";
import {
  issueFixtureAccessToken,
  issueExpiredFixtureToken,
  issueWrongIssuerToken,
  ensureFixtureKeys,
} from "../lib/oidc.js";
import { roleHasPermission } from "../lib/permissions.js";
import { ArcStore } from "../lib/store.js";
import { DurableAuditStore, redactSecrets } from "../lib/auditStore.js";
import { coolifyAdapter } from "../adapters/coolify.js";
import { githubAdapter } from "../adapters/github.js";
import { assertAllowedUrl, coolifyAllowedOrigins } from "../adapters/httpSafe.js";
import {
  approvalStillValid,
  evaluateEvidenceSet,
  makeEvidence,
} from "../lib/evidence.js";
import { classifyObservation, resultFromProbe } from "../lib/monitoring.js";
import { validateApprovalAttempt } from "../policy/engine.js";
import { SignJWT } from "jose";

async function listen(): Promise<{ server: Server; base: string }> {
  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const addr = server.address();
  assert.ok(addr && typeof addr === "object");
  return { server, base: `http://127.0.0.1:${addr.port}` };
}

function hmacBearer(operatorId: string): Record<string, string> {
  const issued = issueDevCredential(operatorId);
  assert.ok("token" in issued);
  return {
    authorization: `Bearer ${issued.token}`,
    "content-type": "application/json",
  };
}

describe("ARC Phase 2B trusted control plane", () => {
  let server: Server;
  let base: string;

  before(async () => {
    await ensureFixtureKeys();
    ({ server, base } = await listen());
  });
  after(async () => {
    await new Promise<void>((r) => server.close(() => r()));
  });

  it("OIDC: missing identity → 401", async () => {
    const res = await fetch(`${base}/api/arc/deployments/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(res.status, 401);
  });

  it("OIDC: valid fixture JWT authenticates", async () => {
    const token = await issueFixtureAccessToken("auditor");
    const res = await fetch(`${base}/api/arc/audit`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 200);
  });

  it("OIDC: expired token → 401", async () => {
    const token = await issueExpiredFixtureToken("owner");
    const r = await verifyBearerCredential(`Bearer ${token}`, {});
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "expired");
  });

  it("OIDC: wrong issuer → rejected", async () => {
    const token = await issueWrongIssuerToken("owner");
    const r = await verifyBearerCredential(`Bearer ${token}`, {});
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "wrong_issuer");
  });

  it("OIDC: wrong audience → rejected", async () => {
    const prev = process.env.ARC_OIDC_AUDIENCE;
    process.env.ARC_OIDC_AUDIENCE = "other-aud";
    let minted: string;
    try {
      minted = await issueFixtureAccessToken("owner");
    } finally {
      if (prev === undefined) delete process.env.ARC_OIDC_AUDIENCE;
      else process.env.ARC_OIDC_AUDIENCE = prev;
    }
    const r = await verifyBearerCredential(`Bearer ${minted}`, {});
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "wrong_audience");
  });

  it("OIDC: unsupported algorithm rejected", async () => {
    const secret = new TextEncoder().encode("a".repeat(32));
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("oidc|owner")
      .setIssuer("https://arc.local/oidc")
      .setAudience("adalah-arc")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(secret);
    const r = await verifyBearerCredential(`Bearer ${token}`, {});
    assert.equal(r.ok, false);
  });

  it("forged role header still rejected with OIDC", async () => {
    const token = await issueFixtureAccessToken("auditor");
    const res = await fetch(`${base}/api/arc/deployments/execute`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "x-arc-role": "platform_owner",
        "content-type": "application/json",
      },
      body: "{}",
    });
    assert.equal(res.status, 403);
  });

  it("AI agent privilege escalation blocked", async () => {
    const token = await issueFixtureAccessToken("agent");
    for (const path of ["/deployments/request", "/approvals/x/decide", "/policy", "/roles"]) {
      const res = await fetch(`${base}/api/arc${path}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: "{}",
      });
      assert.equal(res.status, 403, path);
    }
  });

  it("HMAC expired still rejected", async () => {
    const token = issueExpiredDevCredential("operator");
    const r = await verifyBearerCredential(`Bearer ${token}`, {});
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "expired");
  });

  it("audit: durable persistence + chain verify", () => {
    const dir = mkdtempSync(join(tmpdir(), "arc-2b-audit-"));
    const db = join(dir, "a.sqlite");
    const s = new DurableAuditStore(db);
    s.append({
      actorId: "t",
      action: "test.write",
      resource: "r",
      requestCorrelationId: "c1",
      outcome: "ok",
    });
    s.append({
      actorId: "t",
      action: "test.write2",
      resource: "r",
      requestCorrelationId: "c2",
      outcome: "ok",
    });
    assert.equal(s.verifyChain().ok, true);
    s.close();
    const s2 = new DurableAuditStore(db);
    assert.equal(s2.verifyChain().ok, true);
    assert.ok(s2.list(10).length >= 2);
    s2.close();
  });

  it("audit: concurrent writes keep sequence", async () => {
    const dir = mkdtempSync(join(tmpdir(), "arc-2b-conc-"));
    const s = new DurableAuditStore(join(dir, "c.sqlite"));
    const jobs = Array.from({ length: 20 }, (_, i) =>
      Promise.resolve().then(() =>
        s.append({
          actorId: "c",
          action: "conc",
          resource: `r${i}`,
          requestCorrelationId: `c${i}`,
          outcome: "ok",
        }),
      ),
    );
    await Promise.all(jobs);
    assert.equal(s.verifyChain().ok, true);
    assert.equal(s.list(100).length, 20);
    s.close();
  });

  it("audit: unauthorized update rejected", () => {
    const dir = mkdtempSync(join(tmpdir(), "arc-2b-upd-"));
    const s = new DurableAuditStore(join(dir, "u.sqlite"));
    const ev = s.append({
      actorId: "t",
      action: "x",
      resource: "r",
      requestCorrelationId: "c",
      outcome: "ok",
    });
    const r = s.trySqlUpdate(ev.id);
    assert.equal(r.rejected, true);
    assert.throws(() => s.attemptUpdate());
    s.close();
  });

  it("audit: secret redaction", () => {
    const red = redactSecrets({
      authorization: "Bearer supersecret",
      nested: { apiKey: "sk-abc", ok: "fine" },
    }) as Record<string, unknown>;
    assert.equal(red.authorization, "[REDACTED]");
    assert.equal((red.nested as { apiKey: string }).apiKey, "[REDACTED]");
    assert.equal((red.nested as { ok: string }).ok, "fine");
  });

  it("audit: ArcStore JSONL + sqlite restart", () => {
    const dir = mkdtempSync(join(tmpdir(), "arc-2b-store-"));
    const jsonl = join(dir, "audit.jsonl");
    const s1 = new ArcStore(jsonl);
    s1.appendAudit({
      actor: "test",
      action: "persist.check",
      target: "t",
      requestId: "r1",
      previousState: null,
      newState: "ok",
      evidenceReference: null,
    });
    assert.equal(s1.verifyAuditIntegrity().ok, true);
    const s2 = new ArcStore(jsonl);
    assert.ok(s2.getAuditSnapshot().some((e) => e.action === "persist.check"));
    assert.equal(s2.verifyAuditIntegrity().ok, true);
  });

  it("GitHub SSRF blocked", async () => {
    const r = await githubAdapter.probeUrl("http://169.254.169.254/latest/meta-data/");
    assert.equal(r.allowed, false);
  });

  it("Coolify SSRF blocked for user URL", async () => {
    const r = await coolifyAdapter.probeUserUrl("https://evil.example/steal");
    assert.equal(r.allowed, false);
    const meta = assertAllowedUrl(
      "http://169.254.169.254/",
      coolifyAllowedOrigins(),
    );
    assert.equal(meta.ok, false);
  });

  it("Coolify fixture modes", async () => {
    const prev = coolifyAdapter.fixtureMode;
    try {
      coolifyAdapter.fixtureMode = "timeout";
      const t = await coolifyAdapter.listApplications();
      assert.equal(t.note, "timeout");
      coolifyAdapter.fixtureMode = "auth_failure";
      assert.equal((await coolifyAdapter.listApplications()).note, "authentication_failure");
      coolifyAdapter.fixtureMode = "malformed";
      assert.equal((await coolifyAdapter.listApplications()).state, "FAILED");
      coolifyAdapter.fixtureMode = "permission_failure";
      assert.equal((await coolifyAdapter.listApplications()).note, "permission_denied");
      coolifyAdapter.fixtureMode = "rate_limit";
      assert.equal((await coolifyAdapter.listApplications()).state, "DEGRADED");
    } finally {
      coolifyAdapter.fixtureMode = prev;
    }
  });

  it("Coolify mutation forbidden", async () => {
    await assert.rejects(() => coolifyAdapter.executeDeploy(), /mutation_forbidden/);
    assert.equal(coolifyAdapter.capabilities().executeDeploy, false);
  });

  it("evidence: missing mandatory blocks", () => {
    const subject = {
      repository: "eadala/adala-ai",
      commitSha: "a".repeat(40),
      treeSha: "b".repeat(40),
      artifactDigest: null,
      targetEnvironment: "env-prod",
      policyVersion: "arc-policy-v2-phase2b",
    };
    const records = [
      makeEvidence({
        evidenceType: "source_integrity",
        source: "t",
        subjectIdentity: subject,
        verificationMethod: "sha",
        observationTime: new Date().toISOString(),
        expirationTime: null,
        verificationResult: "PASS",
        failureReason: null,
      }),
    ];
    const ev = evaluateEvidenceSet(records, ["source_integrity", "human_review"]);
    assert.equal(ev.overall, "BLOCKED");
    assert.ok(ev.missing.includes("human_review"));
  });

  it("evidence: artifact mismatch invalidates approval", () => {
    const bound = {
      repository: "eadala/adala-ai",
      commitSha: "a".repeat(40),
      treeSha: "b".repeat(40),
      artifactDigest: "sha256:1",
      targetEnvironment: "env-prod",
      policyVersion: "arc-policy-v2-phase2b",
    };
    const cur = { ...bound, artifactDigest: "sha256:2" };
    const r = approvalStillValid({
      bound,
      current: cur,
      evidenceExpired: false,
      reviewerRevoked: false,
    });
    assert.equal(r.valid, false);
    assert.equal(r.reason, "artifact_digest_changed");
  });

  it("approval: platform_owner cannot bypass independent review", () => {
    const ar = {
      id: "ar1",
      releaseId: "r",
      commitSha: "a".repeat(40),
      imageDigest: null,
      targetEnvironmentId: "env-prod",
      migrationPlan: "n",
      deploymentWindow: "u",
      policyVersion: "arc-policy-v2-phase2b",
      requestedBy: "releaser",
      requestedAt: new Date().toISOString(),
      status: "pending" as const,
    };
    const v = validateApprovalAttempt({
      approvalRequest: ar,
      actorId: "owner",
      actorRole: "platform_owner",
      releaseAuthorId: "releaser",
      decision: "approve",
    });
    assert.equal(v.ok, false);
  });

  it("approval: AI cannot approve", () => {
    const ar = {
      id: "ar1",
      releaseId: "r",
      commitSha: "a".repeat(40),
      imageDigest: null,
      targetEnvironmentId: "env-prod",
      migrationPlan: "n",
      deploymentWindow: "u",
      policyVersion: "arc-policy-v2-phase2b",
      requestedBy: "releaser",
      requestedAt: new Date().toISOString(),
      status: "pending" as const,
    };
    const v = validateApprovalAttempt({
      approvalRequest: ar,
      actorId: "agent",
      actorRole: "ai_agent",
      releaseAuthorId: "releaser",
      decision: "approve",
    });
    assert.equal(v.ok, false);
  });

  it("monitoring: timeout is never healthy", () => {
    assert.equal(resultFromProbe({ timedOut: true }), "unknown");
    const stale = classifyObservation({
      id: "m1",
      metric: "api",
      value: "ok",
      state: "VERIFIED",
      source: "t",
      observedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    });
    assert.equal(stale.result, "stale");
  });

  it("deployment isolation: webhook/job/internal denied", async () => {
    const wh = await fetch(`${base}/api/arc/webhooks/deploy`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(wh.status, 403);
    const job = await fetch(`${base}/api/arc/jobs/deploy`, {
      method: "POST",
      headers: hmacBearer("owner"),
      body: "{}",
    });
    assert.equal(job.status, 403);
    const internal = await fetch(`${base}/api/arc/internal/execute-deploy`, {
      method: "POST",
      headers: hmacBearer("owner"),
      body: "{}",
    });
    assert.equal(internal.status, 403);
  });

  it("deployment:execute still never granted", () => {
    for (const role of [
      "platform_owner",
      "release_manager",
      "independent_reviewer",
      "production_operator",
      "read_only_auditor",
      "ai_agent",
    ] as const) {
      assert.equal(roleHasPermission(role, "deployment:execute"), false);
    }
  });

  it("healthz reports deploy disabled (phase header advances with program)", async () => {
    const res = await fetch(`${base}/api/arc/healthz`);
    const body = (await res.json()) as {
      phase: string;
      deploymentExecutionEnabled: boolean;
      liveOidc: string;
    };
    assert.ok(["2B", "2C1"].includes(body.phase));
    assert.equal(body.deploymentExecutionEnabled, false);
    assert.ok(["UNVERIFIED", "BLOCKED", "CONFIGURED"].includes(body.liveOidc));
  });

  it("evidence API returns blocked when incomplete", async () => {
    const res = await fetch(`${base}/api/arc/evidence/rel-guc-rc`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { evaluation: { overall: string } };
    assert.equal(body.evaluation.overall, "BLOCKED");
  });
});
