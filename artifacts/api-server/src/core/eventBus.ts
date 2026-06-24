/**
 * عدالة AI — Event Bus Core
 * Persistent, type-safe event bus with SSE real-time broadcasting
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { Response } from "express";

/* ── Event Types ──────────────────────────────────────── */
export type EventType =
  | "CASE_CREATED"
  | "CASE_UPDATED"
  | "CASE_CLOSED"
  | "CLIENT_ADDED"
  | "INVOICE_CREATED"
  | "INVOICE_PAID"
  | "INVOICE_OVERDUE"
  | "PAYMENT_SUCCESS"
  | "PAYMENT_FAILED"
  | "PAYMENT_SETTLED"
  | "CONTRACT_SIGNED"
  | "REMINDER_DUE"
  | "PORTAL_UPDATED"
  | "AI_QUERY"
  | "SUBSCRIPTION_RENEWED"
  | "SUBSCRIPTION_EXPIRED"
  | "USER_LOGIN"
  | "DOCUMENT_GENERATED"
  /* ── Bankruptcy Module ── */
  | "BK_CASE_CREATED"
  | "BK_CASE_CLOSED"
  | "BK_DISTRIBUTION_EXECUTED"
  | "BK_CLAIM_APPROVED"
  | "BK_ALERT_TRIGGERED";

export interface EventPayload {
  type: EventType;
  officeId?: string;
  actorId?: string;
  data: Record<string, any>;
  timestamp?: string;
}

export interface StoredEvent extends EventPayload {
  id: string;
  timestamp: string;
}

type EventHandler = (event: StoredEvent) => void | Promise<void>;

/* ── Ensure DB table ──────────────────────────────────── */
async function ensureEventsTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS system_events (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_type  TEXT NOT NULL,
      office_id   TEXT DEFAULT 'default',
      actor_id    TEXT,
      payload     JSONB NOT NULL DEFAULT '{}',
      created_at  TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_system_events_type      ON system_events(event_type)
  `).catch(() => {});
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_system_events_office    ON system_events(office_id)
  `).catch(() => {});
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_system_events_created   ON system_events(created_at DESC)
  `).catch(() => {});
}
ensureEventsTable();

/* ── Event Bus ────────────────────────────────────────── */
class EventBus {
  private listeners: Map<string, EventHandler[]> = new Map();
  private wildcardListeners: EventHandler[] = [];
  private sseClients: Set<Response> = new Set();

  /* Register listener for specific event */
  on(event: EventType | "*", handler: EventHandler): void {
    if (event === "*") {
      this.wildcardListeners.push(handler);
      return;
    }
    const existing = this.listeners.get(event) ?? [];
    this.listeners.set(event, [...existing, handler]);
  }

  /* Emit event — persist + notify listeners + broadcast SSE */
  async emit(payload: EventPayload): Promise<StoredEvent> {
    const stored: StoredEvent = {
      ...payload,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    /* 1. Persist to DB (non-blocking) */
    db.execute(sql`
      INSERT INTO system_events (id, event_type, office_id, actor_id, payload, created_at)
      VALUES (
        ${stored.id}::uuid,
        ${stored.type},
        ${stored.officeId ?? "default"},
        ${stored.actorId ?? null},
        ${JSON.stringify(stored.data)}::jsonb,
        ${stored.timestamp}::timestamp
      )
    `).catch(e => console.error("[EventBus] persist error:", e.message));

    /* 2. Run specific listeners */
    const handlers = this.listeners.get(stored.type) ?? [];
    for (const handler of handlers) {
      Promise.resolve(handler(stored)).catch((e: any) =>
        console.error(`[EventBus] listener error [${stored.type}]:`, e.message)
      );
    }

    /* 3. Run wildcard listeners */
    for (const handler of this.wildcardListeners) {
      Promise.resolve(handler(stored)).catch((e: any) =>
        console.error("[EventBus] wildcard listener error:", e.message)
      );
    }

    /* 4. Broadcast to SSE clients */
    this.broadcastSSE(stored);

    return stored;
  }

  /* SSE client management */
  addSSEClient(res: Response): void {
    this.sseClients.add(res);
    res.on("close", () => this.sseClients.delete(res));
  }

  private broadcastSSE(event: StoredEvent): void {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of this.sseClients) {
      try { client.write(data); } catch { this.sseClients.delete(client); }
    }
  }

  get clientCount(): number { return this.sseClients.size; }
}

export const eventBus = new EventBus();
