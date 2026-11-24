/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion -- pre-existing lint debt; schema authority */
/**
 * عدالة AI — Event Bus Core
 * Persistent, type-safe event bus with SSE real-time broadcasting
 *
 * Stage 17 (SSE) — tenant-owned SSE delivery is scoped to the client's
 * canonical Office UUID. Never invent default / platform / trial_* ownership.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { Response } from "express";
import { isUuid } from "../lib/officePageResolverLogic";
import {
  SseTenantHub,
  resolveSseOfficeId,
} from "../lib/sseTenantIsolation";

export { resolveSseOfficeId } from "../lib/sseTenantIsolation";

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
  | "SESSION_REMINDER"
  | "TASK_DUE"
  /* ── Internal Messaging ── */
  | "NEW_MESSAGE"
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
/* system_events schema: artifacts/api-server/migrations/005_tenant_platform_tables.sql */

/* ── Event Bus ────────────────────────────────────────── */
export class EventBus {
  private listeners: Map<string, EventHandler[]> = new Map();
  private wildcardListeners: EventHandler[] = [];
  private readonly sse = new SseTenantHub();

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

    /* 1. Persist to DB (non-blocking).
       Stage 15.2e — never invent "default"; only persist canonical Office UUID or NULL. */
    const persistOfficeId =
      stored.officeId && isUuid(String(stored.officeId)) ? String(stored.officeId) : null;
    db.execute(sql`
      INSERT INTO system_events (id, event_type, office_id, actor_id, payload, created_at)
      VALUES (
        ${stored.id}::uuid,
        ${stored.type},
        ${persistOfficeId},
        ${stored.actorId ?? null},
        ${JSON.stringify(stored.data)}::jsonb,
        ${stored.timestamp}::timestamp
      )
    `).catch((e: unknown) => console.error("[EventBus] persist error:", (e as Error).message));

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

    /* 4. Broadcast to SSE clients (tenant-scoped) */
    this.broadcastSSE(stored);

    return stored;
  }

  /* ── SSE client management ──────────────────────────── */

  /**
   * Register a client connection.
   * - userId enables targeted delivery via sendToUsers (private messages).
   * - officeId enables tenant event broadcast only when it is a canonical Office UUID.
   */
  addSSEClient(res: Response, userId?: string, officeId?: string | null): void {
    this.sse.addSSEClient(res, userId, officeId);
  }

  /**
   * Send an SSE event ONLY to the specified user IDs.
   * Does NOT persist to DB and does NOT broadcast to other clients.
   * Use for private events like new messages.
   * Authorization is caller-owned (explicit recipient list) — not global fan-out.
   */
  sendToUsers(userIds: string[], event: Record<string, any>): void {
    this.sse.sendToUsers(userIds, event);
  }

  /**
   * Tenant-isolated SSE fan-out (see SseTenantHub.broadcastSSE).
   * Fail closed for missing / non-canonical event.officeId.
   */
  broadcastSSE(event: StoredEvent): void {
    this.sse.broadcastSSE(event);
  }

  get clientCount(): number { return this.sse.clientCount; }

  get tenantSseOfficeCount(): number { return this.sse.tenantSseOfficeCount; }
}

export const eventBus = new EventBus();
