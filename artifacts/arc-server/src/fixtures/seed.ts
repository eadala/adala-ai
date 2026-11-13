import type {
  ApplicationRecord,
  BackupAttestation,
  EnvironmentRecord,
  IncidentRecord,
  MonitoringObservation,
  ReleaseRecord,
} from "../lib/types.js";

const NOW = "2026-11-13T21:00:00.000Z";

export function seedData() {
  const environments: EnvironmentRecord[] = [
    {
      id: "env-prod",
      name: "production",
      kind: "production",
      hostingProvider: "Hetzner Cloud",
      deploymentProvider: "Coolify",
      repository: "eadala/adala-ai",
    },
    {
      id: "env-staging",
      name: "staging",
      kind: "staging",
      hostingProvider: "UNVERIFIED",
      deploymentProvider: "Coolify (planned)",
      repository: "eadala/adala-ai",
    },
    {
      id: "env-local",
      name: "local-arc",
      kind: "local",
      hostingProvider: "developer workstation",
      deploymentProvider: "none",
      repository: "eadala/adala-ai",
    },
  ];

  const applications: ApplicationRecord[] = [
    {
      id: "app-adala-prod",
      name: "Adalah AI",
      environmentId: "env-prod",
      domain: "adalahai.com",
    },
  ];

  const releases: ReleaseRecord[] = [
    {
      id: "rel-frozen-rc",
      repository: "eadala/adala-ai",
      commitSha: "5441523302a1513f07b5dc08f028d848a0bad5b4",
      treeSha: "cd84a7f277c481dc5c96d707dde4e78d7f18e713",
      buildArtifactId: null,
      imageDigest: null,
      createdAt: "2026-11-13T12:00:00.000Z",
      targetEnvironmentId: "env-prod",
      changeSummary: "Historical frozen release candidate (immutable reference).",
      securityImpact: "Baseline historical; do not modify.",
      databaseMigrationImpact: "UNVERIFIED vs live production ledger",
      ciStatus: "UNVERIFIED",
      reviewStatus: "UNVERIFIED",
      deploymentStatus: "blocked",
      rollbackCompatibility: "Historical reference only",
      knownRisks: ["Must remain unchanged", "Not proven as live production"],
    },
    {
      id: "rel-guc-rc",
      repository: "eadala/adala-ai",
      commitSha: "8f3c79357808f7c8d149e265e0f2bd4bb2d43422",
      treeSha: "14a92d2c3c96256910a581bf919df49d9e905452",
      buildArtifactId: null,
      imageDigest: null,
      createdAt: "2026-11-13T20:11:53.000Z",
      targetEnvironmentId: "env-prod",
      changeSummary:
        "Security-closed RC: GUC pool containment (#139) + tenant cohesion batches. Not production-approved.",
      securityImpact:
        "P0 GUC containment, fail-closed tenant scopes, JLWM seed guard, autopilot task scope.",
      databaseMigrationImpact:
        "Zero migration files vs develop; large delta vs main-lineage fingerprint — live ledger UNVERIFIED.",
      ciStatus: "PASS",
      reviewStatus: "FAIL",
      deploymentStatus: "proposed",
      rollbackCompatibility: "App rollback ≠ DB rollback; plan required",
      knownRisks: [
        "Independent review incomplete",
        "Image digest not built",
        "Production SHA UNVERIFIED",
        "Backup/restore unproven",
        "Staging not accepted",
      ],
    },
  ];

  const incidents: IncidentRecord[] = [
    {
      id: "inc-payments-outage",
      severity: "P1",
      detectedAt: "2026-11-13T20:25:22.000Z",
      component: "payments",
      evidence:
        "GET /api/status payments=outage detail matches origin/main stripeSystemStatus string",
      status: "open",
      assignedOperator: null,
      resolutionTime: null,
      notes: "PRE-EXISTING PROD; not introduced by undeployed RC",
    },
    {
      id: "inc-www-503",
      severity: "P1",
      detectedAt: "2026-11-13T20:25:22.000Z",
      component: "domain-www",
      evidence: "https://www.adalahai.com → HTTP 503 no available server (Cloudflare)",
      status: "open",
      assignedOperator: null,
      resolutionTime: null,
      notes: "PRE-EXISTING PROD routing; apex healthy",
    },
  ];

  const monitoring: MonitoringObservation[] = [
    {
      id: "mon-apex-healthz",
      metric: "apex.api.healthz",
      value: "HTTP 200 healthy",
      state: "VERIFIED",
      source: "public-http-probe",
      observedAt: "2026-11-13T20:25:21.000Z",
    },
    {
      id: "mon-www-healthz",
      metric: "www.api.healthz",
      value: "HTTP 503",
      state: "FAILED",
      source: "public-http-probe",
      observedAt: "2026-11-13T20:25:21.000Z",
    },
    {
      id: "mon-payments",
      metric: "payments.status",
      value: "outage",
      state: "FAILED",
      source: "public-http-probe:/api/status",
      observedAt: "2026-11-13T20:25:22.000Z",
    },
    {
      id: "mon-prod-sha",
      metric: "production.git_sha",
      value: null,
      state: "UNVERIFIED",
      source: "coolify-unavailable",
      observedAt: NOW,
    },
    {
      id: "mon-cpu",
      metric: "infra.cpu",
      value: null,
      state: "UNAVAILABLE",
      source: "coolify-metrics",
      observedAt: NOW,
    },
  ];

  const backupAttestations: BackupAttestation[] = [
    {
      id: "bak-prod-1",
      provider: "Coolify/Hetzner (UNVERIFIED)",
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
      note: "Schedule existence is not restore proof. Operator checklist required.",
    },
  ];

  return {
    environments,
    applications,
    releases,
    incidents,
    monitoring,
    backupAttestations,
  };
}
