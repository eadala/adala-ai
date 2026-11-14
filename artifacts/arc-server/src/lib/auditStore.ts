import { createHash, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * Durable append-only audit store with hash chaining (SQLite isolated DB).
 * Not WORM — DB admin can still tamper; app layer rejects UPDATE/DELETE.
 */

export type DurableAuditRecord = {
  id: string;
  eventType: string;
  actorId: string;
  actorType: string;
  action: string;
  resource: string;
  environment: string;
  requestCorrelationId: string;
  timestamp: string;
  outcome: string;
  releaseId: string | null;
  metadataSanitized: string;
  sequence: number;
  prevHash: string;
  eventHash: string;
};

const GENESIS = "0".repeat(64);

/** Process-wide serialize for the default audit DB path */
const appendLocks = new Map<string, Promise<unknown>>();

function withLock<T>(key: string, fn: () => T): Promise<T> {
  const prev = appendLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  appendLocks.set(
    key,
    prev.then(() => gate).catch(() => gate),
  );
  return prev
    .catch(() => undefined)
    .then(() => {
      try {
        return fn();
      } finally {
        release();
      }
    });
}

function canonicalize(parts: Record<string, string | number | null>): string {
  return Object.keys(parts)
    .sort()
    .map((k) => `${k}=${parts[k] ?? ""}`)
    .join("|");
}

function hashPayload(canonical: string): string {
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function redactSecrets(input: unknown): unknown {
  if (input == null) return input;
  if (typeof input === "string") {
    return input
      .replace(/(Bearer\s+)[A-Za-z0-9._\-]+/gi, "$1[REDACTED]")
      .replace(/(sk-|ghp_|gho_|ghu_|ghs_|ghr_)[A-Za-z0-9_]+/g, "[REDACTED]");
  }
  if (Array.isArray(input)) return input.map(redactSecrets);
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (/secret|token|password|authorization|api[_-]?key|credential/i.test(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactSecrets(v);
      }
    }
    return out;
  }
  return input;
}

export class DurableAuditStore {
  readonly dbPath: string;
  private db: DatabaseSync;
  readonly integrityEnforced = true;

  constructor(dbPath?: string) {
    this.dbPath = resolve(
      dbPath ??
        process.env.ARC_AUDIT_DB?.trim() ??
        resolve(process.cwd(), "data", "arc-audit.sqlite"),
    );
    mkdirSync(dirname(this.dbPath), { recursive: true });
    this.db = new DatabaseSync(this.dbPath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 8000;
      CREATE TABLE IF NOT EXISTS audit_events (
        sequence INTEGER PRIMARY KEY,
        id TEXT NOT NULL UNIQUE,
        event_type TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        actor_type TEXT NOT NULL,
        action TEXT NOT NULL,
        resource TEXT NOT NULL,
        environment TEXT NOT NULL,
        request_correlation_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        outcome TEXT NOT NULL,
        release_id TEXT,
        metadata_sanitized TEXT NOT NULL,
        prev_hash TEXT NOT NULL,
        event_hash TEXT NOT NULL
      );
      CREATE TRIGGER IF NOT EXISTS audit_no_update
        BEFORE UPDATE ON audit_events
        BEGIN SELECT RAISE(ABORT, 'audit_update_forbidden'); END;
      CREATE TRIGGER IF NOT EXISTS audit_no_delete
        BEFORE DELETE ON audit_events
        BEGIN SELECT RAISE(ABORT, 'audit_delete_forbidden'); END;
    `);
  }

  append(input: {
    eventType?: string;
    actorId: string;
    actorType?: string;
    action: string;
    resource: string;
    environment?: string;
    requestCorrelationId: string;
    outcome: string;
    releaseId?: string | null;
    metadata?: unknown;
    timestamp?: string;
    id?: string;
  }): DurableAuditRecord {
    /* Sync API with process lock via deasync-style busy wait on promise is awkward;
       use immediate transaction + MAX(sequence) for correctness across connections. */
    const id = input.id ?? randomUUID();
    const timestamp = input.timestamp ?? new Date().toISOString();
    const metadataSanitized = JSON.stringify(redactSecrets(input.metadata ?? {}));
    const eventType = input.eventType ?? input.action;
    const actorType = input.actorType ?? "operator";
    const environment = input.environment ?? process.env.ARC_ENV ?? "local";
    const releaseId = input.releaseId ?? null;

    try {
      this.db.exec("BEGIN IMMEDIATE");
      const tip = this.db
        .prepare(
          `SELECT sequence, event_hash FROM audit_events ORDER BY sequence DESC LIMIT 1`,
        )
        .get() as { sequence: number; event_hash: string } | undefined;
      const sequence = (tip?.sequence ?? 0) + 1;
      const prevHash = tip?.event_hash ?? GENESIS;
      const canonical = canonicalize({
        id,
        eventType,
        actorId: input.actorId,
        actorType,
        action: input.action,
        resource: input.resource,
        environment,
        requestCorrelationId: input.requestCorrelationId,
        timestamp,
        outcome: input.outcome,
        releaseId,
        metadataSanitized,
        sequence,
        prevHash,
      });
      const eventHash = hashPayload(canonical);
      this.db
        .prepare(
          `INSERT INTO audit_events (
            sequence, id, event_type, actor_id, actor_type, action, resource,
            environment, request_correlation_id, timestamp, outcome, release_id,
            metadata_sanitized, prev_hash, event_hash
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          sequence,
          id,
          eventType,
          input.actorId,
          actorType,
          input.action,
          input.resource,
          environment,
          input.requestCorrelationId,
          timestamp,
          input.outcome,
          releaseId,
          metadataSanitized,
          prevHash,
          eventHash,
        );
      this.db.exec("COMMIT");
      return {
        id,
        eventType,
        actorId: input.actorId,
        actorType,
        action: input.action,
        resource: input.resource,
        environment,
        requestCorrelationId: input.requestCorrelationId,
        timestamp,
        outcome: input.outcome,
        releaseId,
        metadataSanitized,
        sequence,
        prevHash,
        eventHash,
      };
    } catch (e) {
      try {
        this.db.exec("ROLLBACK");
      } catch {
        /* ignore */
      }
      throw new Error(
        `audit_persist_failed:${e instanceof Error ? e.message : "unknown"}`,
      );
    }
  }

  async appendAsync(
    input: Parameters<DurableAuditStore["append"]>[0],
  ): Promise<DurableAuditRecord> {
    return withLock(this.dbPath, () => this.append(input));
  }

  list(limit = 100): DurableAuditRecord[] {
    const rows = this.db
      .prepare(
        `SELECT sequence, id, event_type, actor_id, actor_type, action, resource,
                environment, request_correlation_id, timestamp, outcome, release_id,
                metadata_sanitized, prev_hash, event_hash
         FROM audit_events ORDER BY sequence DESC LIMIT ?`,
      )
      .all(limit) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      sequence: Number(r.sequence),
      id: String(r.id),
      eventType: String(r.event_type),
      actorId: String(r.actor_id),
      actorType: String(r.actor_type),
      action: String(r.action),
      resource: String(r.resource),
      environment: String(r.environment),
      requestCorrelationId: String(r.request_correlation_id),
      timestamp: String(r.timestamp),
      outcome: String(r.outcome),
      releaseId: r.release_id == null ? null : String(r.release_id),
      metadataSanitized: String(r.metadata_sanitized),
      prevHash: String(r.prev_hash),
      eventHash: String(r.event_hash),
    }));
  }

  verifyChain(): { ok: boolean; brokenAt?: number; reason?: string } {
    const rows = this.db
      .prepare(
        `SELECT sequence, id, event_type, actor_id, actor_type, action, resource,
                environment, request_correlation_id, timestamp, outcome, release_id,
                metadata_sanitized, prev_hash, event_hash
         FROM audit_events ORDER BY sequence ASC`,
      )
      .all() as Array<Record<string, unknown>>;
    let prev = GENESIS;
    let expectSeq = 1;
    for (const r of rows) {
      const sequence = Number(r.sequence);
      if (sequence !== expectSeq) {
        return { ok: false, brokenAt: sequence, reason: "sequence_gap" };
      }
      if (String(r.prev_hash) !== prev) {
        return { ok: false, brokenAt: sequence, reason: "prev_hash_mismatch" };
      }
      const canonical = canonicalize({
        id: String(r.id),
        eventType: String(r.event_type),
        actorId: String(r.actor_id),
        actorType: String(r.actor_type),
        action: String(r.action),
        resource: String(r.resource),
        environment: String(r.environment),
        requestCorrelationId: String(r.request_correlation_id),
        timestamp: String(r.timestamp),
        outcome: String(r.outcome),
        releaseId: r.release_id == null ? null : String(r.release_id),
        metadataSanitized: String(r.metadata_sanitized),
        sequence,
        prevHash: String(r.prev_hash),
      });
      const expected = hashPayload(canonical);
      if (expected !== String(r.event_hash)) {
        return { ok: false, brokenAt: sequence, reason: "event_hash_mismatch" };
      }
      prev = String(r.event_hash);
      expectSeq++;
    }
    return { ok: true };
  }

  attemptUpdate(): never {
    throw new Error("audit_mutation_forbidden");
  }

  attemptDelete(): never {
    throw new Error("audit_mutation_forbidden");
  }

  trySqlUpdate(id: string): { rejected: boolean; message: string } {
    try {
      this.db.prepare(`UPDATE audit_events SET action = 'tampered' WHERE id = ?`).run(id);
      return { rejected: false, message: "unexpected_success" };
    } catch (e) {
      return {
        rejected: true,
        message: e instanceof Error ? e.message : "rejected",
      };
    }
  }

  close(): void {
    this.db.close();
  }
}
