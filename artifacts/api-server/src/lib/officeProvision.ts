/**
 * Canonical transactional office provisioning.
 * Creates office_page (UUID) + registry + membership (+ optional trial/onboarding)
 * in one DB transaction. Fail-closed; never returns trial_*, default, platform, or NULL.
 */
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { isUuid } from "./officePageResolverLogic";

export const FORBIDDEN_OFFICE_IDS = new Set(["default", "platform", "null", "undefined", ""]);

export type OfficeProvisionLifecycle = "trial" | "marketplace" | "paid";

export type ProvisionOfficeContext =
  | "marketplace"
  | "onboarding_setup"
  | "onboarding_state"
  | "admin";

export type ProvisionOfficeForUserInput = {
  ownerUserId: string;
  officeName: string;
  /** office_page.plan / registry plan_name */
  plan?: string;
  lifecycle: OfficeProvisionLifecycle;
  /** Stable provisioning context for idempotency + logging */
  context: ProvisionOfficeContext;
  specialty?: string;
  officeSize?: string;
  ownerEmail?: string;
  ownerName?: string;
  /** Optional office_page fields (marketplace create body) */
  page?: {
    slug?: string;
    tagline?: string;
    about?: string;
    phone?: string;
    email?: string;
    city?: string;
    address?: string;
    logo?: string;
    isPublished?: boolean;
    primaryColor?: string;
    [key: string]: unknown;
  };
  /** Persist trial_offices lifecycle row (default: lifecycle === "trial") */
  writeTrialOffices?: boolean;
  setupData?: unknown;
  /** Upsert onboarding_state when provided */
  onboarding?: {
    completed?: boolean;
    step?: number;
    data?: unknown;
  };
};

export type ProvisionOfficeForUserResult = {
  officeId: string;
  created: boolean;
  slug: string;
};

export class OfficeProvisionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "OfficeProvisionError";
    this.code = code;
  }
}

type TxLike = {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
};

export type OfficeProvisionDb = {
  transaction: <T>(fn: (tx: TxLike) => Promise<T>) => Promise<T>;
};

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const withRows = result as { rows?: Record<string, unknown>[] } | null;
  return withRows?.rows ?? [];
}

function firstRow(result: unknown): Record<string, unknown> | null {
  return rowsOf(result)[0] ?? null;
}

export function assertCanonicalOfficeId(officeId: string | null | undefined): string {
  if (officeId == null || FORBIDDEN_OFFICE_IDS.has(String(officeId).toLowerCase())) {
    throw new OfficeProvisionError(
      "INVALID_OFFICE_ID",
      `Refusing non-canonical office id: ${String(officeId)}`,
    );
  }
  if (String(officeId).startsWith("trial_")) {
    throw new OfficeProvisionError(
      "INVALID_OFFICE_ID",
      `Refusing trial_* office id: ${officeId}`,
    );
  }
  if (!isUuid(String(officeId))) {
    throw new OfficeProvisionError(
      "INVALID_OFFICE_ID",
      `Refusing non-UUID office id: ${officeId}`,
    );
  }
  return String(officeId);
}

function slugifyName(name: string, officeId: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const suffix = officeId.slice(0, 8);
  return (base || "office") + "-" + suffix;
}

function defaultOwnerEmail(ownerUserId: string, pageEmail?: string): string {
  if (pageEmail && String(pageEmail).includes("@")) return String(pageEmail);
  return `${ownerUserId}@users.clerk.local`;
}

async function defaultDb(): Promise<OfficeProvisionDb> {
  const { db } = await import("@workspace/db");
  return db as unknown as OfficeProvisionDb;
}

/**
 * Resolve an existing canonical UUID office for this user (idempotency).
 * Prefers registry → trial_offices → active UUID membership.
 * Throws LEGACY_NON_UUID when only a non-UUID tenant exists (no remap in this stage).
 */
async function resolveExistingCanonicalOfficeId(
  tx: TxLike,
  ownerUserId: string,
): Promise<string | null> {
  const reg = firstRow(
    await tx.execute(sql`
      SELECT id FROM office_registry
      WHERE clerk_user_id = ${ownerUserId} AND status = 'active'
      LIMIT 1
    `),
  );
  const regId = reg?.id != null ? String(reg.id) : null;
  if (regId) {
    if (isUuid(regId)) {
      const page = firstRow(
        await tx.execute(sql`
          SELECT id FROM office_page WHERE id = ${regId}::uuid LIMIT 1
        `),
      );
      if (page?.id) return assertCanonicalOfficeId(String(page.id));
    } else {
      throw new OfficeProvisionError(
        "LEGACY_NON_UUID",
        `User ${ownerUserId} already has non-UUID office_registry.id=${regId}; remap deferred`,
      );
    }
  }

  const trial = firstRow(
    await tx.execute(sql`
      SELECT office_id FROM trial_offices WHERE user_id = ${ownerUserId} LIMIT 1
    `),
  );
  const trialId = trial?.office_id != null ? String(trial.office_id) : null;
  if (trialId) {
    if (isUuid(trialId)) {
      const page = firstRow(
        await tx.execute(sql`
          SELECT id FROM office_page WHERE id = ${trialId}::uuid LIMIT 1
        `),
      );
      if (page?.id) return assertCanonicalOfficeId(String(page.id));
      /* UUID claimed in trial_offices but page missing — continue to recreate atomically below */
    } else {
      throw new OfficeProvisionError(
        "LEGACY_NON_UUID",
        `User ${ownerUserId} already has non-UUID trial_offices.office_id=${trialId}; remap deferred`,
      );
    }
  }

  const member = firstRow(
    await tx.execute(sql`
      SELECT office_id FROM office_members
      WHERE user_id = ${ownerUserId} AND status = 'active'
      ORDER BY created_at ASC NULLS LAST
      LIMIT 1
    `),
  );
  const memberId = member?.office_id != null ? String(member.office_id) : null;
  if (memberId) {
    if (isUuid(memberId)) {
      const page = firstRow(
        await tx.execute(sql`
          SELECT id FROM office_page WHERE id = ${memberId}::uuid LIMIT 1
        `),
      );
      if (page?.id) return assertCanonicalOfficeId(String(page.id));
    } else {
      throw new OfficeProvisionError(
        "LEGACY_NON_UUID",
        `User ${ownerUserId} already has non-UUID office_members.office_id=${memberId}; remap deferred`,
      );
    }
  }

  return null;
}

async function ensureSatelliteRecords(
  tx: TxLike,
  officeId: string,
  input: ProvisionOfficeForUserInput,
): Promise<void> {
  const plan = input.plan ?? (input.lifecycle === "trial" ? "trial" : "starter");
  const officeName = input.officeName?.trim() || "مكتب المحاماة";
  const ownerEmail = defaultOwnerEmail(input.ownerUserId, input.page?.email as string | undefined);
  const writeTrial =
    input.writeTrialOffices ?? input.lifecycle === "trial";

  await tx.execute(sql`
    INSERT INTO office_members (office_id, user_id, role, status)
    VALUES (${officeId}, ${input.ownerUserId}, 'owner', 'active')
    ON CONFLICT (office_id, user_id) DO UPDATE SET
      role = 'owner',
      status = 'active',
      updated_at = NOW()
  `);

  /* Prevent a second active owner membership for the same user under another office */
  const extras = rowsOf(
    await tx.execute(sql`
      SELECT office_id FROM office_members
      WHERE user_id = ${input.ownerUserId}
        AND status = 'active'
        AND office_id <> ${officeId}
    `),
  );
  if (extras.length > 0) {
    throw new OfficeProvisionError(
      "DUPLICATE_ACTIVE_MEMBERSHIP",
      `User ${input.ownerUserId} already has another active office membership`,
    );
  }

  /* clerk_user_id is the stable idempotency key (one registry row per owner).
     When creating after an orphan registry row (UUID without office_page), replace id. */
  await tx.execute(sql`
    INSERT INTO office_registry (id, clerk_user_id, owner_email, office_name, owner_name, plan_name, status)
    VALUES (
      ${officeId},
      ${input.ownerUserId},
      ${ownerEmail},
      ${officeName},
      ${input.ownerName ?? null},
      ${plan},
      'active'
    )
    ON CONFLICT (clerk_user_id) DO UPDATE SET
      id = EXCLUDED.id,
      office_name = COALESCE(EXCLUDED.office_name, office_registry.office_name),
      owner_email = COALESCE(EXCLUDED.owner_email, office_registry.owner_email),
      plan_name   = COALESCE(EXCLUDED.plan_name, office_registry.plan_name),
      status      = 'active',
      last_active_at = NOW()
  `);

  await tx.execute(sql`
    UPDATE users SET office_id = ${officeId}
    WHERE id = ${input.ownerUserId}
      AND (office_id IS NULL OR office_id = 'default' OR office_id = ${officeId})
  `);

  if (writeTrial) {
    await tx.execute(sql`
      INSERT INTO trial_offices (user_id, office_id, office_name, specialty, office_size, setup_data)
      VALUES (
        ${input.ownerUserId},
        ${officeId},
        ${officeName},
        ${input.specialty ?? ""},
        ${input.officeSize ?? "solo"},
        ${JSON.stringify(input.setupData ?? {})}::jsonb
      )
      ON CONFLICT (user_id) DO UPDATE SET
        office_id   = EXCLUDED.office_id,
        office_name = EXCLUDED.office_name,
        specialty   = EXCLUDED.specialty,
        office_size = EXCLUDED.office_size,
        setup_data  = EXCLUDED.setup_data
    `);
  }

  if (input.onboarding) {
    const completed = input.onboarding.completed ?? false;
    const step = input.onboarding.step ?? 0;
    const data = input.onboarding.data ?? {};
    await tx.execute(sql`
      INSERT INTO onboarding_state (user_id, office_id, completed, step, data, updated_at)
      VALUES (
        ${input.ownerUserId},
        ${officeId},
        ${completed},
        ${step},
        ${JSON.stringify(data)}::jsonb,
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        office_id  = EXCLUDED.office_id,
        completed  = EXCLUDED.completed,
        step       = EXCLUDED.step,
        data       = EXCLUDED.data,
        updated_at = NOW()
    `);
  }
}

/**
 * Canonical office provisioner. All required writes run in one transaction.
 * Idempotent on ownerUserId (+ existing registry/trial/membership UUID).
 */
export async function provisionOfficeForUser(
  input: ProvisionOfficeForUserInput,
  deps?: { db?: OfficeProvisionDb },
): Promise<ProvisionOfficeForUserResult> {
  if (!input.ownerUserId || input.ownerUserId === "platform") {
    throw new OfficeProvisionError(
      "INVALID_OWNER",
      "ownerUserId is required and must not be the synthetic platform tenant",
    );
  }

  const client = deps?.db ?? (await defaultDb());
  const plan = input.plan ?? (input.lifecycle === "trial" ? "trial" : "starter");
  const officeName = input.officeName?.trim() || "مكتب المحاماة";

  return client.transaction(async (tx) => {
    const existing = await resolveExistingCanonicalOfficeId(tx, input.ownerUserId);
    if (existing) {
      /* Refresh marketplace page fields on idempotent retry when provided */
      if (input.page?.slug || input.officeName) {
        const nextSlug =
          typeof input.page?.slug === "string" && input.page.slug.trim()
            ? input.page.slug.trim()
            : null;
        await tx.execute(sql`
          UPDATE office_page SET
            name = COALESCE(${officeName}, name),
            slug = COALESCE(${nextSlug}, slug),
            updated_at = NOW()
          WHERE id = ${existing}::uuid
        `);
      }
      await ensureSatelliteRecords(tx, existing, input);
      const page = firstRow(
        await tx.execute(sql`
          SELECT id, slug FROM office_page WHERE id = ${existing}::uuid LIMIT 1
        `),
      );
      const officeId = assertCanonicalOfficeId(String(page?.id ?? existing));
      return {
        officeId,
        created: false,
        slug: String(page?.slug ?? ""),
      };
    }

    const officeId = randomUUID();
    assertCanonicalOfficeId(officeId);
    const slug =
      (typeof input.page?.slug === "string" && input.page.slug.trim()) ||
      slugifyName(officeName, officeId);

    const pageEmail =
      (typeof input.page?.email === "string" && input.page.email) || null;
    const tagline =
      (typeof input.page?.tagline === "string" && input.page.tagline) || null;
    const about =
      (typeof input.page?.about === "string" && input.page.about) || null;
    const phone =
      (typeof input.page?.phone === "string" && input.page.phone) || null;
    const city =
      (typeof input.page?.city === "string" && input.page.city) || null;
    const address =
      (typeof input.page?.address === "string" && input.page.address) || null;
    const logo =
      (typeof input.page?.logo === "string" && input.page.logo) || null;
    const isPublished = Boolean(input.page?.isPublished);
    const primaryColor =
      (typeof input.page?.primaryColor === "string" && input.page.primaryColor) ||
      "#C9A84C";

    const inserted = firstRow(
      await tx.execute(sql`
        INSERT INTO office_page (
          id, slug, name, plan, tagline, about, phone, email, city, address,
          logo, is_published, primary_color
        ) VALUES (
          ${officeId}::uuid,
          ${slug},
          ${officeName},
          ${plan},
          ${tagline},
          ${about},
          ${phone},
          ${pageEmail},
          ${city},
          ${address},
          ${logo},
          ${isPublished},
          ${primaryColor}
        )
        RETURNING id, slug
      `),
    );
    if (!inserted?.id) {
      throw new OfficeProvisionError("OFFICE_PAGE_INSERT_FAILED", "office_page insert returned no row");
    }
    const createdId = assertCanonicalOfficeId(String(inserted.id));

    await ensureSatelliteRecords(tx, createdId, input);

    return {
      officeId: createdId,
      created: true,
      slug: String(inserted.slug ?? slug),
    };
  });
}
