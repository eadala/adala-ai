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
  | "DOCUMENT_GENERATED";

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

/* ── Limits ───────────────────────────────────────────── */
const MAX_SSE_CLIENTS       = 50;   // حد أقصى للاتصالات SSE المتزامنة
const MAX_LISTENERS_PER_EVT = 20;   // حد أقصى للـ listeners لكل نوع حدث
const MAX_WILDCARD_LISTENERS = 10;  // حد أقصى للـ wildcard listeners

/* ── Event Bus ────────────────────────────────────────── */
class EventBus {
  private listeners: Map<string, EventHandler[]> = new Map();
  private wildcardListeners: EventHandler[] = [];
  private sseClients: Set<Response> = new Set();

  /* Register listener — مع dedup وحد أقصى */
  on(event: EventType | "*", handler: EventHandler): void {
    if (event === "*") {
      /* منع التسجيل المكرر لنفس الـ handler */
      if (this.wildcardListeners.includes(handler)) return;
      if (this.wildcardListeners.length >= MAX_WILDCARD_LISTENERS) {
        console.warn(`[EventBus] تحذير: تم الوصول للحد الأقصى للـ wildcard listeners (${MAX_WILDCARD_LISTENERS})`);
        return;
      }
      this.wildcardListeners.push(handler);
      return;
    }
    const existing = this.listeners.get(event) ?? [];
    /* منع التسجيل المكرر */
    if (existing.includes(handler)) return;
    if (existing.length >= MAX_LISTENERS_PER_EVT) {
      console.warn(`[EventBus] تحذير: تم الوصول للحد الأقصى للـ listeners لحدث "${event}" (${MAX_LISTENERS_PER_EVT})`);
      return;
    }
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

  /* SSE client management — مع حد أقصى */
  addSSEClient(res: Response): void {
    /* إذا تجاوزنا الحد، أغلق أقدم اتصال */
    if (this.sseClients.size >= MAX_SSE_CLIENTS) {
      const oldest = this.sseClients.values().next().value;
      if (oldest) {
        try { oldest.end(); } catch { /* ignore */ }
        this.sseClients.delete(oldest);
        console.warn(`[EventBus] SSE clients limit (${MAX_SSE_CLIENTS}) reached — أُغلق أقدم اتصال`);
      }
    }
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

  /** إحصائيات الذاكرة للـ monitoring */
  stats() {
    return {
      sseClients:       this.sseClients.size,
      wildcardListeners: this.wildcardListeners.length,
      eventTypes:       this.listeners.size,
      totalListeners:   [...this.listeners.values()].reduce((s, a) => s + a.length, 0),
    };
  }
}

export const eventBus = new EventBus();
