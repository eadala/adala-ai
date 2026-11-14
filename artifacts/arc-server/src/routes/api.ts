import { Router } from "express";
import { randomUUID } from "node:crypto";
import { store } from "../lib/store.js";
import { asAuthed, requireAuth, requirePermission } from "../lib/auth.js";
import { coolifyAdapter } from "../adapters/coolify.js";
import { githubAdapter } from "../adapters/github.js";
import {
  evaluateReleasePolicy,
  validateApprovalAttempt,
  POLICY_VERSION,
} from "../policy/engine.js";
import { issueDevCredential, isProductionConfig } from "../lib/identity.js";
import type { Approval, ApprovalRequest } from "../lib/types.js";

export const apiRouter = Router();

/** Permanent Phase 2A: execution disabled regardless of env */
const DEPLOY_EXECUTION_ENABLED = false;

apiRouter.get("/healthz", (_req, res) => {
  res.json({
    ok: true,
    service: "arc-server",
    phase: "2A",
    deploymentExecutionEnabled: DEPLOY_EXECUTION_ENABLED,
    policyVersion: POLICY_VERSION,
    productionConfig: isProductionConfig(),
    ts: new Date().toISOString(),
  });
});

/** Local/test credential issuer — blocked when ARC_ENV=production */
apiRouter.post("/dev/issue-token", (req, res) => {
  if (isProductionConfig()) {
    res.status(403).json({
      error: "forbidden",
      reason: "production_blocks_dev_issuer",
      message: "Development identity issuer disabled in production configuration",
    });
    return;
  }
  const operatorId = String(req.body?.operatorId ?? "");
  const issued = issueDevCredential(operatorId, { allowAiAgent: true });
  if ("error" in issued) {
    res.status(400).json({ error: issued.error });
    return;
  }
  store.appendAudit({
    actor: "dev-issuer",
    action: "identity.issue_dev_credential",
    target: operatorId,
    requestId: asAuthed(req).requestId,
    previousState: null,
    newState: "issued",
    evidenceReference: null,
  });
  res.status(201).json({
    tokenType: "Bearer",
    accessToken: issued.token,
    note: "Role is server-bound; do not send X-ARC-Role",
  });
});

apiRouter.get("/overview", async (_req, res) => {
  const coolify = await coolifyAdapter.getApplication("coolify-app-adala-mock");
  const app = store.applications[0];
  const env = store.environments.find((e) => e.id === app?.environmentId);
  res.json({
    application: app,
    environment: env,
    coolify,
    productionCommitSha: {
      value: null,
      state: "UNVERIFIED",
      source: "coolify-adapter",
      observedAt: new Date().toISOString(),
      note: "Never display inferred SHA as verified",
    },
    productionImageDigest: {
      value: null,
      state: "UNVERIFIED",
      source: "coolify-adapter",
      observedAt: new Date().toISOString(),
    },
    monitoring: store.monitoring,
    incidentsOpen: store.incidents.filter((i) => i.status !== "resolved"),
    backup: store.backupAttestations[0],
    capabilities: coolifyAdapter.capabilities(),
  });
});

apiRouter.get("/environments", (_req, res) => {
  res.json({ environments: store.environments });
});

apiRouter.get("/applications", (_req, res) => {
  res.json({ applications: store.applications });
});

apiRouter.get("/releases", (_req, res) => {
  res.json({ releases: store.releases });
});

apiRouter.get("/releases/:id", (req, res) => {
  const rel = store.releases.find((r) => r.id === req.params.id);
  if (!rel) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json({ release: rel });
});

apiRouter.get("/releases/compare/:a/:b", (req, res) => {
  const left = store.releases.find((r) => r.id === req.params.a);
  const right = store.releases.find((r) => r.id === req.params.b);
  if (!left || !right) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json({
    left,
    right,
    comparison: {
      commitChanged: left.commitSha !== right.commitSha,
      treeChanged: left.treeSha !== right.treeSha,
      securityDelta: { from: left.securityImpact, to: right.securityImpact },
      databaseDelta: {
        from: left.databaseMigrationImpact,
        to: right.databaseMigrationImpact,
      },
      knownRisksAdded: right.knownRisks.filter((k) => !left.knownRisks.includes(k)),
      knownRisksRemoved: left.knownRisks.filter((k) => !right.knownRisks.includes(k)),
      imageDigestLeft: left.imageDigest,
      imageDigestRight: right.imageDigest,
      note: "Comparison uses immutable SHAs/trees — not mutable branch tips",
    },
  });
});

apiRouter.get("/gates/:releaseId", (req, res) => {
  const release = store.releases.find((r) => r.id === req.params.releaseId);
  if (!release) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const ar =
    store.approvalRequests
      .filter((a) => a.releaseId === release.id)
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))[0] ?? null;
  const approvals = ar
    ? store.approvals.filter((a) => a.approvalRequestId === ar.id)
    : [];
  const independentReviewPresent = approvals.some(
    (a) => a.decision === "approve" && a.actorRole === "independent_reviewer",
  );
  const evaluation = evaluateReleasePolicy({
    release,
    productionCommitSha: null,
    productionShaState: "UNVERIFIED",
    productionImageDigest: null,
    backup: store.backupAttestations[0]!,
    approvals,
    approvalRequest: ar,
    independentReviewPresent,
    stagingAccepted: false,
    deploymentExecutionEnabled: DEPLOY_EXECUTION_ENABLED,
  });
  store.appendAudit({
    actor: asAuthed(req).operator?.id ?? "anonymous",
    action: "gate.evaluate",
    target: release.id,
    requestId: asAuthed(req).requestId,
    previousState: null,
    newState: evaluation.deploymentAllowed ? "allowed" : "blocked",
    evidenceReference: evaluation.policyVersion,
  });
  res.json(evaluation);
});

apiRouter.get("/monitoring", (_req, res) => {
  res.json({ observations: store.monitoring });
});

apiRouter.get("/incidents", (_req, res) => {
  res.json({ incidents: store.incidents });
});

apiRouter.get("/backup", (_req, res) => {
  res.json({ attestations: store.backupAttestations });
});

apiRouter.get(
  "/audit",
  requireAuth,
  requirePermission("audit:read"),
  (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 100), 500);
    const events = store.getAuditSnapshot().slice(-limit).reverse();
    res.json({
      events,
      appendOnly: true,
      durablePath: store.auditPath,
      immutabilityClaim: false,
      integrityEnforced: store.auditIntegrityEnforced,
    });
  },
);

/** Explicitly forbid audit mutation endpoints */
apiRouter.delete("/audit/:id", requireAuth, (_req, res) => {
  res.status(403).json({ error: "forbidden", message: "Audit records are append-only" });
});
apiRouter.patch("/audit/:id", requireAuth, (_req, res) => {
  res.status(403).json({ error: "forbidden", message: "Audit records are append-only" });
});
apiRouter.put("/audit/:id", requireAuth, (_req, res) => {
  res.status(403).json({ error: "forbidden", message: "Audit records are append-only" });
});

apiRouter.get("/github/repository", async (_req, res) => {
  res.json(await githubAdapter.getRepository());
});

apiRouter.get("/github/branches/:branch/protection", async (req, res) => {
  res.json(await githubAdapter.getBranchProtection(req.params.branch));
});

apiRouter.get("/github/pulls", async (_req, res) => {
  res.json(await githubAdapter.listOpenPullRequests());
});

apiRouter.get("/coolify/applications", async (_req, res) => {
  res.json({
    capabilities: coolifyAdapter.capabilities(),
    applications: await coolifyAdapter.listApplications(),
  });
});

apiRouter.get("/coolify/applications/:id/deployments", async (req, res) => {
  res.json(await coolifyAdapter.listDeployments(req.params.id));
});

/** Policy modification — denied for all in Phase 2A including AI */
apiRouter.post(
  "/policy",
  requireAuth,
  requirePermission("policy:modify"),
  (_req, res) => {
    res.status(403).json({
      error: "forbidden",
      message: "Policy modification disabled in Phase 2A",
    });
  },
);

apiRouter.post(
  "/roles",
  requireAuth,
  requirePermission("roles:modify"),
  (_req, res) => {
    res.status(403).json({
      error: "forbidden",
      message: "Role modification disabled in Phase 2A",
    });
  },
);

apiRouter.post(
  "/credentials",
  requireAuth,
  requirePermission("credentials:modify"),
  (_req, res) => {
    res.status(403).json({
      error: "forbidden",
      message: "Credential modification disabled in Phase 2A",
    });
  },
);

apiRouter.post(
  "/approvals/request",
  requireAuth,
  requirePermission("approval:request"),
  (req, res) => {
    const { releaseId, migrationPlan, deploymentWindow } = req.body ?? {};
    const release = store.releases.find((r) => r.id === releaseId);
    if (!release) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const ar: ApprovalRequest = {
      id: randomUUID(),
      releaseId: release.id,
      commitSha: release.commitSha,
      imageDigest: release.imageDigest,
      targetEnvironmentId: release.targetEnvironmentId,
      migrationPlan: migrationPlan ?? release.databaseMigrationImpact,
      deploymentWindow: deploymentWindow ?? "unspecified",
      policyVersion: POLICY_VERSION,
      requestedBy: asAuthed(req).operator!.id,
      requestedAt: new Date().toISOString(),
      status: "pending",
    };
    store.approvalRequests.push(ar);
    store.appendAudit({
      actor: asAuthed(req).operator!.id,
      action: "approval.request",
      target: ar.id,
      requestId: asAuthed(req).requestId,
      previousState: null,
      newState: "pending",
      evidenceReference: release.commitSha,
    });
    res.status(201).json({ approvalRequest: ar });
  },
);

apiRouter.post(
  "/approvals/:id/decide",
  requireAuth,
  requirePermission("approval:decide"),
  (req, res) => {
    const ar = store.approvalRequests.find((a) => a.id === req.params.id);
    if (!ar) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const decision = req.body?.decision === "reject" ? "reject" : "approve";
    const release = store.releases.find((r) => r.id === ar.releaseId)!;
    const op = asAuthed(req).operator!;
    const validation = validateApprovalAttempt({
      approvalRequest: ar,
      actorId: op.id,
      actorRole: op.role,
      releaseAuthorId: ar.requestedBy,
      decision,
    });
    if (!validation.ok) {
      store.appendAudit({
        actor: op.id,
        action: "approval.rejected_by_policy",
        target: ar.id,
        requestId: asAuthed(req).requestId,
        previousState: ar.status,
        newState: ar.status,
        evidenceReference: validation.reason ?? null,
      });
      res.status(403).json({ error: "forbidden", message: validation.reason });
      return;
    }
    const approval: Approval = {
      id: randomUUID(),
      approvalRequestId: ar.id,
      actorId: op.id,
      actorRole: op.role,
      decision,
      createdAt: new Date().toISOString(),
      note: req.body?.note,
    };
    store.approvals.push(approval);
    ar.status = decision === "approve" ? "approved" : "rejected";
    store.appendAudit({
      actor: op.id,
      action: decision === "approve" ? "approval.grant" : "approval.reject",
      target: ar.id,
      requestId: asAuthed(req).requestId,
      previousState: "pending",
      newState: ar.status,
      evidenceReference: release.commitSha,
    });
    res.json({ approval, approvalRequest: ar });
  },
);

apiRouter.post(
  "/deployments/execute",
  requireAuth,
  requirePermission("deployment:execute"),
  (req, res) => {
    /* Unreachable for all roles in Phase 2A — permission never granted.
       Defense in depth: hard deny even if matrix regresses. */
    store.appendAudit({
      actor: asAuthed(req).operator!.id,
      action: "deployment.execute.attempt",
      target: String(req.body?.releaseId ?? ""),
      requestId: asAuthed(req).requestId,
      previousState: null,
      newState: "denied",
      evidenceReference: "deployment_execution_disabled",
    });
    res.status(403).json({
      error: "deployment_disabled",
      message:
        "Production deployment execution is permanently disabled in Phase 2A for all roles including platform_owner.",
    });
  },
);

apiRouter.post(
  "/deployments/request",
  requireAuth,
  requirePermission("deployment:request"),
  (req, res) => {
    store.appendAudit({
      actor: asAuthed(req).operator!.id,
      action: "deployment.request",
      target: String(req.body?.releaseId ?? ""),
      requestId: asAuthed(req).requestId,
      previousState: null,
      newState: "requested",
      evidenceReference: null,
    });
    res.status(202).json({
      accepted: true,
      execution: "not_started",
      note: "Deployment request recorded; execution remains disabled",
    });
  },
);
