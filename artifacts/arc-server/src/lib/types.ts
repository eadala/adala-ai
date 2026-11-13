/** ARC domain types — Phase 1 read-only MVP */

export type EvidenceState =
  | "VERIFIED"
  | "UNVERIFIED"
  | "DEGRADED"
  | "FAILED"
  | "STALE"
  | "UNAVAILABLE";

export type GateResult =
  | "PASS"
  | "FAIL"
  | "BLOCKED"
  | "NOT_RUN"
  | "UNVERIFIED"
  | "EXPIRED";

export type ArcRole =
  | "platform_owner"
  | "release_manager"
  | "independent_reviewer"
  | "production_operator"
  | "read_only_auditor"
  | "ai_agent";

export type Observation<T> = {
  value: T | null;
  state: EvidenceState;
  source: string;
  observedAt: string;
  note?: string;
};

export type EnvironmentRecord = {
  id: string;
  name: string;
  kind: "production" | "staging" | "local" | "synthetic";
  hostingProvider: string;
  deploymentProvider: string;
  repository: string;
};

export type ApplicationRecord = {
  id: string;
  name: string;
  environmentId: string;
  domain: string;
};

export type ReleaseRecord = {
  id: string;
  repository: string;
  commitSha: string;
  treeSha: string;
  buildArtifactId: string | null;
  imageDigest: string | null;
  createdAt: string;
  targetEnvironmentId: string;
  changeSummary: string;
  securityImpact: string;
  databaseMigrationImpact: string;
  ciStatus: GateResult;
  reviewStatus: GateResult;
  deploymentStatus: "not_deployed" | "proposed" | "approved" | "blocked";
  rollbackCompatibility: string;
  knownRisks: string[];
};

export type GateEvidence = {
  id: string;
  gateId: string;
  reference: string;
  sourceSystem: string;
  executedAt: string;
  validatedAt: string;
  artifactIdentity: string | null;
  policyVersion: string;
  expiresAt: string | null;
  detail?: string;
};

export type GateEvaluation = {
  id: string;
  category: string;
  name: string;
  mandatory: boolean;
  result: GateResult;
  evidence: GateEvidence | null;
  blocksDeployment: boolean;
};

export type ApprovalRequest = {
  id: string;
  releaseId: string;
  commitSha: string;
  imageDigest: string | null;
  targetEnvironmentId: string;
  migrationPlan: string;
  deploymentWindow: string;
  policyVersion: string;
  requestedBy: string;
  requestedAt: string;
  status: "pending" | "approved" | "rejected" | "expired" | "invalidated";
};

export type Approval = {
  id: string;
  approvalRequestId: string;
  actorId: string;
  actorRole: ArcRole;
  decision: "approve" | "reject";
  createdAt: string;
  note?: string;
};

export type AuditEvent = {
  id: string;
  actor: string;
  action: string;
  target: string;
  timestamp: string;
  requestId: string;
  previousState: string | null;
  newState: string | null;
  evidenceReference: string | null;
};

export type IncidentRecord = {
  id: string;
  severity: "P0" | "P1" | "P2" | "P3";
  detectedAt: string;
  component: string;
  evidence: string;
  status: "open" | "acknowledged" | "resolved";
  assignedOperator: string | null;
  resolutionTime: string | null;
  notes: string | null;
};

export type BackupAttestation = {
  id: string;
  provider: string;
  lastSuccessfulBackupAt: string | null;
  backupAgeHours: number | null;
  storageClass: string | null;
  retentionPolicy: string | null;
  integrityStatus: GateResult;
  lastIsolatedRestoreTestAt: string | null;
  rpo: string | null;
  rto: string | null;
  recoveryOperator: string | null;
  readiness: GateResult;
  note: string;
};

export type MonitoringObservation = {
  id: string;
  metric: string;
  value: string | null;
  state: EvidenceState;
  source: string;
  observedAt: string;
};

export type OperatorIdentity = {
  id: string;
  displayName: string;
  role: ArcRole;
};
