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

function defaultAuditPath(): string {
  return resolve(
    process.env.ARC_AUDIT_PATH?.trim() ||
      resolve(process.cwd(), "data", "audit.jsonl"),
  );
}

/** In-memory Phase 1 store + durable append-only audit JSONL */
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
  /** Technical limitation: file append-only, not cryptographic WORM */
  readonly auditIntegrityEnforced = false;

  constructor(auditPath?: string) {
    this.auditPath = auditPath ?? defaultAuditPath();
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

  appendAudit(event: Omit<AuditEvent, "id" | "timestamp"> & { timestamp?: string }): AuditEvent {
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
      appendFileSync(this.auditPath, `${JSON.stringify(full)}\n`, { encoding: "utf8", mode: 0o600 });
    } catch (e) {
      /* Durability failure is logged to stderr; event still in memory */
      console.error(
        JSON.stringify({
          msg: "audit_persist_failed",
          error: e instanceof Error ? e.message : "unknown",
        }),
      );
    }
    return full;
  }

  getAuditSnapshot(): readonly AuditEvent[] {
    return this.auditEvents;
  }

  /** No public API to mutate/delete audit — enforce in routes */
  attemptAuditMutation(): never {
    throw new Error("audit_mutation_forbidden");
  }
}

export const store = new ArcStore();
