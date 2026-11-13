import { randomUUID } from "node:crypto";
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

/** In-memory Phase 1 store — dedicated ARC plane, not customer DB */
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
  /** Append-only: mutations push; no update/delete API for audit */
  private auditLocked = true;

  constructor() {
    const s = seedData();
    this.environments = s.environments;
    this.applications = s.applications;
    this.releases = s.releases;
    this.incidents = s.incidents;
    this.monitoring = s.monitoring;
    this.backupAttestations = s.backupAttestations;
  }

  appendAudit(event: Omit<AuditEvent, "id" | "timestamp"> & { timestamp?: string }): AuditEvent {
    if (!this.auditLocked) {
      throw new Error("audit store misconfigured");
    }
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
    return full;
  }

  /** Tests only — still append-only; never rewrite history */
  getAuditSnapshot(): readonly AuditEvent[] {
    return this.auditEvents;
  }
}

export const store = new ArcStore();
