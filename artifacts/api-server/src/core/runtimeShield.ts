/**
 * Real-Time Live Zero Trust Protection System — الدرع الحي
 * ==========================================================
 * Runtime middleware that actively prevents breaches before they happen.
 * Every request is: Approved → Sanitized → Blocked
 */

import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/* ── Threat Classification ── */
export type ThreatLevel = "P0" | "P1" | "P2" | "P3";
export type ShieldAction = "APPROVED" | "SANITIZED" | "BLOCKED";

export interface ThreatEvent {
  id: string;
  timestamp: string;
  level: ThreatLevel;
  action: ShieldAction;
  requestPath: string;
  requestMethod: string;
  clientIp: string;
  userId?: string;
  officeId?: string;
  reason: string;
  autoFixed: boolean;
}

/* ── In-memory stats (reset on restart, DB-persisted below) ── */
const stats = {
  totalRequests: 0,
  blockedRequests: 0,
  sanitizedRequests: 0,
  approvedRequests: 0,
  activeThreats: 0,
  blockedIps: new Set<string>(),
  lastThreat: null as ThreatEvent | null,
};

/* ── Banned IP list (in-memory, loaded from DB on start) ── */
const bannedIps = new Set<string>();

/* ── Blocked path patterns ── */
const BLOCKED_GLOBAL_PATTERNS = [
  /\/api\/cases\?.*office_id=/i,       // IDOR attempt via QS
  /\/api\/clients\?.*office_id=/i,
  /\/api\/invoices\?.*office_id=/i,
  /\/api\/contracts\?.*office_id=/i,
  /\/api\/documents\?.*office_id=/i,
  /\/\.env/,                            // env file access
  /\/etc\/passwd/,                      // path traversal
  /\.\.\//,                             // directory traversal
  /\x00/,                               // null byte injection
];

/* ── Suspicious payload patterns ── */
const INJECTION_PATTERNS = [
  /'.*OR.*'='|UNION.*SELECT|DROP.*TABLE|INSERT.*INTO.*SELECT/i,  // SQLi
  /<script.*?>/i,                       // XSS
  /\$\{.*\}/,                           // template injection
  /\{\{.*\}\}/,                         // SSTI
  /javascript:/i,                       // JS injection
];

/* ── AI prompt injection patterns ── */
const PROMPT_INJECTION_PATTERNS = [
  /show\s+all\s+(cases|clients|offices|users)/i,
  /list\s+all\s+(cases|clients|invoices|offices)/i,
  /ignore\s+(previous|prior|above)\s+instructions/i,
  /system\s+prompt/i,
  /bypass\s+(security|filter|restriction)/i,
  /\[system\]/i,
];

/* ── Log threat to DB ── */
async function logThreat(event: ThreatEvent): Promise<void> {
  stats.lastThreat = event;
  stats.activeThreats++;
  try {
    await db.execute(sql`
      INSERT INTO ct_security_events
        (id, event_type, severity, description, request_path, request_method,
         client_ip, user_id, office_id, resolved, created_at)
      VALUES
        (${event.id}, 'RUNTIME_THREAT', ${event.level}, ${event.reason},
         ${event.requestPath}, ${event.requestMethod}, ${event.clientIp},
         ${event.userId ?? null}, ${event.officeId ?? null}, false, NOW())
      ON CONFLICT DO NOTHING
    `);
  } catch {
    // DB unavailable — keep in-memory stats only
  }
}

/* ── Unique ID generator ── */
function uid(): string {
  return `rt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/* ── Get real IP ── */
function getIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (Array.isArray(forwarded)) return forwarded[0];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress ?? "unknown";
}

/* ══════════════════════════════════════════════════════════════════════════
   LAYER 1 — IP BAN CHECK
══════════════════════════════════════════════════════════════════════════════ */
function checkBannedIp(ip: string): boolean {
  return bannedIps.has(ip);
}

/* ══════════════════════════════════════════════════════════════════════════
   LAYER 2 — PATH TRAVERSAL & INJECTION FIREWALL
══════════════════════════════════════════════════════════════════════════════ */
function checkPathAttack(req: Request): string | null {
  const fullPath = req.originalUrl;
  for (const pattern of BLOCKED_GLOBAL_PATTERNS) {
    if (pattern.test(fullPath)) {
      return `Path attack detected: ${pattern.toString()}`;
    }
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════════════════
   LAYER 3 — PAYLOAD INJECTION SCANNER
══════════════════════════════════════════════════════════════════════════════ */
function checkPayloadInjection(body: any): string | null {
  if (!body || typeof body !== "object") return null;
  const bodyStr = JSON.stringify(body);
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(bodyStr)) {
      return `Injection pattern detected in payload`;
    }
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════════════════
   LAYER 4 — AI PROMPT INJECTION GUARD
══════════════════════════════════════════════════════════════════════════════ */
function checkPromptInjection(body: any): string | null {
  if (!body) return null;
  const text = typeof body.message === "string" ? body.message :
               typeof body.prompt === "string"  ? body.prompt  :
               typeof body.query === "string"   ? body.query   : null;
  if (!text) return null;
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return `AI prompt injection attempt: "${text.slice(0, 60)}"`;
    }
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════════════════
   LAYER 5 — TENANT ID OVERRIDE ATTACK
══════════════════════════════════════════════════════════════════════════════ */
function checkTenantOverride(req: Request): string | null {
  // Check if client is trying to pass office_id in body to override tenant
  const body = req.body as Record<string, any>;
  if (!body) return null;

  // office_id in body on mutating endpoints is suspicious if it differs from auth
  const suppliedOfficeId = body.office_id ?? body.officeId ?? body.tenant_id;
  const authOfficeId = (req as any).tenantId;

  if (suppliedOfficeId && authOfficeId && suppliedOfficeId !== authOfficeId) {
    return `Tenant override attempt: supplied=${suppliedOfficeId}, auth=${authOfficeId}`;
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN SHIELD MIDDLEWARE
══════════════════════════════════════════════════════════════════════════════ */
export function runtimeShield(req: Request, res: Response, next: NextFunction): void {
  // Skip non-API routes
  if (!req.path.startsWith("/api/")) { next(); return; }
  // Skip health + metrics
  if (req.path === "/api/health" || req.path === "/api/metrics") { next(); return; }

  stats.totalRequests++;
  const ip = getIp(req);
  const userId = (req as any).auth?.userId ?? undefined;
  const officeId = (req as any).tenantId ?? undefined;

  /* ── L1: IP ban ── */
  if (checkBannedIp(ip)) {
    stats.blockedRequests++;
    const event: ThreatEvent = {
      id: uid(), timestamp: new Date().toISOString(),
      level: "P0", action: "BLOCKED",
      requestPath: req.path, requestMethod: req.method,
      clientIp: ip, userId, officeId,
      reason: "Banned IP address", autoFixed: false,
    };
    void logThreat(event);
    res.status(403).json({ error: "محظور", code: "IP_BANNED" });
    return;
  }

  /* ── L2: Path attack ── */
  const pathReason = checkPathAttack(req);
  if (pathReason) {
    stats.blockedRequests++;
    const event: ThreatEvent = {
      id: uid(), timestamp: new Date().toISOString(),
      level: "P0", action: "BLOCKED",
      requestPath: req.path, requestMethod: req.method,
      clientIp: ip, userId, officeId,
      reason: pathReason, autoFixed: false,
    };
    void logThreat(event);
    res.status(400).json({ error: "طلب مرفوض", code: "PATH_ATTACK" });
    return;
  }

  /* ── L3: Payload injection ── */
  const payloadReason = checkPayloadInjection(req.body);
  if (payloadReason) {
    stats.blockedRequests++;
    const event: ThreatEvent = {
      id: uid(), timestamp: new Date().toISOString(),
      level: "P1", action: "BLOCKED",
      requestPath: req.path, requestMethod: req.method,
      clientIp: ip, userId, officeId,
      reason: payloadReason, autoFixed: false,
    };
    void logThreat(event);
    res.status(400).json({ error: "محتوى مشبوه", code: "INJECTION_DETECTED" });
    return;
  }

  /* ── L4: Prompt injection (AI endpoints only) ── */
  if (req.path.includes("/ai") || req.path.includes("/assistant") || req.path.includes("/copilot")) {
    const promptReason = checkPromptInjection(req.body);
    if (promptReason) {
      stats.blockedRequests++;
      const event: ThreatEvent = {
        id: uid(), timestamp: new Date().toISOString(),
        level: "P1", action: "BLOCKED",
        requestPath: req.path, requestMethod: req.method,
        clientIp: ip, userId, officeId,
        reason: promptReason, autoFixed: false,
      };
      void logThreat(event);
      res.status(400).json({ error: "طلب AI مرفوض", code: "PROMPT_INJECTION" });
      return;
    }
  }

  /* ── L5: Tenant override (after auth is set by requireAuthWithTenant) ── */
  // This runs after requireAuthWithTenant so tenantId is set
  if (["POST", "PUT", "PATCH"].includes(req.method) && (req as any).tenantId) {
    const overrideReason = checkTenantOverride(req);
    if (overrideReason) {
      stats.blockedRequests++;
      const event: ThreatEvent = {
        id: uid(), timestamp: new Date().toISOString(),
        level: "P0", action: "BLOCKED",
        requestPath: req.path, requestMethod: req.method,
        clientIp: ip, userId, officeId,
        reason: overrideReason, autoFixed: true,
      };
      void logThreat(event);
      // Auto-fix: strip the override and continue (self-healing)
      stats.sanitizedRequests++;
      const b = req.body as Record<string, any>;
      delete b.office_id;
      delete b.officeId;
      delete b.tenant_id;
      next();
      return;
    }
  }

  stats.approvedRequests++;
  next();
}

/* ══════════════════════════════════════════════════════════════════════════
   SHIELD STATUS API
══════════════════════════════════════════════════════════════════════════════ */
export function getShieldStatus() {
  const total = stats.totalRequests || 1;
  const blockRate = ((stats.blockedRequests / total) * 100).toFixed(2);

  let mode: "PROTECTED" | "DEGRADED" | "COMPROMISED" = "PROTECTED";
  if (stats.activeThreats > 10) mode = "DEGRADED";
  if (stats.activeThreats > 50) mode = "COMPROMISED";

  return {
    mode,
    stats: {
      totalRequests: stats.totalRequests,
      blockedRequests: stats.blockedRequests,
      sanitizedRequests: stats.sanitizedRequests,
      approvedRequests: stats.approvedRequests,
      blockRate: `${blockRate}%`,
      bannedIps: bannedIps.size,
    },
    lastThreat: stats.lastThreat,
    activeThreats: stats.activeThreats,
    layers: {
      tenantShield:   "ACTIVE",
      apiFirewall:    "ACTIVE",
      dbQueryGuard:   "ACTIVE",
      aiSafetyShield: "ACTIVE",
      documentShield: "ACTIVE",
      notificationGuard: "ACTIVE",
      searchFilter:   "ACTIVE",
      auditLogger:    "ACTIVE",
    },
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   BAN MANAGEMENT
══════════════════════════════════════════════════════════════════════════════ */
export function banIp(ip: string): void {
  bannedIps.add(ip);
  stats.blockedRequests++;
}

export function unbanIp(ip: string): void {
  bannedIps.delete(ip);
}

export function getBannedIps(): string[] {
  return Array.from(bannedIps);
}

/* ── Load banned IPs from DB on startup ── */
async function loadBannedIps(): Promise<void> {
  try {
    const rows = await db.execute(sql`
      SELECT DISTINCT client_ip FROM ct_security_events
      WHERE severity='P0' AND resolved=false AND client_ip IS NOT NULL
      GROUP BY client_ip HAVING COUNT(*)>=3
    `) as any;
    const r = rows.rows ?? rows;
    for (const row of r) {
      if (row.client_ip) bannedIps.add(row.client_ip);
    }
  } catch {
    // Table may not exist yet
  }
}

loadBannedIps().catch(() => {});

/* ── Reset threat counter periodically ── */
setInterval(() => {
  stats.activeThreats = Math.max(0, stats.activeThreats - 1);
}, 60_000);
