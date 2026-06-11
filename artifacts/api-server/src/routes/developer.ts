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
    const ownerEmail = (process.env.PLATFORM_OWNER_EMAIL ?? "").trim();
    return (!!ownerEmail && email === ownerEmail) || user.publicMetadata?.role === "super_admin";
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
  } catch (e) { console.error(e); res.status(500).json({ error: "خطأ في الإنشاء" }); }
});

router.patch("/developer/tokens/:id/revoke", devOnly, async (req, res) => {
  try {
    await safeRows(sql`UPDATE developer_tokens SET is_active=false WHERE id=${req.params.id}::uuid`);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "خطأ في الإلغاء" }); }
});

router.delete("/developer/tokens/:id", devOnly, async (req, res) => {
  try {
    await safeRows(sql`DELETE FROM developer_tokens WHERE id=${req.params.id}::uuid`);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "خطأ في الحذف" }); }
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

export default router;
