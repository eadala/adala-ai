/* eslint-disable @typescript-eslint/no-explicit-any -- pre-existing lint debt */
import { db } from "@workspace/db";
import { plansTable, officePageTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

/* ── Per-office in-memory cache (1 minute TTL) ── */
const _cache = new Map<string, { flags: Record<string, boolean>; ts: number }>();
const TTL = 60_000;

export async function getOfficeFeatureFlags(officeId: string): Promise<Record<string, boolean>> {
  if (!officeId || officeId === "default" || officeId === "platform" || officeId === "unknown") {
    return {};
  }
  const hit = _cache.get(officeId);
  if (hit && Date.now() - hit.ts < TTL) return hit.flags;
  try {
    const offices = await db.select({ plan: officePageTable.plan }).from(officePageTable).where(eq(officePageTable.id, officeId as any)).limit(1);
    const slug = offices[0]?.plan ?? "free";
    const plans = await db.select({ featureFlags: plansTable.featureFlags }).from(plansTable).where(eq(plansTable.slug, slug)).limit(1);
    const flags = (plans[0]?.featureFlags ?? {}) as Record<string, boolean>;
    _cache.set(officeId, { flags, ts: Date.now() });
    return flags;
  } catch {
    return {};
  }
}

/* Invalidate cache after a plan change */
export function invalidateFeatureCache(officeId?: string): void {
  if (officeId) _cache.delete(officeId);
  else _cache.clear();
}

/* Middleware factory — returns 403 if feature is not enabled for THIS office */
export function requireFeature(featureCode: string) {
  return async (req: any, res: any, next: any) => {
    const officeId = req?.tenantId as string | undefined;
    if (!officeId || officeId === "default" || officeId === "platform") {
      return res.status(403).json({
        error: "feature_not_available",
        featureCode,
        message: "لا يمكن تحديد المكتب لهذه الميزة.",
      });
    }
    const flags = await getOfficeFeatureFlags(officeId);
    if (!flags[featureCode]) {
      return res.status(403).json({
        error: "feature_not_available",
        featureCode,
        message: "هذه الخدمة غير متاحة في باقتك الحالية. يرجى الترقية للاستفادة من هذه الميزة.",
      });
    }
    next();
  };
}
