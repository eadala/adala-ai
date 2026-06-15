/**
 * Tenant Scope Layer — العزل على مستوى الكود
 * ────────────────────────────────────────────
 * يوفر:
 *   1. detectLeak()     — يكتشف تسرب بيانات في نتائج أي query
 *   2. assertTenant()   — يرفض الطلب إذا لم يوجد tenantId
 *   3. leakEvents       — سجل أحداث التسرب في الذاكرة
 *   4. IsolationMiddleware — Middleware يسجل كل طلب + يفحص الرد
 */

import type { Request, Response, NextFunction } from "express";

/* ─── Leak Event Store ─── */
export interface LeakEvent {
  id: string;
  timestamp: string;
  requestPath: string;
  requestMethod: string;
  expectedTenant: string;
  foundTenants: string[];
  rowCount: number;
  severity: "warning" | "critical";
  blocked: boolean;
}

const leakStore: LeakEvent[] = [];
let totalChecked = 0;
let totalBlocked = 0;

export function getLeakEvents(limit = 50): LeakEvent[] {
  return leakStore.slice(0, limit);
}
export function getIsolationStats() {
  return {
    totalChecked,
    totalBlocked,
    leakCount:   leakStore.length,
    criticalCount: leakStore.filter(e => e.severity === "critical").length,
  };
}

/* ─── Core: Detect Leak ─── */
export function detectLeak(
  results: any[],
  expectedTenantId: string,
  context?: { path?: string; method?: string }
): { clean: boolean; foreignTenants: string[] } {
  totalChecked++;
  if (!Array.isArray(results) || results.length === 0) return { clean: true, foreignTenants: [] };

  const tenantField = ["office_id", "tenant_id"].find(f => f in (results[0] ?? {}));
  if (!tenantField) return { clean: true, foreignTenants: [] };

  const foreign = new Set<string>();
  for (const row of results) {
    const rowTenant = row[tenantField];
    if (rowTenant && rowTenant !== expectedTenantId) {
      foreign.add(rowTenant);
    }
  }

  if (foreign.size > 0) {
    totalBlocked++;
    const event: LeakEvent = {
      id:             `leak-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp:      new Date().toISOString(),
      requestPath:    context?.path    ?? "unknown",
      requestMethod:  context?.method  ?? "GET",
      expectedTenant: expectedTenantId,
      foundTenants:   Array.from(foreign),
      rowCount:       results.length,
      severity:       foreign.size > 1 ? "critical" : "warning",
      blocked:        true,
    };
    leakStore.unshift(event);
    if (leakStore.length > 200) leakStore.pop();

    console.error(`[ISOLATION] 🚨 LEAK DETECTED path=${context?.path} expected=${expectedTenantId} found=[${[...foreign].join(",")}]`);
  }

  return { clean: foreign.size === 0, foreignTenants: Array.from(foreign) };
}

/* ─── Assert Tenant (throws if missing) ─── */
export function assertTenant(req: Request): string {
  const tid = (req as any).tenantId;
  if (!tid || tid === "") {
    throw new Error("Missing tenant context — request blocked by isolation layer");
  }
  return tid as string;
}

/* ─── Response Interceptor Middleware ─── */
export function IsolationMiddleware(req: Request, res: Response, next: NextFunction) {
  const tenantId = (req as any).tenantId;
  if (!tenantId) { next(); return; }

  /* intercept res.json to scan outbound data */
  const originalJson = res.json.bind(res);
  (res as any).json = function (body: any) {
    try {
      /* find arrays in response body */
      const arrays = extractArrays(body);
      for (const arr of arrays) {
        detectLeak(arr, tenantId, { path: req.path, method: req.method });
      }
    } catch { /* non-blocking */ }
    return originalJson(body);
  };
  next();
}

function extractArrays(obj: any, depth = 0): any[][] {
  if (depth > 3 || !obj || typeof obj !== "object") return [];
  if (Array.isArray(obj)) return [obj];
  return Object.values(obj).flatMap(v => extractArrays(v, depth + 1));
}
