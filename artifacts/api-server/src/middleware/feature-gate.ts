import { db } from "@workspace/db";
import { plansTable, officePageTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

/* ── Simple in-memory cache (1 minute TTL) ── */
let _cache: { flags: Record<string, boolean>; ts: number } | null = null;
const TTL = 60_000;

export async function getOfficeFeatureFlags(): Promise<Record<string, boolean>> {
  if (_cache && Date.now() - _cache.ts < TTL) return _cache.flags;
  try {
    const offices = await db.select({ plan: officePageTable.plan }).from(officePageTable).limit(1);
    const slug = offices[0]?.plan ?? "free";
    const plans = await db.select({ featureFlags: plansTable.featureFlags }).from(plansTable).where(eq(plansTable.slug, slug)).limit(1);
    const flags = (plans[0]?.featureFlags ?? {}) as Record<string, boolean>;
    _cache = { flags, ts: Date.now() };
    return flags;
  } catch {
    return {};
  }
}

/* Invalidate cache after a plan change */
export function invalidateFeatureCache(): void {
  _cache = null;
}

/* Middleware factory — returns 403 if feature is not enabled */
export function requireFeature(featureCode: string) {
  return async (_req: any, res: any, next: any) => {
    const flags = await getOfficeFeatureFlags();
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
