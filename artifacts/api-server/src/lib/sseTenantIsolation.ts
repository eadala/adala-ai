/**
 * Stage 17 — tenant-scoped SSE delivery (canonical Office UUID only).
 * Pure / Express-Response only — no DB import (safe for unit tests).
 */
import type { Response } from "express";
import { classifyTenantId } from "./tenantResolution";

export type SseBroadcastEvent = {
  officeId?: string;
  [key: string]: unknown;
};

/**
 * Canonical Office UUID for tenant SSE only.
 * Rejects missing / default / platform / trial_* / arbitrary text.
 * Never invents or remaps ownership.
 */
export function resolveSseOfficeId(raw: unknown): string | null {
  const kind = classifyTenantId(
    raw == null || raw === "" ? null : String(raw),
  );
  if (kind !== "uuid") return null;
  return String(raw);
}

/**
 * In-memory SSE hub with tenant isolation + targeted user delivery.
 * Tenant broadcast requires exact canonical office UUID match.
 */
export class SseTenantHub {
  private sseClients: Set<Response> = new Set();
  private sseClientsByOffice: Map<string, Set<Response>> = new Map();
  private userClients: Map<string, Set<Response>> = new Map();

  /**
   * Register a client connection.
   * - userId enables targeted delivery via sendToUsers.
   * - officeId enables tenant broadcast only when canonical UUID.
   */
  addSSEClient(res: Response, userId?: string, officeId?: string | null): void {
    this.sseClients.add(res);

    const canonicalOffice = resolveSseOfficeId(officeId);
    if (canonicalOffice) {
      let bucket = this.sseClientsByOffice.get(canonicalOffice);
      if (!bucket) {
        bucket = new Set();
        this.sseClientsByOffice.set(canonicalOffice, bucket);
      }
      bucket.add(res);
    }

    if (userId) {
      if (!this.userClients.has(userId)) this.userClients.set(userId, new Set());
      this.userClients.get(userId)!.add(res);
    }

    res.on("close", () => {
      this.sseClients.delete(res);
      if (canonicalOffice) {
        const bucket = this.sseClientsByOffice.get(canonicalOffice);
        if (bucket) {
          bucket.delete(res);
          if (bucket.size === 0) this.sseClientsByOffice.delete(canonicalOffice);
        }
      }
      if (userId) {
        this.userClients.get(userId)?.delete(res);
        if (this.userClients.get(userId)?.size === 0) this.userClients.delete(userId);
      }
    });
  }

  /**
   * Explicit recipient delivery — not global fan-out.
   * Authorization is caller-owned (recipient list).
   */
  sendToUsers(userIds: string[], event: Record<string, unknown>): void {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const uid of userIds) {
      const conns = this.userClients.get(uid);
      if (!conns) continue;
      for (const client of conns) {
        try { client.write(data); } catch { conns.delete(client); }
      }
    }
  }

  /**
   * Tenant-isolated SSE fan-out.
   * Fail closed when event.officeId is missing or non-canonical —
   * never remaps to another tenant and never broadcasts globally.
   */
  broadcastSSE(event: SseBroadcastEvent): void {
    const officeId = resolveSseOfficeId(event.officeId);
    if (!officeId) return;

    const clients = this.sseClientsByOffice.get(officeId);
    if (!clients || clients.size === 0) return;

    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of clients) {
      try {
        client.write(data);
      } catch {
        clients.delete(client);
        this.sseClients.delete(client);
      }
    }
  }

  get clientCount(): number {
    return this.sseClients.size;
  }

  get tenantSseOfficeCount(): number {
    return this.sseClientsByOffice.size;
  }
}
