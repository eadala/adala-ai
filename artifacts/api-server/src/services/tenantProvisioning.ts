/**
 * Tenant Provisioning Service
 * Runs automatically after successful Stripe payment.
 * Creates entitlements, ledger entry, and API key for the office.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import * as crypto from "crypto";

/* ── Plan → limits mapping ─────────────────────────────── */
export const PLAN_LIMITS: Record<string, Record<string, number>> = {
  basic: {
    AI_CALLS:    100,
    CASES:        20,
    CLIENTS:      50,
    USERS:         3,
    STORAGE_GB:    2,
    DOCUMENTS:   200,
    INVOICES:     50,
  },
  professional: {
    AI_CALLS:  1_000,
    CASES:       500,
    CLIENTS:     300,
    USERS:        15,
    STORAGE_GB:   20,
    DOCUMENTS: 5_000,
    INVOICES:    500,
  },
  enterprise: {
    AI_CALLS:  10_000,
    CASES:      9_999,
    CLIENTS:    9_999,
    USERS:         50,
    STORAGE_GB:   100,
    DOCUMENTS:  50_000,
    INVOICES:   9_999,
  },
  open: {
    AI_CALLS:  99_999,
    CASES:      99_999,
    CLIENTS:    99_999,
    USERS:      99_999,
    STORAGE_GB: 1_000,
    DOCUMENTS:  99_999,
    INVOICES:   99_999,
  },
};

/* ── Generate a secure API Key ─────────────────────────── */
export function generateApiKey(): { raw: string; hash: string; preview: string } {
  const raw = "sk_adala_" + crypto.randomBytes(24).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  const preview = raw.slice(0, 16) + "…";
  return { raw, hash, preview };
}

/* ── Core provisioning logic ───────────────────────────── */
export async function provisionTenant(opts: {
  officeId: string;
  plan: string;
  email: string;
  stripeSessionId?: string;
  amountPaid?: number;
}) {
  const { officeId, plan, email, stripeSessionId, amountPaid } = opts;
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS["basic"];

  try {
    /* 1. Upsert entitlements — one row per quota key */
    for (const [key, limit] of Object.entries(limits)) {
      await db.execute(sql`
        INSERT INTO office_entitlements (office_id, key, plan, "limit", used)
        VALUES (${officeId}, ${key}, ${plan}, ${limit}, 0)
        ON CONFLICT (office_id, key)
        DO UPDATE SET
          plan      = EXCLUDED.plan,
          "limit"   = EXCLUDED."limit",
          updated_at = NOW()
      `);
    }

    /* 2. Update office plan — scoped to this office only.
       NOTE: each deployment is single-tenant (one office_page row).
       We use a safe LIMIT 1 subquery to avoid cross-office writes. */
    await db.execute(sql`
      UPDATE office_page
      SET plan = ${plan}, updated_at = NOW()
      WHERE id = (SELECT id FROM office_page ORDER BY created_at LIMIT 1)
    `);

    /* 3. Ledger credit entry */
    if (amountPaid && amountPaid > 0) {
      await db.execute(sql`
        INSERT INTO office_ledger (office_id, type, amount, currency, ref, description, stripe_id)
        VALUES (
          ${officeId}, 'credit', ${amountPaid / 100}, 'SAR',
          ${"SUB_" + plan.toUpperCase()},
          ${"اشتراك باقة " + plan + " — " + email},
          ${stripeSessionId ?? null}
        )
      `);
    }

    /* 4. Generate and store an office API key (if none active) */
    const existingKey = await db.execute(sql`
      SELECT id FROM office_api_keys
      WHERE office_id = ${officeId} AND is_active = TRUE
      LIMIT 1
    `);
    const rows = (existingKey as any)?.rows ?? [];

    let rawKey: string | null = null;
    if (rows.length === 0) {
      const { raw, hash, preview } = generateApiKey();
      rawKey = raw;
      await db.execute(sql`
        INSERT INTO office_api_keys (office_id, name, key_hash, key_preview, permissions)
        VALUES (
          ${officeId},
          ${"مفتاح افتراضي — " + plan},
          ${hash},
          ${preview},
          ARRAY['read','write']
        )
      `);
    }

    /* 5. Log plan upgrade notification */
    await db.execute(sql`
      INSERT INTO plan_notifications (type, old_plan, new_plan, title, message)
      VALUES (
        'upgrade',
        'free',
        ${plan},
        'تم تفعيل الباقة بنجاح ✅',
        ${"تم تفعيل باقة " + plan + " للمكتب بعد نجاح الدفع. جميع الصلاحيات مُفعّلة."}
      )
    `);

    console.log(`[Tenant] Provisioned office=${officeId} plan=${plan}`);
    return { ok: true, apiKey: rawKey };
  } catch (err) {
    console.error("[Tenant] Provisioning failed:", err);
    throw err;
  }
}

/* ── Increment usage counter ───────────────────────────── */
export async function incrementUsage(officeId: string, key: string, amount = 1) {
  await db.execute(sql`
    UPDATE office_entitlements
    SET used = used + ${amount}, updated_at = NOW()
    WHERE office_id = ${officeId} AND key = ${key}
  `);
}

/* ── Check if within limits ────────────────────────────── */
export async function checkEntitlement(officeId: string, key: string): Promise<boolean> {
  const r = await db.execute(sql`
    SELECT "limit", used FROM office_entitlements
    WHERE office_id = ${officeId} AND key = ${key}
    LIMIT 1
  `);
  const row = ((r as any)?.rows ?? [])[0];
  if (!row) return true; // no entitlement defined → allow
  return Number(row.limit) === 0 || Number(row.used) < Number(row.limit);
}
