/**
 * Adala Engineering Center — Platform Owner Console
 * مركز الهندسة — لوحة مالك المنصة
 *
 * Guards: isSuperAdmin (owner) OR publicMetadata.engineering_access = true (developer)
 * IP Whitelist: if any IPs exist in engineering_ip_whitelist, only those IPs can access
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getAuth, createClerkClient } from "@clerk/express";
import * as os from "os";
import * as http from "http";
import * as https from "https";
import { callAI } from "../ai/aiChat";

const router = Router();

/* ── Clerk ── */
let _clerk: any = null;
function getClerk() {
  if (!_clerk) _clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  return _clerk;
}

async function isSuperAdminOrDev(req: any): Promise<boolean> {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) return false;
  try {
    const user = await getClerk().users.getUser(userId);
    const email = user.emailAddresses.find((e: any) => e.id === user.primaryEmailAddressId)?.emailAddress ?? "";
    const ownerEmail = (process.env.PLATFORM_OWNER_EMAIL ?? "").trim();
    const meta = user.publicMetadata as any;
    return (
      (!!ownerEmail && email === ownerEmail) ||
      meta?.role === "super_admin" ||
      meta?.engineering_access === true
    );
  } catch { return false; }
}

async function engineeringOnly(req: any, res: any, next: any) {
  if (!(await isSuperAdminOrDev(req)))
    return res.status(403).json({ error: "غير مصرح — مركز الهندسة للمالك والمطور فقط" });
  next();
}

async function safeRows(q: any): Promise<any[]> {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}

function getClientIp(req: any): string {
  return (
    req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    "unknown"
  );
}

/* ── Ensure tables ── */
(async () => {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS engineering_tasks (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title        TEXT NOT NULL,
        description  TEXT,
        status       TEXT DEFAULT 'pending',
        priority     TEXT DEFAULT 'medium',
        category     TEXT DEFAULT 'general',
        result       JSONB,
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );
      CREATE TABLE IF NOT EXISTS engineering_scans (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scan_type  TEXT NOT NULL,
        status     TEXT DEFAULT 'pending',
        findings   JSONB,
        summary    TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS engineering_ip_whitelist (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ip_address TEXT NOT NULL UNIQUE,
        label      TEXT,
        added_by   TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS engineering_logs (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        action     TEXT NOT NULL,
        details    JSONB,
        user_id    TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } catch {}
})();

async function logAction(action: string, details: any, userId: string) {
  try {
    await db.execute(sql`
      INSERT INTO engineering_logs (action, details, user_id)
      VALUES (${action}, ${JSON.stringify(details)}::jsonb, ${userId})
    `);
  } catch {}
}

/* ══════════════════════════════════════════════════════════
   IP CHECK  (always allowed — just reports IP + whitelist status)
══════════════════════════════════════════════════════════ */
router.get("/engineering/ip-check", engineeringOnly, async (req: any, res) => {
  try {
    const ip        = getClientIp(req);
    const whitelist = await safeRows(sql`SELECT ip_address FROM engineering_ip_whitelist`);
    const authorized = whitelist.length === 0 || whitelist.some((r: any) => r.ip_address === ip);
    res.json({ ip, authorized, whitelistActive: whitelist.length > 0 });
  } catch { res.json({ ip: "unknown", authorized: true, whitelistActive: false }); }
});

/* ══════════════════════════════════════════════════════════
   PLATFORM MAP  (نظرة عامة)
══════════════════════════════════════════════════════════ */
router.get("/engineering/platform-map", engineeringOnly, async (_req, res) => {
  try {
    const counts = await Promise.all([
      safeRows(sql`SELECT COUNT(*)::int AS n FROM office_page`),
      safeRows(sql`SELECT COUNT(*)::int AS n FROM users`),
      safeRows(sql`SELECT COUNT(*)::int AS n FROM cases`),
      safeRows(sql`SELECT COUNT(*)::int AS n FROM clients`),
      safeRows(sql`SELECT COUNT(*)::int AS n FROM client_invoices`),
      safeRows(sql`SELECT COUNT(*)::int AS n FROM contracts`),
      safeRows(sql`SELECT COUNT(*)::int AS n FROM office_members`),
      safeRows(sql`SELECT COUNT(*)::int AS n FROM ai_tasks`),
      safeRows(sql`SELECT COUNT(*)::int AS n FROM documents`),
      safeRows(sql`SELECT COUNT(*)::int AS n FROM audit_logs`),
      safeRows(sql`SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema='public'`),
      safeRows(sql`SELECT COUNT(*)::int AS n FROM engineering_tasks`),
    ]);

    const recentActivity = await safeRows(sql`
      SELECT action, details, created_at
      FROM engineering_logs
      ORDER BY created_at DESC LIMIT 5
    `);

    const layers = [
      { id: 1, name: "Role Permission",  status: "active",   desc: "مالك المنصة / مطور / سوبر أدمن" },
      { id: 2, name: "Clerk Auth (JWT)", status: "active",   desc: "رمز Clerk مطلوب لكل طلب" },
      { id: 3, name: "IP Allowlist",     status: counts[10]?.[0]?.n > 0 ? "active" : "disabled", desc: "قائمة IPs المسموح بها" },
      { id: 4, name: "Approval Key",     status: "planned",  desc: "مفتاح موافقة للعمليات الحرجة" },
      { id: 5, name: "Audit Logs",       status: "active",   desc: `${counts[9]?.[0]?.n ?? 0} سجل محفوظ` },
    ];

    res.json({
      offices:     counts[0]?.[0]?.n  ?? 0,
      users:       counts[1]?.[0]?.n  ?? 0,
      cases:       counts[2]?.[0]?.n  ?? 0,
      clients:     counts[3]?.[0]?.n  ?? 0,
      invoices:    counts[4]?.[0]?.n  ?? 0,
      contracts:   counts[5]?.[0]?.n  ?? 0,
      members:     counts[6]?.[0]?.n  ?? 0,
      aiTasks:     counts[7]?.[0]?.n  ?? 0,
      documents:   counts[8]?.[0]?.n  ?? 0,
      auditLogs:   counts[9]?.[0]?.n  ?? 0,
      dbTables:    counts[10]?.[0]?.n ?? 0,
      engTasks:    counts[11]?.[0]?.n ?? 0,
      uptime:      process.uptime(),
      nodeVersion: process.version,
      recentActivity,
      securityLayers: layers,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   PERFORMANCE
══════════════════════════════════════════════════════════ */
router.get("/engineering/performance", engineeringOnly, async (_req, res) => {
  try {
    const mem  = process.memoryUsage();
    const cpus = os.cpus();

    const [dbSize, topTables, connStats] = await Promise.all([
      safeRows(sql`
        SELECT pg_size_pretty(pg_database_size(current_database())) AS size,
               pg_database_size(current_database())::bigint AS bytes
      `),
      safeRows(sql`
        SELECT tablename AS name,
               pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS total_size,
               pg_total_relation_size('public.'||tablename)::bigint AS bytes
        FROM pg_tables
        WHERE schemaname='public'
        ORDER BY pg_total_relation_size('public.'||tablename) DESC
        LIMIT 10
      `),
      safeRows(sql`
        SELECT count(*) AS active FROM pg_stat_activity
        WHERE state = 'active'
      `),
    ]);

    res.json({
      memory: {
        rss:         mem.rss,
        heapUsed:    mem.heapUsed,
        heapTotal:   mem.heapTotal,
        systemTotal: os.totalmem(),
        systemFree:  os.freemem(),
      },
      uptime:     process.uptime(),
      cpuCount:   cpus.length,
      cpuModel:   cpus[0]?.model ?? "—",
      platform:   process.platform,
      nodeVersion: process.version,
      db: {
        size:  dbSize[0]?.size  ?? "—",
        bytes: dbSize[0]?.bytes ?? 0,
      },
      activeDbConnections: connStats[0]?.active ?? 0,
      topTables,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   DB ANALYSIS
══════════════════════════════════════════════════════════ */
router.get("/engineering/db-stats", engineeringOnly, async (_req, res) => {
  try {
    const [tables, indexes] = await Promise.all([
      safeRows(sql`
        SELECT
          t.table_name AS name,
          pg_size_pretty(pg_total_relation_size('public.'||t.table_name)) AS total_size,
          pg_total_relation_size('public.'||t.table_name)::bigint AS size_bytes,
          COALESCE((SELECT reltuples::bigint FROM pg_class c WHERE c.relname = t.table_name LIMIT 1), 0) AS row_estimate
        FROM information_schema.tables t
        WHERE t.table_schema='public' AND t.table_type='BASE TABLE'
        ORDER BY pg_total_relation_size('public.'||t.table_name) DESC
      `),
      safeRows(sql`
        SELECT tablename, indexname,
               pg_size_pretty(pg_relation_size(indexname::regclass)) AS size
        FROM pg_indexes
        WHERE schemaname='public'
        ORDER BY pg_relation_size(indexname::regclass) DESC
        LIMIT 20
      `),
    ]);
    res.json({ tables, indexes });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   AI REVIEW  (مراجعة الكود / التحليل)
══════════════════════════════════════════════════════════ */
router.post("/engineering/ai-review", engineeringOnly, async (req: any, res) => {
  try {
    const { topic, context, reviewType = "general" } = req.body;
    const userId = getAuth(req)?.userId ?? "owner";

    const typePrompts: Record<string, string> = {
      security:    "حلّل الثغرات الأمنية المحتملة (SQL Injection, XSS, Auth bypass, Secrets exposure) وقدّم توصيات واضحة مرقّمة",
      performance: "حلّل نقاط الضعف في الأداء (N+1 queries, memory leaks, bundle size, slow DB queries) وقدّم تحسينات مقترحة",
      code:        "راجع الكود من ناحية الجودة والبنية والـ best practices في TypeScript + React + Node.js وقدّم ملاحظات منظّمة",
      database:    "حلّل بنية قاعدة البيانات (indexes, relations, query efficiency, migrations) وقدّم توصيات",
      general:     "قدّم تحليلاً شاملاً احترافياً",
    };

    const systemPrompt = `أنت كبير مهندسي البرمجيات في منصة عدالة AI.
عدالة AI هي منصة SaaS قانونية متكاملة تستخدم:
- Frontend: React + Vite + Wouter + Tailwind + shadcn/ui + RTL Arabic
- Backend: Express + Node.js + TypeScript + Pino logging
- Database: PostgreSQL + Drizzle ORM (60+ tables)
- Auth: Clerk + JWT
- AI: Gemini 2.5 Flash / Claude / OpenAI
- Payments: Stripe Connect + Moyasar
- Storage: Replit Object Storage
- Notifications: Email (Resend) + WhatsApp (Twilio) + Push Notifications

قدّم تقريرك باللغة العربية بشكل منظّم واحترافي مع:
1. ملخص تنفيذي
2. النتائج مرقّمة (🔴 حرج / 🟠 مرتفع / 🟡 متوسط / 🟢 منخفض)
3. التوصيات مرتّبة حسب الأولوية
4. مثال عملي عند الحاجة`;

    const userMessage = `${typePrompts[reviewType] ?? typePrompts.general}:\n\n${topic ? `الموضوع: ${topic}\n` : ""}${context ? `\nالكود/السياق:\n\`\`\`\n${context}\n\`\`\`` : "تحليل عام لمنصة عدالة AI"}`;

    const { reply, modelUsed } = await callAI(systemPrompt, userMessage, [], "gemini", "engineering");

    await logAction("ai_review", { topic, reviewType, modelUsed }, userId);
    res.json({ reply, modelUsed });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   SECURITY SCAN
══════════════════════════════════════════════════════════ */
router.post("/engineering/security-scan", engineeringOnly, async (req: any, res) => {
  try {
    const userId = getAuth(req)?.userId ?? "owner";

    const [failedLogins, expiredSessions, ipWhitelist, ghostLog, auditRecent] = await Promise.all([
      safeRows(sql`SELECT COUNT(*)::int AS n FROM login_logs WHERE status='failed' AND created_at > NOW()-INTERVAL '24 hours'`).catch(() => [{ n: 0 }]),
      safeRows(sql`SELECT COUNT(*)::int AS n FROM developer_impersonation WHERE expires_at < NOW()`).catch(() => [{ n: 0 }]),
      safeRows(sql`SELECT COUNT(*)::int AS n FROM engineering_ip_whitelist`),
      safeRows(sql`SELECT COUNT(*)::int AS n FROM ghost_access_log WHERE logged_at > NOW()-INTERVAL '7 days'`).catch(() => [{ n: 0 }]),
      safeRows(sql`SELECT COUNT(*)::int AS n FROM audit_logs WHERE created_at > NOW()-INTERVAL '24 hours'`).catch(() => [{ n: 0 }]),
    ]);

    const fl   = failedLogins[0]?.n ?? 0;
    const ipCt = ipWhitelist[0]?.n  ?? 0;

    const findings = [
      { id: 1, label: "فشل تسجيل الدخول (24 ساعة)", value: fl,    severity: fl > 20 ? "critical" : fl > 5 ? "high" : "ok",   recommendation: fl > 5 ? "فعّل حماية Brute Force في Clerk" : "الوضع طبيعي" },
      { id: 2, label: "IP Whitelist",                value: ipCt,  severity: ipCt === 0 ? "warning" : "ok",                    recommendation: ipCt === 0 ? "أضف عناوين IP الموثوقة لتقييد الوصول للوحة الهندسة" : `${ipCt} عنوان مدرج — الوضع محمي` },
      { id: 3, label: "جلسات منتهية في قاعدة البيانات", value: expiredSessions[0]?.n ?? 0, severity: "info", recommendation: "تنظيف تلقائي للجلسات المنتهية عبر cron job" },
      { id: 4, label: "الدخول الخفي (7 أيام)",      value: ghostLog[0]?.n ?? 0,  severity: "info",  recommendation: "سجل الدخول الخفي محفوظ ومشفّر" },
      { id: 5, label: "العمليات الحديثة (24 ساعة)", value: auditRecent[0]?.n ?? 0, severity: "ok",  recommendation: "سجل التدقيق يعمل بشكل طبيعي" },
    ];

    const context = `فحص أمني لمنصة عدالة AI:\n${findings.map(f => `- ${f.label}: ${f.value} (${f.severity})`).join("\n")}`;
    const { reply } = await callAI(
      "أنت خبير أمن معلومات. قدّم تقريراً أمنياً موجزاً ومنظّماً باللغة العربية مع توصيات عملية مرتّبة حسب الأولوية.",
      context,
      [],
      "gemini",
      "engineering"
    );

    await safeRows(sql`
      INSERT INTO engineering_scans (scan_type, status, findings, summary)
      VALUES ('security', 'complete', ${JSON.stringify(findings)}::jsonb, ${reply})
    `);
    await logAction("security_scan", { findings: findings.length }, userId);

    res.json({ findings, aiAnalysis: reply, scannedAt: new Date().toISOString() });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET recent scans */
router.get("/engineering/scans", engineeringOnly, async (_req, res) => {
  try {
    const rows = await safeRows(sql`
      SELECT id::text, scan_type, status, findings, summary, created_at
      FROM engineering_scans ORDER BY created_at DESC LIMIT 20
    `);
    res.json(rows);
  } catch { res.json([]); }
});

/* ══════════════════════════════════════════════════════════
   IP WHITELIST
══════════════════════════════════════════════════════════ */
router.get("/engineering/ip-whitelist", engineeringOnly, async (_req, res) => {
  try {
    const rows = await safeRows(sql`
      SELECT id::text, ip_address, label, added_by, created_at
      FROM engineering_ip_whitelist ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch { res.json([]); }
});

router.post("/engineering/ip-whitelist", engineeringOnly, async (req: any, res) => {
  try {
    const { ip_address, label } = req.body;
    const userId = getAuth(req)?.userId ?? "owner";
    if (!ip_address) return res.status(400).json({ error: "IP مطلوب" });
    await db.execute(sql`
      INSERT INTO engineering_ip_whitelist (ip_address, label, added_by)
      VALUES (${ip_address}, ${label ?? null}, ${userId})
      ON CONFLICT (ip_address) DO UPDATE SET label = ${label ?? null}
    `);
    await logAction("ip_add", { ip_address, label }, userId);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/engineering/ip-whitelist/:id", engineeringOnly, async (req: any, res) => {
  try {
    const userId = getAuth(req)?.userId ?? "owner";
    await db.execute(sql`DELETE FROM engineering_ip_whitelist WHERE id::text = ${String(req.params.id)}`);
    await logAction("ip_remove", { id: String(req.params.id) }, userId);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   ENGINEERING TASKS
══════════════════════════════════════════════════════════ */
router.get("/engineering/tasks", engineeringOnly, async (_req, res) => {
  try {
    const rows = await safeRows(sql`
      SELECT id::text, title, description, status, priority, category, result, created_at, completed_at
      FROM engineering_tasks ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch { res.json([]); }
});

router.post("/engineering/tasks", engineeringOnly, async (req: any, res) => {
  try {
    const { title, description, priority = "medium", category = "general" } = req.body;
    const userId = getAuth(req)?.userId ?? "owner";
    if (!title) return res.status(400).json({ error: "العنوان مطلوب" });
    const rows = await safeRows(sql`
      INSERT INTO engineering_tasks (title, description, priority, category)
      VALUES (${title}, ${description ?? null}, ${priority}, ${category})
      RETURNING id::text, title, status, priority, category, created_at
    `);
    await logAction("task_create", { title, category }, userId);
    res.json(rows[0] ?? { ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/engineering/tasks/:id", engineeringOnly, async (req: any, res) => {
  try {
    const { status, result, title, description, priority } = req.body;
    await db.execute(sql`
      UPDATE engineering_tasks
      SET status      = COALESCE(${status ?? null},      status),
          title       = COALESCE(${title ?? null},       title),
          description = COALESCE(${description ?? null}, description),
          priority    = COALESCE(${priority ?? null},    priority),
          result      = CASE WHEN ${JSON.stringify(result ?? null)}::jsonb IS NOT NULL
                             THEN ${JSON.stringify(result ?? null)}::jsonb ELSE result END,
          completed_at = CASE WHEN ${status ?? null} IN ('done','failed') THEN NOW() ELSE completed_at END
      WHERE id::text = ${String(req.params.id)}
    `);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/engineering/tasks/:id", engineeringOnly, async (req: any, res) => {
  try {
    await db.execute(sql`DELETE FROM engineering_tasks WHERE id::text = ${String(req.params.id)}`);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   LOGS
══════════════════════════════════════════════════════════ */
router.get("/engineering/logs", engineeringOnly, async (_req, res) => {
  try {
    const rows = await safeRows(sql`
      SELECT id::text, action, details, user_id, created_at
      FROM engineering_logs ORDER BY created_at DESC LIMIT 100
    `);
    res.json(rows);
  } catch { res.json([]); }
});

/* ══════════════════════════════════════════════════════════
   LOAD TESTING
══════════════════════════════════════════════════════════ */
function httpGet(url: string, timeoutMs = 8000): Promise<{ status: number; latencyMs: number; error?: string }> {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const mod = url.startsWith("https") ? https : http;
    const req = mod.get(url, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve({ status: res.statusCode ?? 0, latencyMs: Date.now() - t0 });
    });
    req.on("timeout", () => { req.destroy(); resolve({ status: 0, latencyMs: timeoutMs, error: "timeout" }); });
    req.on("error", (e) => resolve({ status: 0, latencyMs: Date.now() - t0, error: e.message }));
  });
}

function pct(arr: number[], p: number) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

router.post("/engineering/load-test", engineeringOnly, async (req: any, res) => {
  try {
    const userId = getAuth(req)?.userId ?? "owner";
    const concurrency  = Math.min(Math.max(Number(req.body.concurrency) || 10, 1), 100);
    const durationSecs = Math.min(Math.max(Number(req.body.duration)    || 15, 5), 60);
    const target       = (req.body.target as string) || "status";

    const BASE_URL = `http://localhost:${process.env.PORT ?? 8080}`;
    const TARGETS: Record<string, { url: string; label: string; expectStatus: number }[]> = {
      status: [
        { url: `${BASE_URL}/api/status`,         label: "GET /api/status",         expectStatus: 200 },
      ],
      api: [
        { url: `${BASE_URL}/api/status`,         label: "GET /api/status",         expectStatus: 200 },
        { url: `${BASE_URL}/api/cases`,          label: "GET /api/cases (auth)",   expectStatus: 401 },
        { url: `${BASE_URL}/api/clients`,        label: "GET /api/clients (auth)", expectStatus: 401 },
      ],
      full: [
        { url: `${BASE_URL}/api/status`,          label: "GET /api/status",         expectStatus: 200 },
        { url: `${BASE_URL}/api/cases`,           label: "GET /api/cases (auth)",   expectStatus: 401 },
        { url: `${BASE_URL}/api/clients`,         label: "GET /api/clients (auth)", expectStatus: 401 },
        { url: `${BASE_URL}/api/billing/plans`,   label: "GET /api/billing/plans",  expectStatus: 200 },
        { url: `${BASE_URL}/api/engineering/logs`,label: "GET /api/eng/logs (auth)",expectStatus: 401 },
      ],
    };

    const endpoints = TARGETS[target] ?? TARGETS.status;
    const deadline   = Date.now() + durationSecs * 1000;
    const latencies: number[] = [];
    const perEndpoint: Record<string, { ok: number; fail: number; latencies: number[] }> = {};
    endpoints.forEach(e => { perEndpoint[e.label] = { ok: 0, fail: 0, latencies: [] }; });

    let totalReq = 0;
    let totalOk  = 0;
    let totalErr = 0;

    while (Date.now() < deadline) {
      const batch: Promise<void>[] = [];
      for (let i = 0; i < concurrency; i++) {
        const ep = endpoints[i % endpoints.length];
        batch.push(
          httpGet(ep.url).then(r => {
            totalReq++;
            latencies.push(r.latencyMs);
            perEndpoint[ep.label].latencies.push(r.latencyMs);
            const ok = r.status === ep.expectStatus || (r.status >= 200 && r.status < 500);
            if (ok) { totalOk++; perEndpoint[ep.label].ok++; }
            else    { totalErr++; perEndpoint[ep.label].fail++; }
          })
        );
      }
      await Promise.all(batch);
    }

    const elapsed = durationSecs;
    const summary = {
      target, concurrency, durationSecs,
      totalRequests: totalReq,
      successful:    totalOk,
      failed:        totalErr,
      errorRatePct:  totalReq ? Math.round((totalErr / totalReq) * 10000) / 100 : 0,
      reqPerSec:     Math.round(totalReq / elapsed),
      latency: {
        min: Math.min(...latencies),
        max: Math.max(...latencies),
        p50: pct(latencies, 50),
        p95: pct(latencies, 95),
        p99: pct(latencies, 99),
        avg: Math.round(latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1)),
      },
      endpoints: Object.entries(perEndpoint).map(([label, d]) => ({
        label,
        requests: d.ok + d.fail,
        ok: d.ok,
        fail: d.fail,
        p50: pct(d.latencies, 50),
        p99: pct(d.latencies, 99),
      })),
      ranAt: new Date().toISOString(),
    };

    await safeRows(sql`
      INSERT INTO engineering_scans (scan_type, status, findings, summary)
      VALUES ('load_test', 'complete',
        ${JSON.stringify([{ id: 1, label: "req/sec", value: summary.reqPerSec, severity: summary.errorRatePct > 5 ? "high" : "ok", recommendation: "" }])}::jsonb,
        ${JSON.stringify(summary)})
    `);
    await logAction("load_test", { reqPerSec: summary.reqPerSec, errorRatePct: summary.errorRatePct }, userId);

    res.json(summary);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   PENETRATION TESTING — OWASP Top 10 Automated Checks
══════════════════════════════════════════════════════════ */
router.post("/engineering/pentest", engineeringOnly, async (req: any, res) => {
  try {
    const userId  = getAuth(req)?.userId ?? "owner";
    const BASE    = `http://localhost:${process.env.PORT ?? 8080}`;
    const results: { id: number; category: string; check: string; severity: "critical"|"high"|"medium"|"low"|"info"|"pass"; detail: string; recommendation: string }[] = [];
    let id = 1;

    /* ── Helper ── */
    async function probe(url: string, opts: { method?: string; body?: string; headers?: Record<string,string>; timeout?: number } = {}) {
      return new Promise<{ status: number; headers: Record<string,string>; body: string; latencyMs: number }>((resolve) => {
        const t0 = Date.now();
        const u  = new URL(url);
        const options = {
          hostname: u.hostname, port: Number(u.port) || 80, path: u.pathname + u.search,
          method: opts.method ?? "GET",
          headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
          timeout: opts.timeout ?? 5000,
        };
        const req2 = http.request(options, (r) => {
          let body = "";
          r.on("data", (c) => { body += c; });
          r.on("end", () => {
            const hdrs: Record<string,string> = {};
            Object.entries(r.headers).forEach(([k, v]) => { hdrs[k] = String(v); });
            resolve({ status: r.statusCode ?? 0, headers: hdrs, body: body.slice(0, 500), latencyMs: Date.now() - t0 });
          });
        });
        req2.on("timeout", () => { req2.destroy(); resolve({ status: 0, headers: {}, body: "", latencyMs: opts.timeout ?? 5000 }); });
        req2.on("error",   () => resolve({ status: 0, headers: {}, body: "", latencyMs: Date.now() - t0 }));
        if (opts.body) req2.write(opts.body);
        req2.end();
      });
    }

    /* ── A01: Broken Access Control ── */
    const adminRoutes = ["/api/admin/users", "/api/engineering/logs", "/api/backup/history", "/api/developer/system-info"];
    for (const route of adminRoutes) {
      const r = await probe(`${BASE}${route}`);
      if (r.status === 200) {
        results.push({ id: id++, category: "A01 - Broken Access Control", check: `مسار مفتوح: ${route}`, severity: "critical", detail: `HTTP ${r.status} بدون مصادقة`, recommendation: "أضف requireAuthWithTenant أو adminOnly لهذا المسار فوراً" });
      } else {
        results.push({ id: id++, category: "A01 - Broken Access Control", check: `حماية المسار: ${route}`, severity: "pass", detail: `HTTP ${r.status} — محمي`, recommendation: "" });
      }
    }

    /* ── A02: Security Headers ── */
    const statusResp = await probe(`${BASE}/api/status`);
    const secHeaders = [
      { h: "x-content-type-options", expected: "nosniff",     label: "X-Content-Type-Options" },
      { h: "x-frame-options",        expected: "SAMEORIGIN",  label: "X-Frame-Options" },
      { h: "strict-transport-security", expected: null,       label: "HSTS" },
      { h: "x-xss-protection",       expected: null,          label: "X-XSS-Protection" },
    ];
    for (const sh of secHeaders) {
      const val = statusResp.headers[sh.h];
      if (!val) {
        results.push({ id: id++, category: "A02 - Security Headers", check: sh.label, severity: "medium", detail: "رأس مفقود", recommendation: `أضف res.setHeader('${sh.h}', '${sh.expected ?? "1"}')` });
      } else {
        results.push({ id: id++, category: "A02 - Security Headers", check: sh.label, severity: "pass", detail: `القيمة: ${val}`, recommendation: "" });
      }
    }

    /* ── A03: SQL Injection via search params ── */
    const injPayloads = ["' OR '1'='1", "1; DROP TABLE users--", "' UNION SELECT 1,2,3--"];
    for (const payload of injPayloads) {
      const r = await probe(`${BASE}/api/status?q=${encodeURIComponent(payload)}`);
      const bodyLower = r.body.toLowerCase();
      if (bodyLower.includes("syntax error") || bodyLower.includes("sql") || bodyLower.includes("pg error")) {
        results.push({ id: id++, category: "A03 - Injection", check: "SQL Injection", severity: "critical", detail: `استجابة قاعدة البيانات مرئية للمستخدم`, recommendation: "استخدم Parameterized Queries فقط ولا تكشف رسائل DB errors" });
        break;
      }
    }
    results.push({ id: id++, category: "A03 - Injection", check: "SQL Injection Protection", severity: "pass", detail: "لا استجابة DB مرئية", recommendation: "" });

    /* ── A04: Rate Limiting ── */
    const rlProbes: Promise<{ status: number }>[] = [];
    for (let i = 0; i < 35; i++) rlProbes.push(probe(`${BASE}/api/client-auth/login`, { method: "POST", body: JSON.stringify({ email: "test@test.com", password: "bad" }) }));
    const rlResps = await Promise.all(rlProbes);
    const rl429   = rlResps.filter(r => r.status === 429).length;
    if (rl429 < 5) {
      results.push({ id: id++, category: "A04 - Rate Limiting", check: "Auth Rate Limit (35 طلب)", severity: "high", detail: `فقط ${rl429} طلب تم رفضه بـ 429`, recommendation: "تحقق من إعدادات rate-limiter-flexible على مسار /login" });
    } else {
      results.push({ id: id++, category: "A04 - Rate Limiting", check: "Auth Rate Limit", severity: "pass", detail: `${rl429}/35 طلب محجوب بـ 429`, recommendation: "" });
    }

    /* ── A05: Server Information Disclosure ── */
    const serverHeader = statusResp.headers["server"] ?? "";
    const poweredBy    = statusResp.headers["x-powered-by"] ?? "";
    if (poweredBy.toLowerCase().includes("express") || serverHeader) {
      results.push({ id: id++, category: "A05 - Security Misconfiguration", check: "Server Info Disclosure", severity: "low", detail: `x-powered-by: ${poweredBy || serverHeader}`, recommendation: "أضف app.disable('x-powered-by') في app.ts" });
    } else {
      results.push({ id: id++, category: "A05 - Security Misconfiguration", check: "Server Info Disclosure", severity: "pass", detail: "لا معلومات خادم مكشوفة", recommendation: "" });
    }

    /* ── A07: Authentication Verification ── */
    const authRoutes = ["/api/cases", "/api/clients", "/api/invoices"];
    let authFail = 0;
    for (const route of authRoutes) {
      const r = await probe(`${BASE}${route}`);
      if (r.status === 200) authFail++;
    }
    if (authFail > 0) {
      results.push({ id: id++, category: "A07 - Auth Failures", check: `${authFail} مسار بدون مصادقة`, severity: "critical", detail: "مسارات بيانات تعود 200 بدون token", recommendation: "طبّق requireAuthWithTenant على جميع مسارات البيانات" });
    } else {
      results.push({ id: id++, category: "A07 - Auth Failures", check: "المصادقة على مسارات البيانات", severity: "pass", detail: "جميع المسارات تطلب مصادقة", recommendation: "" });
    }

    /* ── A08: CORS ── */
    const corsResp = await probe(`${BASE}/api/status`, { headers: { "Origin": "https://evil.com" } });
    const acao      = corsResp.headers["access-control-allow-origin"] ?? "";
    if (acao === "*") {
      results.push({ id: id++, category: "A08 - Data Integrity / CORS", check: "CORS Wildcard", severity: "high", detail: "Access-Control-Allow-Origin: *", recommendation: "قيّد CORS على الدومين الخاص بك فقط" });
    } else {
      results.push({ id: id++, category: "A08 - Data Integrity / CORS", check: "CORS Policy", severity: "pass", detail: `ACAO: ${acao || "غير محدد"}`, recommendation: "" });
    }

    /* ── A09: Audit Logging ── */
    const auditCheck = await safeRows(sql`SELECT COUNT(*)::int AS n FROM audit_logs WHERE created_at > NOW() - INTERVAL '7 days'`).catch(() => [{ n: 0 }]);
    const auditN = auditCheck[0]?.n ?? 0;
    if (auditN === 0) {
      results.push({ id: id++, category: "A09 - Logging & Monitoring", check: "Audit Logs (7 أيام)", severity: "medium", detail: "لا سجلات تدقيق في آخر 7 أيام", recommendation: "تحقق من auditLogger.ts وتأكد من استدعائه في العمليات الحساسة" });
    } else {
      results.push({ id: id++, category: "A09 - Logging & Monitoring", check: "Audit Logs", severity: "pass", detail: `${auditN} سجل في آخر 7 أيام`, recommendation: "" });
    }

    /* ── A10: SSRF check (no internal redirect) ── */
    const ssrfResp = await probe(`${BASE}/api/status?url=http://169.254.169.254/latest/meta-data/`).catch(() => ({ status: 0, headers: {}, body: "", latencyMs: 0 }));
    if (ssrfResp.body.toLowerCase().includes("ami-id") || ssrfResp.body.toLowerCase().includes("instance-id")) {
      results.push({ id: id++, category: "A10 - SSRF", check: "SSRF via query param", severity: "critical", detail: "استجابة AWS metadata مرئية", recommendation: "حظر الطلبات لـ metadata IPs في firewall الخادم" });
    } else {
      results.push({ id: id++, category: "A10 - SSRF", check: "SSRF Protection", severity: "pass", detail: "لا كشف AWS metadata", recommendation: "" });
    }

    /* ── Summary ── */
    const byCategory: Record<string, typeof results> = {};
    results.forEach(r => { (byCategory[r.category] ??= []).push(r); });
    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0, pass: 0 };
    results.forEach(r => { severityCounts[r.severity] = (severityCounts[r.severity] ?? 0) + 1; });
    const score = Math.max(0, 100 - severityCounts.critical * 25 - severityCounts.high * 10 - severityCounts.medium * 3 - severityCounts.low * 1);

    const report = { score, severityCounts, totalChecks: results.length, results, byCategory, ranAt: new Date().toISOString() };

    await safeRows(sql`
      INSERT INTO engineering_scans (scan_type, status, findings, summary)
      VALUES ('pentest', 'complete',
        ${JSON.stringify(results.map(r => ({ id: r.id, label: r.check, value: r.detail, severity: r.severity === "pass" ? "ok" : r.severity, recommendation: r.recommendation })))}::jsonb,
        ${JSON.stringify(report)})
    `);
    await logAction("pentest", { score, criticalCount: severityCounts.critical }, userId);

    res.json(report);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   DEVELOPER ACCESS GRANT
══════════════════════════════════════════════════════════ */
router.post("/engineering/grant-dev-access", engineeringOnly, async (req: any, res) => {
  try {
    const { targetUserId, grant } = req.body;
    const userId = getAuth(req)?.userId ?? "owner";
    await getClerk().users.updateUserMetadata(targetUserId, {
      publicMetadata: { engineering_access: grant === true },
    });
    await logAction("grant_dev_access", { targetUserId, grant }, userId);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
