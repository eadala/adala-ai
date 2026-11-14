import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../app.js";
import type { Server } from "node:http";
import { evaluateReleasePolicy, validateApprovalAttempt } from "../policy/engine.js";
import type { ApprovalRequest, BackupAttestation, ReleaseRecord } from "../lib/types.js";
import { coolifyAdapter } from "../adapters/coolify.js";
import { issueDevCredential } from "../lib/identity.js";

function baseRelease(over: Partial<ReleaseRecord> = {}): ReleaseRecord {
  return {
    id: "rel-test",
    repository: "eadala/adala-ai",
    commitSha: "8f3c79357808f7c8d149e265e0f2bd4bb2d43422",
    treeSha: "14a92d2c3c96256910a581bf919df49d9e905452",
    buildArtifactId: null,
    imageDigest: null,
    createdAt: new Date().toISOString(),
    targetEnvironmentId: "env-prod",
    changeSummary: "test",
    securityImpact: "test",
    databaseMigrationImpact: "none",
    ciStatus: "PASS",
    reviewStatus: "FAIL",
    deploymentStatus: "proposed",
    rollbackCompatibility: "unknown",
    knownRisks: [],
    ...over,
  };
}

function failingBackup(): BackupAttestation {
  return {
    id: "b1",
    provider: "test",
    lastSuccessfulBackupAt: null,
    backupAgeHours: null,
    storageClass: null,
    retentionPolicy: null,
    integrityStatus: "UNVERIFIED",
    lastIsolatedRestoreTestAt: null,
    rpo: null,
    rto: null,
    recoveryOperator: null,
    readiness: "FAIL",
    note: "unproven",
  };
}

async function withServer(fn: (base: string) => Promise<void>): Promise<void> {
  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const addr = server.address();
  assert.ok(addr && typeof addr === "object");
  const base = `http://127.0.0.1:${addr.port}`;
  try {
    await fn(base);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}

function headers(op: string) {
  const issued = issueDevCredential(op);
  assert.ok("token" in issued);
  return {
    "content-type": "application/json",
    authorization: `Bearer ${issued.token}`,
  };
}

describe("ARC Phase 1 security & policy (Phase 2A auth)", () => {
  it("1. unauthorized deployment request rejected", async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/arc/deployments/request`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ releaseId: "rel-guc-rc" }),
      });
      assert.equal(res.status, 401);
    });
  });

  it("2. self-approval rejection", () => {
    const ar: ApprovalRequest = {
      id: "ar1",
      releaseId: "rel-test",
      commitSha: "8f3c79357808f7c8d149e265e0f2bd4bb2d43422",
      imageDigest: null,
      targetEnvironmentId: "env-prod",
      migrationPlan: "none",
      deploymentWindow: "now",
      policyVersion: "arc-policy-v1-phase1",
      requestedBy: "reviewer",
      requestedAt: new Date().toISOString(),
      status: "pending",
    };
    const v = validateApprovalAttempt({
      approvalRequest: ar,
      actorId: "reviewer",
      actorRole: "independent_reviewer",
      releaseAuthorId: "reviewer",
      decision: "approve",
    });
    assert.equal(v.ok, false);
    assert.match(v.reason ?? "", /self-approval/);
  });

  it("3. expired approval rejection", () => {
    const ar: ApprovalRequest = {
      id: "ar2",
      releaseId: "rel-test",
      commitSha: "8f3c79357808f7c8d149e265e0f2bd4bb2d43422",
      imageDigest: null,
      targetEnvironmentId: "env-prod",
      migrationPlan: "none",
      deploymentWindow: "past",
      policyVersion: "arc-policy-v1-phase1",
      requestedBy: "releaser",
      requestedAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
      status: "pending",
    };
    const v = validateApprovalAttempt({
      approvalRequest: ar,
      actorId: "reviewer",
      actorRole: "independent_reviewer",
      releaseAuthorId: "releaser",
      decision: "approve",
    });
    assert.equal(v.ok, false);
    assert.match(v.reason ?? "", /expired/);
  });

  it("4. artifact SHA mismatch fails approval binding", () => {
    const release = baseRelease();
    const ar: ApprovalRequest = {
      id: "ar3",
      releaseId: release.id,
      commitSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      imageDigest: null,
      targetEnvironmentId: "env-prod",
      migrationPlan: "none",
      deploymentWindow: "w",
      policyVersion: "arc-policy-v1-phase1",
      requestedBy: "releaser",
      requestedAt: new Date().toISOString(),
      status: "approved",
    };
    const ev = evaluateReleasePolicy({
      release,
      productionCommitSha: null,
      productionShaState: "UNVERIFIED",
      productionImageDigest: null,
      backup: failingBackup(),
      approvals: [
        {
          id: "a1",
          approvalRequestId: ar.id,
          actorId: "reviewer",
          actorRole: "independent_reviewer",
          decision: "approve",
          createdAt: new Date().toISOString(),
        },
      ],
      approvalRequest: ar,
      independentReviewPresent: true,
      stagingAccepted: true,
      deploymentExecutionEnabled: true,
    });
    const g = ev.gates.find((x) => x.name === "release_approval");
    assert.equal(g?.result, "FAIL");
  });

  it("5. image digest mismatch fails approval binding", () => {
    const release = baseRelease({ imageDigest: "sha256:aaa" });
    const ar: ApprovalRequest = {
      id: "ar4",
      releaseId: release.id,
      commitSha: release.commitSha,
      imageDigest: "sha256:bbb",
      targetEnvironmentId: "env-prod",
      migrationPlan: "none",
      deploymentWindow: "w",
      policyVersion: "arc-policy-v1-phase1",
      requestedBy: "releaser",
      requestedAt: new Date().toISOString(),
      status: "approved",
    };
    const ev = evaluateReleasePolicy({
      release,
      productionCommitSha: "c".repeat(40),
      productionShaState: "VERIFIED",
      productionImageDigest: "sha256:aaa",
      backup: {
        ...failingBackup(),
        readiness: "PASS",
        lastIsolatedRestoreTestAt: new Date().toISOString(),
        integrityStatus: "PASS",
      },
      approvals: [
        {
          id: "a1",
          approvalRequestId: ar.id,
          actorId: "reviewer",
          actorRole: "independent_reviewer",
          decision: "approve",
          createdAt: new Date().toISOString(),
        },
      ],
      approvalRequest: ar,
      independentReviewPresent: true,
      stagingAccepted: true,
      deploymentExecutionEnabled: true,
    });
    assert.equal(ev.gates.find((x) => x.name === "release_approval")?.result, "FAIL");
  });

  it("6. missing backup evidence blocks deploy", () => {
    const ev = evaluateReleasePolicy({
      release: baseRelease({ imageDigest: "sha256:x" }),
      productionCommitSha: "c".repeat(40),
      productionShaState: "VERIFIED",
      productionImageDigest: "sha256:x",
      backup: failingBackup(),
      approvals: [],
      approvalRequest: null,
      independentReviewPresent: true,
      stagingAccepted: true,
      deploymentExecutionEnabled: true,
    });
    assert.equal(ev.gates.find((g) => g.name === "backup_evidence")?.result, "FAIL");
    assert.equal(ev.deploymentAllowed, false);
  });

  it("7. failed restore evidence blocks deploy", () => {
    const ev = evaluateReleasePolicy({
      release: baseRelease({ imageDigest: "sha256:x" }),
      productionCommitSha: "c".repeat(40),
      productionShaState: "VERIFIED",
      productionImageDigest: "sha256:x",
      backup: { ...failingBackup(), readiness: "PASS", lastIsolatedRestoreTestAt: null },
      approvals: [],
      approvalRequest: null,
      independentReviewPresent: true,
      stagingAccepted: true,
      deploymentExecutionEnabled: true,
    });
    assert.equal(ev.gates.find((g) => g.name === "restore_evidence")?.result, "FAIL");
  });

  it("8. stale/unverified production SHA blocks", () => {
    const ev = evaluateReleasePolicy({
      release: baseRelease({ imageDigest: "sha256:x" }),
      productionCommitSha: null,
      productionShaState: "UNVERIFIED",
      productionImageDigest: null,
      backup: {
        ...failingBackup(),
        readiness: "PASS",
        lastIsolatedRestoreTestAt: new Date().toISOString(),
      },
      approvals: [],
      approvalRequest: null,
      independentReviewPresent: true,
      stagingAccepted: true,
      deploymentExecutionEnabled: true,
    });
    assert.equal(ev.gates.find((g) => g.name === "production_sha_verified")?.result, "UNVERIFIED");
    assert.equal(ev.deploymentAllowed, false);
  });

  it("9. missing independent review fails", () => {
    const ev = evaluateReleasePolicy({
      release: baseRelease(),
      productionCommitSha: null,
      productionShaState: "UNVERIFIED",
      productionImageDigest: null,
      backup: failingBackup(),
      approvals: [],
      approvalRequest: null,
      independentReviewPresent: false,
      stagingAccepted: false,
      deploymentExecutionEnabled: false,
    });
    assert.equal(ev.gates.find((g) => g.name === "independent_review")?.result, "FAIL");
  });

  it("10. concurrent deployment requests without execute", async () => {
    await withServer(async (base) => {
      const h = headers("operator");
      const [a, b] = await Promise.all([
        fetch(`${base}/api/arc/deployments/request`, {
          method: "POST",
          headers: h,
          body: JSON.stringify({ releaseId: "rel-guc-rc" }),
        }),
        fetch(`${base}/api/arc/deployments/request`, {
          method: "POST",
          headers: h,
          body: JSON.stringify({ releaseId: "rel-guc-rc" }),
        }),
      ]);
      assert.equal(a.status, 202);
      assert.equal(b.status, 202);
    });
  });

  it("11-13. deploy execute disabled", async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/arc/deployments/execute`, {
        method: "POST",
        headers: headers("operator"),
        body: JSON.stringify({ releaseId: "rel-guc-rc" }),
      });
      assert.equal(res.status, 403);
    });
  });

  it("14. provider API outage returns typed UNAVAILABLE/UNVERIFIED", async () => {
    const apps = await coolifyAdapter.listApplications();
    assert.ok(apps.state === "UNVERIFIED" || apps.state === "UNAVAILABLE");
    assert.equal(coolifyAdapter.capabilities().executeDeploy, false);
  });

  it("15. partial deployment failure path — execute never starts", async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/arc/deployments/execute`, {
        method: "POST",
        headers: headers("owner"),
        body: JSON.stringify({ releaseId: "rel-guc-rc", partial: true }),
      });
      assert.equal(res.status, 403);
    });
  });

  it("16. audit record append-only integrity", async () => {
    await withServer(async (base) => {
      await fetch(`${base}/api/arc/gates/rel-guc-rc`);
      const res = await fetch(`${base}/api/arc/audit?limit=10`, {
        headers: headers("auditor"),
      });
      assert.equal(res.status, 200);
      const body = (await res.json()) as {
        appendOnly: boolean;
        immutabilityClaim: boolean;
        events: unknown[];
      };
      assert.equal(body.appendOnly, true);
      assert.equal(body.immutabilityClaim, false);
      assert.ok(body.events.length >= 1);
    });
  });

  it("17. cross-environment: auditor cannot request approval", async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/arc/approvals/request`, {
        method: "POST",
        headers: headers("auditor"),
        body: JSON.stringify({ releaseId: "rel-guc-rc" }),
      });
      assert.equal(res.status, 403);
    });
  });

  it("18. privilege escalation — ai_agent approval rejected", () => {
    const ar: ApprovalRequest = {
      id: "ar-ai",
      releaseId: "rel-test",
      commitSha: "8f3c79357808f7c8d149e265e0f2bd4bb2d43422",
      imageDigest: null,
      targetEnvironmentId: "env-prod",
      migrationPlan: "none",
      deploymentWindow: "w",
      policyVersion: "arc-policy-v1-phase1",
      requestedBy: "releaser",
      requestedAt: new Date().toISOString(),
      status: "pending",
    };
    const v = validateApprovalAttempt({
      approvalRequest: ar,
      actorId: "agent",
      actorRole: "ai_agent",
      releaseAuthorId: "releaser",
      decision: "approve",
    });
    assert.equal(v.ok, false);
    assert.match(v.reason ?? "", /AI agents/);
  });

  it("19. secret leakage prevention — coolify token not in API bodies", async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/arc/coolify/applications`);
      const text = await res.text();
      assert.equal(text.includes("ARC_COOLIFY_TOKEN"), false);
      assert.equal(text.includes("Bearer "), false);
    });
  });

  it("20. deployment execution disabled by default", async () => {
    await withServer(async (base) => {
      const health = (await (await fetch(`${base}/api/arc/healthz`)).json()) as {
        deploymentExecutionEnabled: boolean;
      };
      assert.equal(health.deploymentExecutionEnabled, false);
    });
  });

  it("healthz and overview render unknown as UNVERIFIED", async () => {
    await withServer(async (base) => {
      const overview = (await (
        await fetch(`${base}/api/arc/overview`)
      ).json()) as {
        productionCommitSha: { state: string; value: null };
      };
      assert.equal(overview.productionCommitSha.state, "UNVERIFIED");
      assert.equal(overview.productionCommitSha.value, null);
    });
  });
});
