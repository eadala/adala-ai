import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type {
  Approval,
  ApprovalRequest,
  ApplicationRecord,
  AuditEvent,
  BackupAttestation,
  EnvironmentRecord,
  IncidentRecord,
  MonitoringObservation,
  ReleaseRecord,
} from "./types.js";
import { seedData } from "../fixtures/seed.js";
import { DurableAuditStore } from "./auditStore.js";

function defaultAuditPath(): string {
  return resolve(
    process.env.ARC_AUDIT_PATH?.trim() ||
      resolve(process.cwd(), "data", `audit.${process.pid}.jsonl`),
  );
}

function defaultAuditDbPath(jsonlPath: string): string {
  if (process.env.ARC_AUDIT_DB?.trim()) return resolve(process.env.ARC_AUDIT_DB.trim());
  if (jsonlPath.endsWith(".jsonl")) return jsonlPath.replace(/\.jsonl$/, `.${process.pid}.sqlite`);
  return resolve(process.cwd(), "data", `arc-audit.${process.pid}.sqlite`);
}

/** In-memory domain store + durable JSONL + SQLite hash-chained audit */
export class ArcStore {
  environments: EnvironmentRecord[] = [];
  applications: ApplicationRecord[] = [];
  releases: ReleaseRecord[] = [];
  approvalRequests: ApprovalRequest[] = [];
  approvals: Approval[] = [];
  auditEvents: AuditEvent[] = [];
  incidents: IncidentRecord[] = [];
  monitoring: MonitoringObservation[] = [];
  backupAttestations: BackupAttestation[] = [];
  readonly auditPath: string;
  readonly durable: DurableAuditStore;
  /** Hash-chain integrity enforced in SQLite store */
  readonly auditIntegrityEnforced = true;
  /** When true, security-critical mutations fail if durable append fails */
  failClosedOnAudit = true;

  constructor(auditPath?: string, auditDbPath?: string) {
    this.auditPath = auditPath ?? defaultAuditPath();
    this.durable = new DurableAuditStore(auditDbPath ?? defaultAuditDbPath(this.auditPath));
    const s = seedData();
    this.environments = s.environments;
    this.applications = s.applications;
    this.releases = s.releases;
    this.incidents = s.incidents;
    this.monitoring = s.monitoring;
    this.backupAttestations = s.backupAttestations;
    this.loadAuditFromDisk();
  }

  private loadAuditFromDisk(): void {
    try {
      if (!existsSync(this.auditPath)) return;
      const text = readFileSync(this.auditPath, "utf8");
      for (const line of text.split("\n")) {
        if (!line.trim()) continue;
        try {
          this.auditEvents.push(JSON.parse(line) as AuditEvent);
        } catch {
          /* skip corrupt line */
        }
      }
    } catch {
      /* missing file ok */
    }
  }

  appendAudit(
    event: Omit<AuditEvent, "id" | "timestamp"> & {
      timestamp?: string;
      outcome?: string;
      actorType?: string;
      environment?: string;
      releaseId?: string | null;
      metadata?: unknown;
      critical?: boolean;
    },
  ): AuditEvent {
    const full: AuditEvent = {
      id: randomUUID(),
      timestamp: event.timestamp ?? new Date().toISOString(),
      actor: event.actor,
      action: event.action,
      target: event.target,
      requestId: event.requestId,
      previousState: event.previousState,
      newState: event.newState,
      evidenceReference: event.evidenceReference,
    };
    this.auditEvents.push(full);
    try {
      mkdirSync(dirname(this.auditPath), { recursive: true });
      appendFileSync(this.auditPath, `${JSON.stringify(full)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
    } catch (e) {
      console.error(
        JSON.stringify({
          msg: "audit_jsonl_persist_failed",
          error: e instanceof Error ? e.message : "unknown",
        }),
      );
    }
    try {
      this.durable.append({
        id: full.id,
        actorId: full.actor,
        actorType: event.actorType ?? "operator",
        action: full.action,
        resource: full.target,
        requestCorrelationId: full.requestId,
        outcome: event.outcome ?? full.newState ?? "recorded",
        releaseId: event.releaseId ?? null,
        environment: event.environment,
        metadata: event.metadata ?? {
          previousState: full.previousState,
          newState: full.newState,
          evidenceReference: full.evidenceReference,
        },
        timestamp: full.timestamp,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      console.error(JSON.stringify({ msg: "audit_durable_persist_failed", error: msg }));
      /* Fail-closed only for explicit critical successful state changes — not auth denials */
      if (this.failClosedOnAudit && event.critical === true) {
        throw new Error(`audit_fail_closed:${msg}`);
      }
    }
    return full;
  }

  getAuditSnapshot(): readonly AuditEvent[] {
    return this.auditEvents;
  }

  verifyAuditIntegrity(): { ok: boolean; brokenAt?: number; reason?: string } {
    return this.durable.verifyChain();
  }

  attemptAuditMutation(): never {
    throw new Error("audit_mutation_forbidden");
  }
}

export const store = new ArcStore();
