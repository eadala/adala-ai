import { randomUUID } from "node:crypto";
import type { GateResult, ReleaseRecord } from "./types.js";

export type EvidenceCategory =
  | "source_integrity"
  | "build_integrity"
  | "test_results"
  | "security_validation"
  | "human_review"
  | "migration_compatibility"
  | "backup_readiness"
  | "restore_readiness"
  | "operational_readiness";

export type EvidenceRecord = {
  evidenceId: string;
  evidenceType: EvidenceCategory;
  source: string;
  subjectIdentity: {
    repository: string;
    commitSha: string;
    treeSha: string;
    artifactDigest: string | null;
    targetEnvironment: string;
    policyVersion: string;
  };
  verificationMethod: string;
  observationTime: string;
  expirationTime: string | null;
  verificationResult: GateResult;
  failureReason: string | null;
};

export type ReleaseIdentity = EvidenceRecord["subjectIdentity"];

export function releaseIdentityOf(
  release: ReleaseRecord,
  policyVersion: string,
): ReleaseIdentity {
  return {
    repository: release.repository,
    commitSha: release.commitSha,
    treeSha: release.treeSha,
    artifactDigest: release.imageDigest,
    targetEnvironment: release.targetEnvironmentId,
    policyVersion,
  };
}

export function makeEvidence(
  partial: Omit<EvidenceRecord, "evidenceId"> & { evidenceId?: string },
): EvidenceRecord {
  return {
    evidenceId: partial.evidenceId ?? randomUUID(),
    evidenceType: partial.evidenceType,
    source: partial.source,
    subjectIdentity: partial.subjectIdentity,
    verificationMethod: partial.verificationMethod,
    observationTime: partial.observationTime,
    expirationTime: partial.expirationTime,
    verificationResult: partial.verificationResult,
    failureReason: partial.failureReason,
  };
}

/** TOCTOU: invalidate when artifact/env/policy/evidence/reviewer changes */
export function approvalStillValid(opts: {
  bound: ReleaseIdentity;
  current: ReleaseIdentity;
  evidenceExpired: boolean;
  reviewerRevoked: boolean;
}): { valid: boolean; reason?: string } {
  if (opts.reviewerRevoked) return { valid: false, reason: "reviewer_revoked" };
  if (opts.evidenceExpired) return { valid: false, reason: "evidence_expired" };
  if (opts.bound.artifactDigest !== opts.current.artifactDigest) {
    return { valid: false, reason: "artifact_digest_changed" };
  }
  if (opts.bound.commitSha !== opts.current.commitSha || opts.bound.treeSha !== opts.current.treeSha) {
    return { valid: false, reason: "source_identity_changed" };
  }
  if (opts.bound.targetEnvironment !== opts.current.targetEnvironment) {
    return { valid: false, reason: "environment_changed" };
  }
  if (opts.bound.policyVersion !== opts.current.policyVersion) {
    return { valid: false, reason: "policy_changed" };
  }
  return { valid: true };
}

export function evaluateEvidenceSet(
  records: EvidenceRecord[],
  mandatory: EvidenceCategory[],
  now = new Date(),
): { overall: GateResult; missing: EvidenceCategory[]; expired: string[] } {
  const missing: EvidenceCategory[] = [];
  const expired: string[] = [];
  for (const cat of mandatory) {
    const found = records.filter((r) => r.evidenceType === cat);
    if (found.length === 0) {
      missing.push(cat);
      continue;
    }
    for (const r of found) {
      if (r.expirationTime && Date.parse(r.expirationTime) < now.getTime()) {
        expired.push(r.evidenceId);
      }
      if (
        r.verificationResult === "FAIL" ||
        r.verificationResult === "BLOCKED" ||
        r.verificationResult === "UNVERIFIED" ||
        r.verificationResult === "NOT_RUN"
      ) {
        /* count as blocking via missing-equivalent */
        if (!missing.includes(cat)) missing.push(cat);
      }
    }
  }
  if (missing.length || expired.length) {
    return { overall: "BLOCKED", missing, expired };
  }
  return { overall: "PASS", missing, expired };
}
