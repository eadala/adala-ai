/**
 * Tenant resolution — DB/header lookup for office_id.
 * Canonical auth+tenant binding lives in requireAuth.ts (requireAuthWithTenant).
 */
import { createClerkClient } from "@clerk/express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

let _saClerk2: ReturnType<typeof createClerkClient> | null = null;
async function isSuperAdminUser(userId: string): Promise<boolean> {
  const raw = process.env.SUPER_ADMIN_EMAILS ?? process.env.PLATFORM_OWNER_EMAIL ?? "";
  const saEmails = raw.split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
  if (!saEmails.length) return false;
  try {
    if (!_saClerk2) _saClerk2 = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
    const user = await _saClerk2.users.getUser(userId);
    const email = (user.emailAddresses[0]?.emailAddress ?? "").toLowerCase();
    return saEmails.includes(email) || user.publicMetadata?.role === "super_admin";
  } catch { return false; }
}

const CACHE = new Map<string, { officeId: string; ts: number }>();
const TTL_MS = 5 * 60 * 1000;

export async function resolveTenantId(userId: string, headerTenantId?: string): Promise<string | null> {
  if (headerTenantId) {
    try {
      const memberCheck = await db.execute(sql`
        SELECT 1 FROM office_members
        WHERE user_id = ${userId} AND office_id = ${headerTenantId} AND status = 'active'
        LIMIT 1
      `);
      const isMember = ((memberCheck as any)?.rows ?? []).length > 0;
      if (isMember) return headerTenantId;

      const isSA = await isSuperAdminUser(userId);
      if (isSA) return headerTenantId;
    } catch { /* fall through */ }
  }

  try {
    const imp = await db.execute(sql`
      SELECT impersonated_office_id FROM developer_impersonation
      WHERE super_admin_user_id = ${userId}
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
    `);
    const impOffice = ((imp as any)?.rows ?? [])[0]?.impersonated_office_id as string | undefined;
    if (impOffice) return impOffice;
  } catch {}

  const cached = CACHE.get(userId);
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.officeId;

  try {
    const memberRows = await db.execute(sql`
      SELECT office_id FROM office_members
      WHERE user_id = ${userId} AND status = 'active'
      ORDER BY created_at ASC
      LIMIT 1
    `);
    const memberId = ((memberRows as any)?.rows ?? [])[0]?.office_id as string | undefined;
    if (memberId) {
      CACHE.set(userId, { officeId: memberId, ts: Date.now() });
      return memberId;
    }

    const userRows = await db.execute(sql`
      SELECT office_id FROM users WHERE id = ${userId} LIMIT 1
    `);
    const userOffice = ((userRows as any)?.rows ?? [])[0]?.office_id as string | undefined;
    if (userOffice) {
      CACHE.set(userId, { officeId: userOffice, ts: Date.now() });
      return userOffice;
    }

    const regRows = await db.execute(sql`
      SELECT id FROM office_registry
      WHERE clerk_user_id = ${userId} AND status = 'active'
      LIMIT 1
    `);
    const regOffice = ((regRows as any)?.rows ?? [])[0]?.id as string | undefined;
    if (regOffice) {
      db.execute(sql`
        INSERT INTO office_members (office_id, user_id, role, status)
        VALUES (${regOffice}, ${userId}, 'owner', 'active')
        ON CONFLICT DO NOTHING
      `).catch(() => {});
      db.execute(sql`
        UPDATE users SET office_id = ${regOffice}
        WHERE id = ${userId} AND office_id IS NULL
      `).catch(() => {});
      CACHE.set(userId, { officeId: regOffice, ts: Date.now() });
      return regOffice;
    }

    const trialRows = await db.execute(sql`
      SELECT office_id FROM trial_offices
      WHERE user_id = ${userId}
      LIMIT 1
    `);
    const trialOffice = ((trialRows as any)?.rows ?? [])[0]?.office_id as string | undefined;
    if (trialOffice) {
      db.execute(sql`
        INSERT INTO office_members (office_id, user_id, role, status)
        VALUES (${trialOffice}, ${userId}, 'owner', 'active')
        ON CONFLICT DO NOTHING
      `).catch(() => {});
      db.execute(sql`
        UPDATE users SET office_id = ${trialOffice}
        WHERE id = ${userId} AND office_id IS NULL
      `).catch(() => {});
      CACHE.set(userId, { officeId: trialOffice, ts: Date.now() });
      return trialOffice;
    }

    const onboardRows = await db.execute(sql`
      SELECT 1 FROM onboarding_state
      WHERE user_id = ${userId} AND completed = true
      LIMIT 1
    `);
    const hasOnboarded = ((onboardRows as any)?.rows ?? []).length > 0;
    if (hasOnboarded) {
      const safeId = userId.replace(/[^a-zA-Z0-9]/g, "").slice(-8);
      const newOfficeId = `trial_${safeId}`;
      console.warn(`[TENANT-HEAL-7] Provisioning office ${newOfficeId} for user ${userId}`);
      db.execute(sql`
        INSERT INTO trial_offices (user_id, office_id, office_name)
        VALUES (${userId}, ${newOfficeId}, 'مكتب المحاماة')
        ON CONFLICT (user_id) DO NOTHING
      `).catch(() => {});
      db.execute(sql`
        INSERT INTO office_members (office_id, user_id, role, status)
        VALUES (${newOfficeId}, ${userId}, 'owner', 'active')
        ON CONFLICT (office_id, user_id) DO NOTHING
      `).catch(() => {});
      db.execute(sql`
        UPDATE onboarding_state SET office_id = ${newOfficeId}
        WHERE user_id = ${userId}
          AND (office_id IS NULL OR office_id = 'default')
      `).catch(() => {});
      CACHE.set(userId, { officeId: newOfficeId, ts: Date.now() });
      return newOfficeId;
    }

    console.warn(
      `[TENANT-403] userId=${userId} headerTenant=${headerTenantId ?? "none"} ` +
      `→ all 7 resolution steps failed — no office found`
    );
    return null;
  } catch (err: any) {
    console.error(`[TENANT-ERR] userId=${userId} resolveTenantId threw: ${err?.message ?? err}`);
    return null;
  }
}

export function invalidateTenantCache(userId: string) {
  CACHE.delete(userId);
}
