import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getAuth, createClerkClient } from "@clerk/express";
import * as os from "os";
import * as crypto from "crypto";

const router = Router();

/* ── Auth ─────────────────────────────────────────── */
let _clerk: ReturnType<typeof createClerkClient> | null = null;
function getClerk() {
  if (!_clerk) _clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  return _clerk;
}

async function isSuperAdmin(req: any): Promise<boolean> {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) return false;
  try {
    const user = await getClerk().users.getUser(userId);
    const email = user.emailAddresses.find((e: any) => e.id === user.primaryEmailAddressId)?.emailAddress
      ?? user.emailAddresses[0]?.emailAddress ?? "";
    // Check both SUPER_ADMIN_EMAILS (comma-separated) and legacy PLATFORM_OWNER_EMAIL
    const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS ?? process.env.PLATFORM_OWNER_EMAIL ?? "")
      .split(",").map((e: string) => e.trim()).filter(Boolean);
    const byEmail = superAdminEmails.length > 0 && superAdminEmails.includes(email);
    return byEmail || user.publicMetadata?.role === "super_admin";
  } catch { return false; }
}

async function devOnly(req: any, res: any, next: any) {
  if (!(await isSuperAdmin(req))) return res.status(403).json({ error: "غير مصرح" });
  next();
}

/* helper to run safe SQL and return rows */
async function safeRows(query: any): Promise<any[]> {
  try {
    const r = await db.execute(query) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}

function fmt(bytes: number) { return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
function uptimeStr(sec: number) {
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  return d > 0 ? `${d}د ${h}س` : h > 0 ? `${h}س ${m}د` : `${m}د`;
}

/* ══════════════════════════════════════════════════
   SYSTEM INFO
══════════════════════════════════════════════════ */
router.get("/developer/system-info", devOnly, async (_req, res) => {
  const mem = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  /* DB ping */
  let dbStatus = "متصل";
  try { await db.execute(sql`SELECT 1`); } catch { dbStatus = "منقطع"; }

  res.json({
    uptime:       uptimeStr(process.uptime()),
    uptimeSec:    Math.floor(process.uptime()),
    nodeVersion:  process.version,
    platform:     os.platform(),
    arch:         os.arch(),
    hostname:     os.hostname(),
    cpuModel:     os.cpus()[0]?.model ?? "—",
    cpuCores:     os.cpus().length,
    env:          process.env.NODE_ENV ?? "development",
    dbStatus,
    memory: {
      heapUsed:  fmt(mem.heapUsed),
      heapTotal: fmt(mem.heapTotal),
      rss:       fmt(mem.rss),
      external:  fmt(mem.external),
      systemUsed:  fmt(usedMem),
      systemTotal: fmt(totalMem),
      usedPercent: Math.round((usedMem / totalMem) * 100),
    },
  });
});

/* ══════════════════════════════════════════════════
   DATABASE STATS
══════════════════════════════════════════════════ */
router.get("/developer/db-stats", devOnly, async (_req, res) => {
  const TABLES = [
    "cases","clients","contracts","documents","employees","payroll",
    "client_invoices","revenues","expenses","bank_accounts","cash_advances",
    "users","leaves","attendance","backup_jobs","developer_tokens",
    "office_messages","ai_assistant_logs",
  ];

  const stats = await Promise.all(TABLES.map(async (tbl) => {
    try {
      const rows = await safeRows(sql`SELECT COUNT(*)::int AS cnt FROM ${sql.raw(tbl)}`);
      return { table: tbl, count: parseInt(String(rows[0]?.cnt ?? 0)) };
    } catch { return { table: tbl, count: null }; }
  }));

  /* DB size */
  const sizeRows = await safeRows(sql`SELECT pg_size_pretty(pg_database_size(current_database())) AS size`);
  const dbSize = sizeRows[0]?.size ?? "—";

  /* Table sizes */
  const tableSizes = await safeRows(sql`
    SELECT relname AS name,
      pg_size_pretty(pg_total_relation_size(quote_ident(relname))) AS size,
      pg_total_relation_size(quote_ident(relname)) AS bytes
    FROM pg_stat_user_tables
    ORDER BY bytes DESC LIMIT 15
  `);

  res.json({ tables: stats, dbSize, tableSizes });
});

/* ══════════════════════════════════════════════════
   DEVELOPER TOKENS
══════════════════════════════════════════════════ */
router.get("/developer/tokens", devOnly, async (_req, res) => {
  try {
    const rows = await safeRows(sql`SELECT * FROM developer_tokens ORDER BY created_at DESC`);
    /* Mask token: show only first 8 chars */
    res.json(rows.map((r: any) => ({ ...r, tokenPreview: String(r.token ?? "").slice(0, 12) + "…" })));
  } catch { res.status(500).json({ error: "خطأ في جلب التوكنات" }); }
});

router.post("/developer/tokens", devOnly, async (req: any, res) => {
  try {
    const { name, permissions = "read", description, expiresInDays } = req.body;
    if (!name) return res.status(400).json({ error: "الاسم مطلوب" });
    const token = "devtk_" + crypto.randomBytes(24).toString("hex");
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86400_000).toISOString()
      : null;
    const createdBy = getAuth(req)?.userId ?? "unknown";
    const rows = await safeRows(sql`
      INSERT INTO developer_tokens (name, token, permissions, description, created_by, expires_at)
      VALUES (${name}, ${token}, ${permissions}, ${description ?? null}, ${createdBy}, ${expiresAt})
      RETURNING *
    `);
    /* Return full token only on creation */
    res.json({ ...rows[0], token });
  } catch (e) {  res.status(500).json({ error: "خطأ في الإنشاء" }); }
});

router.patch("/developer/tokens/:id/revoke", devOnly, async (req, res) => {
  try {
    await safeRows(sql`UPDATE developer_tokens SET is_active=false WHERE id=${String(req.params.id)}::uuid`);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "خطأ في الإلغاء" }); }
});

router.delete("/developer/tokens/:id", devOnly, async (req, res) => {
  try {
    await safeRows(sql`DELETE FROM developer_tokens WHERE id=${String(req.params.id)}::uuid`);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "خطأ في الحذف" }); }
});

/* ══════════════════════════════════════════════════
   OFFICE IMPERSONATION (دخول كمدير المكتب)
══════════════════════════════════════════════════ */

/* Ensure table exists */
(async () => {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS developer_impersonation (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        super_admin_user_id TEXT NOT NULL UNIQUE,
        impersonated_office_id TEXT NOT NULL,
        office_name      TEXT DEFAULT '',
        started_at       TIMESTAMPTZ DEFAULT NOW(),
        expires_at       TIMESTAMPTZ
      )
    `);
  } catch {}
})();

/* GET /api/developer/offices — list all offices with rich stats */
router.get("/developer/offices", devOnly, async (_req, res) => {
  try {
    const offices = await safeRows(sql`
      SELECT
        op.id::text AS id,
        op.office_name,
        op.plan,
        op.created_at,
        (SELECT COUNT(*)::int  FROM office_members  om WHERE om.office_id = op.id::text)                                    AS member_count,
        (SELECT COUNT(*)::int  FROM cases           c  WHERE c.office_id  = op.id::text)                                    AS case_count,
        (SELECT COUNT(*)::int  FROM clients         cl WHERE cl.office_id = op.id::text)                                    AS client_count,
        (SELECT COUNT(*)::int  FROM client_invoices ci WHERE ci.office_id = op.id::text)                                    AS invoice_count,
        (SELECT COALESCE(SUM(ci.amount),0)::float   FROM client_invoices ci WHERE ci.office_id = op.id::text AND ci.status='paid') AS revenue_total,
        (SELECT MAX(c.updated_at) FROM cases c WHERE c.office_id = op.id::text)                                             AS last_activity
      FROM office_page op
      ORDER BY op.created_at DESC
    `);
    res.json(offices);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /api/developer/impersonate/status */
router.get("/developer/impersonate/status", devOnly, async (req: any, res) => {
  try {
    const userId = getAuth(req)?.userId;
    if (!userId) return res.json({ active: false });
    const rows = await safeRows(sql`
      SELECT impersonated_office_id, office_name, started_at
      FROM developer_impersonation
      WHERE super_admin_user_id = ${userId}
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
    `);
    if (rows[0]) {
      res.json({ active: true, officeId: rows[0].impersonated_office_id, officeName: rows[0].office_name, startedAt: rows[0].started_at });
    } else {
      res.json({ active: false });
    }
  } catch { res.json({ active: false }); }
});

/* POST /api/developer/impersonate/:officeId — start impersonation */
router.post("/developer/impersonate/:officeId", devOnly, async (req: any, res) => {
  try {
    const userId = getAuth(req)?.userId;
    if (!userId) return res.status(401).json({ error: "غير مصادق" });
    const { officeId } = req.params as Record<string, string>;
    const officeRows = await safeRows(sql`SELECT office_name FROM office_page WHERE id::text = ${officeId} LIMIT 1`);
    const officeName = officeRows[0]?.office_name ?? officeId;
    await db.execute(sql`
      INSERT INTO developer_impersonation (super_admin_user_id, impersonated_office_id, office_name, expires_at)
      VALUES (${userId}, ${officeId}, ${officeName}, NOW() + INTERVAL '4 hours')
      ON CONFLICT (super_admin_user_id) DO UPDATE
        SET impersonated_office_id = ${officeId},
            office_name            = ${officeName},
            started_at             = NOW(),
            expires_at             = NOW() + INTERVAL '4 hours'
    `);
    /* Server-side only ghost log — never exposed to the office */
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ghost_access_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          admin_user_id TEXT NOT NULL,
          office_id TEXT NOT NULL,
          office_name TEXT,
          action TEXT NOT NULL,
          logged_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        INSERT INTO ghost_access_log (admin_user_id, office_id, office_name, action)
        VALUES (${userId}, ${officeId}, ${officeName}, 'enter')
      `);
    } catch {}
    res.json({ ok: true, officeId, officeName });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* DELETE /api/developer/impersonate — stop impersonation */
router.delete("/developer/impersonate", devOnly, async (req: any, res) => {
  try {
    const userId = getAuth(req)?.userId;
    if (!userId) return res.status(401).json({ error: "غير مصادق" });
    /* Log exit server-side */
    try {
      const active = await safeRows(sql`SELECT office_id, office_name FROM developer_impersonation WHERE super_admin_user_id = ${userId} LIMIT 1`);
      if (active[0]) {
        await db.execute(sql`INSERT INTO ghost_access_log (admin_user_id, office_id, office_name, action) VALUES (${userId}, ${active[0].office_id}, ${active[0].office_name}, 'exit')`);
      }
    } catch {}
    await db.execute(sql`DELETE FROM developer_impersonation WHERE super_admin_user_id = ${userId}`);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /api/developer/ghost-log — owner's own ghost session history (server-only) */
router.get("/developer/ghost-log", devOnly, async (req: any, res) => {
  try {
    const userId = getAuth(req)?.userId;
    if (!userId) return res.json([]);
    const rows = await safeRows(sql`
      SELECT id::text, office_id, office_name, action, logged_at
      FROM ghost_access_log
      WHERE admin_user_id = ${userId}
      ORDER BY logged_at DESC
      LIMIT 100
    `);
    res.json(rows);
  } catch { res.json([]); }
});

/* GET /api/developer/office-snapshot/:officeId — deep live snapshot for one office */
router.get("/developer/office-snapshot/:officeId", devOnly, async (req: any, res) => {
  try {
    const { officeId } = req.params as Record<string, string>;
    const [recentCases, recentClients, invoiceSummary, recentActivity] = await Promise.all([
      safeRows(sql`
        SELECT id::text, title, status, created_at
        FROM cases WHERE office_id = ${officeId}
        ORDER BY created_at DESC LIMIT 5
      `),
      safeRows(sql`
        SELECT id::text, full_name, phone, created_at
        FROM clients WHERE office_id = ${officeId}
        ORDER BY created_at DESC LIMIT 5
      `),
      safeRows(sql`
        SELECT status,
               COUNT(*)::int AS count,
               COALESCE(SUM(amount),0)::float AS total
        FROM client_invoices WHERE office_id = ${officeId}
        GROUP BY status
      `),
      safeRows(sql`
        SELECT action, resource, created_at
        FROM audit_logs WHERE office_id = ${officeId}
        ORDER BY created_at DESC LIMIT 10
      `),
    ]);
    res.json({ recentCases, recentClients, invoiceSummary, recentActivity });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════
   ENVIRONMENT INFO  (non-sensitive)
══════════════════════════════════════════════════ */
router.get("/developer/env-info", devOnly, (_req, res) => {
  const safe: Record<string, string> = {};
  const SAFE_KEYS = ["NODE_ENV","PORT","DATABASE_URL","VITE_CLERK_PUBLISHABLE_KEY","REPL_SLUG","REPLIT_DEV_DOMAIN","TZ","LANG"];
  for (const key of SAFE_KEYS) {
    const val = process.env[key];
    if (!val) continue;
    /* Mask sensitive parts */
    if (key === "DATABASE_URL") { safe[key] = val.replace(/:\/\/.*?@/, "://****@"); }
    else if (key === "VITE_CLERK_PUBLISHABLE_KEY") { safe[key] = val.slice(0, 12) + "…"; }
    else { safe[key] = val; }
  }
  safe["PLATFORM_OWNER_EMAIL_SET"] = process.env.PLATFORM_OWNER_EMAIL ? "✓ مُعيَّن" : "✗ غير مُعيَّن";
  safe["CLERK_SECRET_KEY_SET"]     = process.env.CLERK_SECRET_KEY ? "✓ مُعيَّن" : "✗ غير مُعيَّن";
  safe["ANTHROPIC_API_KEY_SET"]    = process.env.ANTHROPIC_API_KEY ? "✓ مُعيَّن" : "✗ غير مُعيَّن";
  safe["STRIPE_SECRET_KEY_SET"]    = process.env.STRIPE_SECRET_KEY ? "✓ مُعيَّن" : "✗ غير مُعيَّن";
  res.json(safe);
});

/* ══════════════════════════════════════════════════
   PLATFORM ADMINS (مالكو المنصة)
   Full super_admin role — managed via Clerk metadata
══════════════════════════════════════════════════ */

/* GET /api/developer/platform-admins — list all super admins from Clerk */
router.get("/developer/platform-admins", devOnly, async (_req, res) => {
  try {
    const clerk = getClerk();
    const { data: allUsers } = await clerk.users.getUserList({ limit: 500 });
    const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS ?? process.env.PLATFORM_OWNER_EMAIL ?? "")
      .split(",").map((e: string) => e.trim()).filter(Boolean);

    const admins = allUsers
      .filter((u: any) => {
        const email = u.emailAddresses.find((e: any) => e.id === u.primaryEmailAddressId)?.emailAddress
          ?? u.emailAddresses[0]?.emailAddress ?? "";
        return u.publicMetadata?.role === "super_admin" || superAdminEmails.includes(email);
      })
      .map((u: any) => {
        const email = u.emailAddresses.find((e: any) => e.id === u.primaryEmailAddressId)?.emailAddress
          ?? u.emailAddresses[0]?.emailAddress ?? "";
        const fromEnv = superAdminEmails.includes(email);
        return {
          id: u.id,
          email,
          name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || email,
          imageUrl: u.imageUrl,
          fromEnv,
          role: u.publicMetadata?.role ?? (fromEnv ? "super_admin" : "user"),
          createdAt: u.createdAt,
          lastSignInAt: u.lastSignInAt,
        };
      });
    res.json(admins);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /api/developer/platform-admins — promote user to super_admin by email */
router.post("/developer/platform-admins", devOnly, async (req: any, res) => {
  try {
    const { email } = req.body as { email: string };
    if (!email) return res.status(400).json({ error: "البريد الإلكتروني مطلوب" });

    const clerk = getClerk();
    const { data: users } = await clerk.users.getUserList({ emailAddress: [email.toLowerCase()] });
    if (!users.length) return res.status(404).json({ error: "المستخدم غير موجود في النظام، يجب أن يسجّل أولاً" });

    const user = users[0];
    await clerk.users.updateUserMetadata(user.id, {
      publicMetadata: { ...((user.publicMetadata as any) ?? {}), role: "super_admin" },
    });

    /* Audit log — privilege escalation is critical and must always be recorded */
    const requesterId = getAuth(req)?.userId ?? "unknown";
    try {
      await db.execute(sql`
        INSERT INTO audit_logs (user_id, user_full_name, office_id, action, resource, resource_id, details, ip_address)
        VALUES (
          ${requesterId}, 'Super Admin', 'platform',
          'GRANT_SUPER_ADMIN', 'user', ${user.id},
          ${JSON.stringify({ targetEmail: email, targetUserId: user.id, grantedBy: requesterId })},
          ${(req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket?.remoteAddress ?? null}
        )
      `);
    } catch { /* audit failure is non-fatal but should not silently mask the grant */ }

    res.json({ ok: true, userId: user.id });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* DELETE /api/developer/platform-admins/:userId — revoke super_admin role */
router.delete("/developer/platform-admins/:userId", devOnly, async (req: any, res) => {
  try {
    const { userId } = req.params as Record<string, string>;
    const requesterAuth = getAuth(req);
    if (requesterAuth?.userId === userId)
      return res.status(400).json({ error: "لا يمكنك إزالة صلاحياتك الخاصة" });

    const clerk = getClerk();
    const user = await clerk.users.getUser(userId);
    const meta = { ...((user.publicMetadata as any) ?? {}) };
    delete meta.role;
    await clerk.users.updateUserMetadata(userId, { publicMetadata: meta });

    /* Audit log — revocation must also be recorded */
    const requesterId = requesterAuth?.userId ?? "unknown";
    try {
      await db.execute(sql`
        INSERT INTO audit_logs (user_id, user_full_name, office_id, action, resource, resource_id, details, ip_address)
        VALUES (
          ${requesterId}, 'Super Admin', 'platform',
          'REVOKE_SUPER_ADMIN', 'user', ${userId},
          ${JSON.stringify({ targetUserId: userId, revokedBy: requesterId })},
          ${(req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket?.remoteAddress ?? null}
        )
      `);
    } catch { /* non-fatal */ }

    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════
   DEVELOPER ACCOUNTS (حسابات المطورين)
   Separate developer users with granular permissions
══════════════════════════════════════════════════ */

async function ensureDevAccountsTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS developer_accounts (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      email       TEXT        NOT NULL UNIQUE,
      name        TEXT        NOT NULL DEFAULT '',
      clerk_user_id TEXT,
      permissions JSONB       NOT NULL DEFAULT '{}',
      is_active   BOOLEAN     NOT NULL DEFAULT true,
      notes       TEXT        DEFAULT '',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

/* GET /api/developer/dev-accounts */
router.get("/developer/dev-accounts", devOnly, async (_req, res) => {
  try {
    await ensureDevAccountsTable();
    const rows = await safeRows(sql`
      SELECT id::text, email, name, clerk_user_id, permissions,
             is_active, notes, created_at, updated_at
      FROM developer_accounts ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /api/developer/dev-accounts */
router.post("/developer/dev-accounts", devOnly, async (req: any, res) => {
  try {
    await ensureDevAccountsTable();
    const { email, name, permissions = {}, notes = "" } = req.body as any;
    if (!email) return res.status(400).json({ error: "البريد الإلكتروني مطلوب" });

    /* Try to find Clerk user */
    let clerkUserId: string | null = null;
    try {
      const clerk = getClerk();
      const { data: users } = await clerk.users.getUserList({ emailAddress: [email.toLowerCase()] });
      if (users.length) {
        clerkUserId = users[0].id;
        await clerk.users.updateUserMetadata(users[0].id, {
          publicMetadata: { ...((users[0].publicMetadata as any) ?? {}), role: "developer" },
        });
      }
    } catch {}

    const rows = await safeRows(sql`
      INSERT INTO developer_accounts (email, name, clerk_user_id, permissions, notes)
      VALUES (${email.toLowerCase()}, ${name ?? ""}, ${clerkUserId},
              ${JSON.stringify(permissions)}::jsonb, ${notes})
      ON CONFLICT (email) DO UPDATE
        SET name=${name ?? ""}, permissions=${JSON.stringify(permissions)}::jsonb,
            notes=${notes}, updated_at=now()
      RETURNING id::text, email, name, clerk_user_id, permissions, is_active, notes, created_at, updated_at
    `);
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* PATCH /api/developer/dev-accounts/:id */
router.patch("/developer/dev-accounts/:id", devOnly, async (req: any, res) => {
  try {
    const { id } = req.params as Record<string, string>;
    const { permissions, is_active, name, notes } = req.body as any;
    const rows = await safeRows(sql`
      UPDATE developer_accounts
      SET
        permissions = COALESCE(${permissions != null ? JSON.stringify(permissions) : null}::jsonb, permissions),
        is_active   = COALESCE(${is_active   != null ? is_active   : null}, is_active),
        name        = COALESCE(${name        != null ? name        : null}, name),
        notes       = COALESCE(${notes       != null ? notes       : null}, notes),
        updated_at  = now()
      WHERE id = ${id}::uuid
      RETURNING id::text, email, name, clerk_user_id, permissions, is_active, notes, created_at, updated_at
    `);
    if (!rows.length) return res.status(404).json({ error: "غير موجود" });
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* DELETE /api/developer/dev-accounts/:id */
router.delete("/developer/dev-accounts/:id", devOnly, async (req: any, res) => {
  try {
    const { id } = req.params as Record<string, string>;
    const rows = await safeRows(sql`DELETE FROM developer_accounts WHERE id=${id}::uuid RETURNING email, clerk_user_id`);
    /* Revoke Clerk developer role if set */
    if (rows[0]?.clerk_user_id) {
      try {
        const clerk = getClerk();
        const user = await clerk.users.getUser(rows[0].clerk_user_id);
        const meta = { ...((user.publicMetadata as any) ?? {}) };
        if (meta.role === "developer") { delete meta.role; }
        await clerk.users.updateUserMetadata(rows[0].clerk_user_id, { publicMetadata: meta });
      } catch {}
    }
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
