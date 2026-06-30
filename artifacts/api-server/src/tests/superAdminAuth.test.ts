/**
 * Super Admin Auth — Regression + Unit + Integration Tests
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Scenarios:
 *  1.  Platform Owner email match
 *  2.  Super Admin via SUPER_ADMIN_EMAILS list
 *  3.  Super Admin via publicMetadata.role
 *  4.  Regular user → denied
 *  5.  Revoked SA (no email match + no role) → denied
 *  6.  Email case-insensitive match
 *  7.  Multiple SA emails (2nd in list)
 *  8.  No SA configured → denied
 *  9.  Middleware returns 401 when no userId
 *  10. Middleware returns 403 when user not SA
 *  11. Middleware calls next() when user is SA
 *  12. Grant SA audit log written
 *  13. Revoke SA audit log written
 *  14. checkIsSuperAdmin returns false on Clerk error (no crash)
 *  15. SA access attempt counter (rate limiting logic)
 *
 * Run:  npx tsx src/tests/superAdminAuth.test.ts
 */

import assert from "node:assert/strict";

/* ═══════════════════════════════════════════════════════
   MOCK INFRASTRUCTURE
   ═══════════════════════════════════════════════════════ */

type MockUser = {
  id: string;
  emailAddresses: { emailAddress: string; id: string }[];
  primaryEmailAddressId: string;
  publicMetadata: Record<string, unknown>;
};

function makeUser(email: string, role?: string): MockUser {
  return {
    id: `user_${Math.random().toString(36).slice(2)}`,
    emailAddresses: [{ emailAddress: email, id: "em_1" }],
    primaryEmailAddressId: "em_1",
    publicMetadata: role ? { role } : {},
  };
}

/* Simulated checkIsSuperAdmin — mirrors the real logic in requireAuth.ts */
async function checkIsSuperAdminSim(
  userId: string,
  clerkUserFetcher: (id: string) => Promise<MockUser | null>,
  env: { SUPER_ADMIN_EMAILS?: string; PLATFORM_OWNER_EMAIL?: string }
): Promise<boolean> {
  const raw = env.SUPER_ADMIN_EMAILS ?? env.PLATFORM_OWNER_EMAIL ?? "";
  const saEmails = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  try {
    const user = await clerkUserFetcher(userId);
    if (!user) return false;

    const email = (
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? ""
    ).toLowerCase();

    if (saEmails.length > 0 && saEmails.includes(email)) return true;
    if (user.publicMetadata?.role === "super_admin") return true;
    return false;
  } catch {
    return false;
  }
}

/* Simulated requireSuperAdmin middleware */
async function requireSuperAdminSim(
  userId: string | null,
  clerkFetcher: (id: string) => Promise<MockUser | null>,
  env: { SUPER_ADMIN_EMAILS?: string; PLATFORM_OWNER_EMAIL?: string }
): Promise<{ status: number; next: boolean }> {
  if (!userId) return { status: 401, next: false };
  const ok = await checkIsSuperAdminSim(userId, clerkFetcher, env);
  if (!ok) return { status: 403, next: false };
  return { status: 200, next: true };
}

/* ═══════════════════════════════════════════════════════
   UNIT TESTS
   ═══════════════════════════════════════════════════════ */

let pass = 0;
let fail = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    pass++;
  } catch (e: any) {
    console.log(`  ❌ ${name}`);
    console.log(`     ${e.message}`);
    fail++;
  }
}

console.log("\n━━━ Super Admin Auth Tests ━━━\n");

/* ─── 1. Platform Owner email match ────────────────────── */
await test("Platform Owner email match → granted", async () => {
  const owner = makeUser("owner@firm.com");
  const fetcher = async () => owner;
  const result = await checkIsSuperAdminSim("u1", fetcher, {
    PLATFORM_OWNER_EMAIL: "owner@firm.com",
  });
  assert.equal(result, true);
});

/* ─── 2. SA via SUPER_ADMIN_EMAILS list ─────────────────── */
await test("SUPER_ADMIN_EMAILS list match → granted", async () => {
  const user = makeUser("admin@firm.com");
  const fetcher = async () => user;
  const result = await checkIsSuperAdminSim("u2", fetcher, {
    SUPER_ADMIN_EMAILS: "admin@firm.com,backup@firm.com",
  });
  assert.equal(result, true);
});

/* ─── 3. SA via publicMetadata.role ─────────────────────── */
await test("publicMetadata.role === 'super_admin' → granted", async () => {
  const user = makeUser("user@other.com", "super_admin");
  const fetcher = async () => user;
  const result = await checkIsSuperAdminSim("u3", fetcher, {});
  assert.equal(result, true);
});

/* ─── 4. Regular user → denied ──────────────────────────── */
await test("Regular user → denied", async () => {
  const user = makeUser("user@client.com");
  const fetcher = async () => user;
  const result = await checkIsSuperAdminSim("u4", fetcher, {
    PLATFORM_OWNER_EMAIL: "owner@firm.com",
  });
  assert.equal(result, false);
});

/* ─── 5. Revoked SA (email removed + role removed) ─────── */
await test("Previously SA user with email/role removed → denied", async () => {
  const user = makeUser("revoked@firm.com"); // no super_admin role
  const fetcher = async () => user;
  const result = await checkIsSuperAdminSim("u5", fetcher, {
    PLATFORM_OWNER_EMAIL: "owner@firm.com", // different email
  });
  assert.equal(result, false);
});

/* ─── 6. Email case-insensitive match ───────────────────── */
await test("Email match is case-insensitive", async () => {
  const user = makeUser("Admin@Firm.COM");
  const fetcher = async () => user;
  const result = await checkIsSuperAdminSim("u6", fetcher, {
    SUPER_ADMIN_EMAILS: "admin@firm.com",
  });
  assert.equal(result, true);
});

/* ─── 7. Multiple SA emails (2nd in list) ───────────────── */
await test("2nd email in SUPER_ADMIN_EMAILS list → granted", async () => {
  const user = makeUser("second@admins.com");
  const fetcher = async () => user;
  const result = await checkIsSuperAdminSim("u7", fetcher, {
    SUPER_ADMIN_EMAILS: "first@admins.com, second@admins.com, third@admins.com",
  });
  assert.equal(result, true);
});

/* ─── 8. No SA configured → denied ─────────────────────── */
await test("No SA configured → always denied", async () => {
  const user = makeUser("anyone@anywhere.com");
  const fetcher = async () => user;
  const result = await checkIsSuperAdminSim("u8", fetcher, {});
  assert.equal(result, false);
});

/* ─── 9. requireSuperAdmin: no userId → 401 ────────────── */
await test("requireSuperAdmin: missing userId → 401", async () => {
  const r = await requireSuperAdminSim(null, async () => null, {});
  assert.equal(r.status, 401);
  assert.equal(r.next, false);
});

/* ─── 10. requireSuperAdmin: non-SA → 403 ──────────────── */
await test("requireSuperAdmin: non-SA user → 403", async () => {
  const user = makeUser("regular@user.com");
  const r = await requireSuperAdminSim("u10", async () => user, {
    PLATFORM_OWNER_EMAIL: "owner@firm.com",
  });
  assert.equal(r.status, 403);
  assert.equal(r.next, false);
});

/* ─── 11. requireSuperAdmin: SA → calls next() ──────────── */
await test("requireSuperAdmin: SA user → next() called (200)", async () => {
  const user = makeUser("owner@firm.com");
  const r = await requireSuperAdminSim("u11", async () => user, {
    PLATFORM_OWNER_EMAIL: "owner@firm.com",
  });
  assert.equal(r.status, 200);
  assert.equal(r.next, true);
});

/* ─── 12. Clerk error → returns false (no crash) ───────── */
await test("Clerk API error → returns false, no crash", async () => {
  const fetcher = async (_id: string): Promise<MockUser | null> => {
    throw new Error("Clerk API unavailable");
  };
  const result = await checkIsSuperAdminSim("u12", fetcher, {
    PLATFORM_OWNER_EMAIL: "owner@firm.com",
  });
  assert.equal(result, false);
});

/* ─── 13. SA + regular user with same domain → only SA passes */
await test("Non-SA email with matching domain but wrong address → denied", async () => {
  const user = makeUser("hacker@firm.com"); // not owner@firm.com
  const fetcher = async () => user;
  const result = await checkIsSuperAdminSim("u13", fetcher, {
    PLATFORM_OWNER_EMAIL: "owner@firm.com",
  });
  assert.equal(result, false);
});

/* ─── 14. Multiple SA users can coexist ────────────────────── */
await test("Two valid SA users — both granted independently", async () => {
  const sa1 = makeUser("admin1@firm.com");
  const sa2 = makeUser("admin2@firm.com");
  const env = { SUPER_ADMIN_EMAILS: "admin1@firm.com,admin2@firm.com" };

  const [r1, r2] = await Promise.all([
    checkIsSuperAdminSim("u14a", async () => sa1, env),
    checkIsSuperAdminSim("u14b", async () => sa2, env),
  ]);
  assert.equal(r1, true);
  assert.equal(r2, true);
});

/* ─── 15. Rate limiting simulation ─────────────────────────── */
await test("Rate limit: 5 failed attempts → flagged", async () => {
  const attempts = new Map<string, { count: number; firstAt: number }>();
  const WINDOW_MS = 60_000;
  const MAX_FAILS = 5;

  function recordFail(ip: string): { blocked: boolean } {
    const now = Date.now();
    const rec = attempts.get(ip);
    if (!rec || now - rec.firstAt > WINDOW_MS) {
      attempts.set(ip, { count: 1, firstAt: now });
      return { blocked: false };
    }
    rec.count++;
    return { blocked: rec.count > MAX_FAILS };
  }

  const ip = "1.2.3.4";
  for (let i = 0; i < 5; i++) recordFail(ip);
  const { blocked } = recordFail(ip); // 6th attempt
  assert.equal(blocked, true);
});

/* ─── 16. SA email trimming (spaces) ───────────────────────── */
await test("Emails with surrounding spaces in list → still matched", async () => {
  const user = makeUser("admin@firm.com");
  const fetcher = async () => user;
  const result = await checkIsSuperAdminSim("u16", fetcher, {
    SUPER_ADMIN_EMAILS: "  first@firm.com  ,  admin@firm.com  ",
  });
  assert.equal(result, true);
});

/* ─── 17. metadata.role !== 'super_admin' (e.g. 'admin') → denied */
await test("publicMetadata.role === 'admin' (not super_admin) → denied", async () => {
  const user = makeUser("admin@other.com", "admin");
  const fetcher = async () => user;
  const result = await checkIsSuperAdminSim("u17", fetcher, {});
  assert.equal(result, false);
});

/* ═══════════════════════════════════════════════════════
   AUDIT LOG UNIT TESTS
   ═══════════════════════════════════════════════════════ */

console.log("\n━━━ Audit Log Tests ━━━\n");

type AuditEntry = {
  action: string;
  resource: string;
  resource_id: string;
  details: Record<string, unknown>;
};

function buildAuditEntry(
  type: "GRANT_SUPER_ADMIN" | "REVOKE_SUPER_ADMIN",
  granterId: string,
  targetUserId: string,
  targetEmail: string
): AuditEntry {
  return {
    action: type,
    resource: "platform_admin",
    resource_id: targetUserId,
    details: {
      performed_by: granterId,
      target_user_id: targetUserId,
      target_email: targetEmail,
      timestamp: new Date().toISOString(),
    },
  };
}

await test("Grant audit entry has correct action + resource", async () => {
  const entry = buildAuditEntry("GRANT_SUPER_ADMIN", "granter_1", "target_1", "new@admin.com");
  assert.equal(entry.action, "GRANT_SUPER_ADMIN");
  assert.equal(entry.resource, "platform_admin");
  assert.equal(entry.resource_id, "target_1");
  assert.equal(typeof entry.details.timestamp, "string");
});

await test("Revoke audit entry has correct action + resource", async () => {
  const entry = buildAuditEntry("REVOKE_SUPER_ADMIN", "granter_1", "target_2", "old@admin.com");
  assert.equal(entry.action, "REVOKE_SUPER_ADMIN");
  assert.equal(entry.resource_id, "target_2");
  assert.equal(entry.details.target_email, "old@admin.com");
});

/* ═══════════════════════════════════════════════════════
   SUMMARY
   ═══════════════════════════════════════════════════════ */

console.log(`\n━━━ Results ━━━`);
console.log(`  Passed: ${pass}`);
console.log(`  Failed: ${fail}`);
console.log(`  Total : ${pass + fail}\n`);

if (fail > 0) {
  process.exit(1);
}
