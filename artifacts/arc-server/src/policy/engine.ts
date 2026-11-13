import { randomUUID } from "node:crypto";
import type {
  Approval,
  ApprovalRequest,
  BackupAttestation,
  GateEvaluation,
  GateEvidence,
  GateResult,
  ReleaseRecord,
} from "../lib/types.js";
import { isAiAgent, isIndependentReviewer } from "../lib/auth.js";

export const POLICY_VERSION = "arc-policy-v1-phase1";

export type PolicyInput = {
  release: ReleaseRecord;
  /** Observed production SHA — null means UNVERIFIED */
  productionCommitSha: string | null;
  productionShaState: "VERIFIED" | "UNVERIFIED" | "UNAVAILABLE";
  productionImageDigest: string | null;
  backup: BackupAttestation;
  approvals: Approval[];
  approvalRequest: ApprovalRequest | null;
  independentReviewPresent: boolean;
  stagingAccepted: boolean;
  deploymentExecutionEnabled: boolean;
  now?: Date;
};

function evidence(
  gateId: string,
  _result: GateResult,
  reference: string,
  sourceSystem: string,
  artifactIdentity: string | null,
  detail?: string,
  expiresAt: string | null = null,
): GateEvidence {
  const ts = new Date().toISOString();
  return {
    id: randomUUID(),
    gateId,
    reference,
    sourceSystem,
    executedAt: ts,
    validatedAt: ts,
    artifactIdentity,
    policyVersion: POLICY_VERSION,
    expiresAt,
    detail,
  };
}

function gate(
  category: string,
  name: string,
  mandatory: boolean,
  result: GateResult,
  ev: GateEvidence | null,
): GateEvaluation {
  const blocks =
    mandatory &&
    (result === "FAIL" ||
      result === "BLOCKED" ||
      result === "UNVERIFIED" ||
      result === "NOT_RUN" ||
      result === "EXPIRED");
  return {
    id: `${category}:${name}`,
    category,
    name,
    mandatory,
    result,
    evidence: ev,
    blocksDeployment: blocks,
  };
}

/** Deterministic Phase 1 policy evaluation — backend enforced */
export function evaluateReleasePolicy(input: PolicyInput): {
  gates: GateEvaluation[];
  deploymentAllowed: boolean;
  blockingGates: string[];
  policyVersion: string;
} {
  const { release, backup } = input;
  const sha = release.commitSha;
  const gates: GateEvaluation[] = [];

  // Source integrity
  gates.push(
    gate(
      "source_integrity",
      "commit_identity",
      true,
      /^[0-9a-f]{40}$/i.test(sha) ? "PASS" : "FAIL",
      evidence("commit_identity", "PASS", `sha=${sha}`, "arc-policy", sha),
    ),
  );
  gates.push(
    gate(
      "source_integrity",
      "tree_identity",
      true,
      /^[0-9a-f]{40}$/i.test(release.treeSha) ? "PASS" : "FAIL",
      evidence("tree_identity", "PASS", `tree=${release.treeSha}`, "arc-policy", release.treeSha),
    ),
  );
  gates.push(
    gate(
      "source_integrity",
      "image_digest",
      true,
      release.imageDigest ? "PASS" : "UNVERIFIED",
      evidence(
        "image_digest",
        release.imageDigest ? "PASS" : "UNVERIFIED",
        release.imageDigest ?? "missing",
        "arc-policy",
        release.imageDigest,
        "Immutable digest required before production deploy",
      ),
    ),
  );

  // Code quality (from release inventory / prior local validation attestation)
  gates.push(
    gate(
      "code_quality",
      "typescript",
      true,
      release.ciStatus === "PASS" ? "PASS" : release.ciStatus,
      evidence("typescript", release.ciStatus, "local-validation-attestation", "arc-fixtures", sha),
    ),
  );

  // Independent review
  const reviewResult: GateResult = input.independentReviewPresent ? "PASS" : "FAIL";
  gates.push(
    gate(
      "operational_readiness",
      "independent_review",
      true,
      reviewResult,
      evidence(
        "independent_review",
        reviewResult,
        input.independentReviewPresent ? "reviewer-approval" : "missing",
        "arc-approvals",
        sha,
      ),
    ),
  );

  // Backup / restore
  gates.push(
    gate(
      "operational_readiness",
      "backup_evidence",
      true,
      backup.readiness === "PASS" ? "PASS" : backup.readiness,
      evidence(
        "backup_evidence",
        backup.readiness,
        backup.note,
        "backup-attestation",
        null,
        `integrity=${backup.integrityStatus}`,
      ),
    ),
  );
  const restoreOk = !!backup.lastIsolatedRestoreTestAt && backup.readiness === "PASS";
  gates.push(
    gate(
      "operational_readiness",
      "restore_evidence",
      true,
      restoreOk ? "PASS" : "FAIL",
      evidence(
        "restore_evidence",
        restoreOk ? "PASS" : "FAIL",
        backup.lastIsolatedRestoreTestAt ?? "never",
        "backup-attestation",
        null,
      ),
    ),
  );

  // Staging
  gates.push(
    gate(
      "operational_readiness",
      "staging_acceptance",
      true,
      input.stagingAccepted ? "PASS" : "BLOCKED",
      evidence(
        "staging_acceptance",
        input.stagingAccepted ? "PASS" : "BLOCKED",
        input.stagingAccepted ? "accepted" : "not_accepted",
        "arc-policy",
        sha,
      ),
    ),
  );

  // Production identity
  gates.push(
    gate(
      "operational_readiness",
      "production_sha_verified",
      true,
      input.productionShaState === "VERIFIED" && input.productionCommitSha
        ? "PASS"
        : "UNVERIFIED",
      evidence(
        "production_sha_verified",
        input.productionShaState === "VERIFIED" ? "PASS" : "UNVERIFIED",
        input.productionCommitSha ?? "unknown",
        "coolify-adapter",
        input.productionCommitSha,
        "Inferred fingerprints must not count as VERIFIED",
      ),
    ),
  );

  // Approval binding
  const ar = input.approvalRequest;
  let approvalGate: GateResult = "FAIL";
  let approvalDetail = "no approval request";
  if (ar) {
    if (ar.status === "expired") {
      approvalGate = "EXPIRED";
      approvalDetail = "approval expired";
    } else if (ar.commitSha !== release.commitSha) {
      approvalGate = "FAIL";
      approvalDetail = "approval SHA mismatch";
    } else if (ar.imageDigest !== release.imageDigest) {
      approvalGate = "FAIL";
      approvalDetail = "approval image digest mismatch";
    } else if (ar.status === "approved" && input.approvals.some((a) => a.decision === "approve")) {
      approvalGate = "PASS";
      approvalDetail = "bound approval present";
    } else {
      approvalGate = "FAIL";
      approvalDetail = `request status=${ar.status}`;
    }
  }
  gates.push(
    gate(
      "operational_readiness",
      "release_approval",
      true,
      approvalGate,
      evidence("release_approval", approvalGate, approvalDetail, "arc-approvals", sha),
    ),
  );

  // Deployment execution kill switch
  gates.push(
    gate(
      "operational_readiness",
      "deployment_execution_enabled",
      true,
      input.deploymentExecutionEnabled ? "PASS" : "BLOCKED",
      evidence(
        "deployment_execution_enabled",
        input.deploymentExecutionEnabled ? "PASS" : "BLOCKED",
        "Phase 1 kill switch",
        "arc-policy",
        null,
        "Production-changing methods disabled by default",
      ),
    ),
  );

  const blockingGates = gates.filter((g) => g.blocksDeployment).map((g) => g.id);
  return {
    gates,
    deploymentAllowed: blockingGates.length === 0,
    blockingGates,
    policyVersion: POLICY_VERSION,
  };
}

export type ApprovalAttempt = {
  approvalRequest: ApprovalRequest;
  actorId: string;
  actorRole: import("../lib/types.js").ArcRole;
  releaseAuthorId: string;
  decision: "approve" | "reject";
  now?: Date;
};

/** Separation of duties + AI exclusion */
export function validateApprovalAttempt(attempt: ApprovalAttempt): {
  ok: boolean;
  reason?: string;
} {
  if (isAiAgent(attempt.actorRole)) {
    return { ok: false, reason: "AI agents cannot act as independent reviewers or approvers" };
  }
  if (attempt.decision === "approve") {
    if (!isIndependentReviewer(attempt.actorRole) && attempt.actorRole !== "platform_owner") {
      /* Phase 1: independent_reviewer required for independent-review gate;
         platform_owner may request but self-approval of own release rejected below */
    }
    if (attempt.actorId === attempt.releaseAuthorId) {
      return { ok: false, reason: "self-approval rejected (separation of duties)" };
    }
    if (attempt.decision === "approve" && !isIndependentReviewer(attempt.actorRole)) {
      return {
        ok: false,
        reason: "independent_reviewer role required for approval grant in Phase 1",
      };
    }
  }
  if (attempt.approvalRequest.status === "expired") {
    return { ok: false, reason: "expired approval rejection" };
  }
  const now = attempt.now ?? new Date();
  /* Simple window: if deploymentWindow is ISO end after | use requestedAt+7d */
  const created = Date.parse(attempt.approvalRequest.requestedAt);
  if (Number.isFinite(created) && now.getTime() - created > 7 * 24 * 3600 * 1000) {
    return { ok: false, reason: "expired approval rejection" };
  }
  return { ok: true };
}
