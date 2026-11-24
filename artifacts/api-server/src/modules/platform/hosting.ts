import { Router } from "express";
import { requireSuperAdmin } from "../../middlewares/requireAuth";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getAuth, createClerkClient } from "@clerk/express";
import * as os from "os";
import { getProductionBaseUrl } from "../../lib/productionUrl";

const router = Router();
const adminOnly = requireSuperAdmin;

/* ── Auth ─────────────────────────────────────────── */
let _clerk: ReturnType<typeof createClerkClient> | null = null;
function getClerk() {
  if (!_clerk) _clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  return _clerk;
}

async function safeRows(q: any): Promise<any[]> {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}

function fmt(bytes: number) { return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
function uptimeFmt(sec: number) {
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  return d > 0 ? `${d}د ${h}س ${m}د` : h > 0 ? `${h}س ${m}د` : `${m}د`;
}

/* ══════════════════════════════════════════════════
   INFRASTRUCTURE STATUS
══════════════════════════════════════════════════ */
router.get("/hosting/status", adminOnly, async (_req, res) => {
  const mem = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem  = os.freemem();

  let dbStatus = "متصل";
  try { await db.execute(sql`SELECT 1`); } catch { dbStatus = "منقطع"; }

  /* Count all offices */
  const officesCount = await safeRows(sql`SELECT COUNT(*)::int AS cnt FROM office_page`);

  res.json({
    uptime:       uptimeFmt(process.uptime()),
    uptimeSec:    Math.floor(process.uptime()),
    nodeVersion:  process.version,
    platform:     os.platform(),
    arch:         os.arch(),
    hostname:     os.hostname(),
    cpuCores:     os.cpus().length,
    cpuModel:     os.cpus()[0]?.model?.slice(0, 40) ?? "—",
    env:          process.env.NODE_ENV ?? "development",
    dbStatus,
    memory: {
      heapUsed:    fmt(mem.heapUsed),
      heapTotal:   fmt(mem.heapTotal),
      rss:         fmt(mem.rss),
      systemUsed:  fmt(totalMem - freeMem),
      systemTotal: fmt(totalMem),
      usedPercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
    },
    productionUrl: getProductionBaseUrl({ required: false }),
    totalOffices:  officesCount[0]?.cnt ?? 0,
  });
});

/* ══════════════════════════════════════════════════
   DOMAINS
══════════════════════════════════════════════════ */
router.get("/hosting/domains", adminOnly, async (_req, res) => {
  const rows = await safeRows(sql`SELECT * FROM hosting_domains ORDER BY created_at DESC`);
  res.json(rows);
});

router.post("/hosting/domains", adminOnly, async (req, res) => {
  try {
    const { domain, domainType = "custom", provider = "cloudflare", officeId, officeName, notes } = req.body;
    if (!domain) return res.status(400).json({ error: "النطاق مطلوب" });
    const rows = await safeRows(sql`
      INSERT INTO hosting_domains (domain, domain_type, provider, office_id, office_name, notes)
      VALUES (${domain}, ${domainType}, ${provider}, ${officeId ?? null}, ${officeName ?? null}, ${notes ?? null})
      RETURNING *
    `);
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/hosting/domains/:id/verify", adminOnly, async (req, res) => {
  try {
    const rows = await safeRows(sql`
      UPDATE hosting_domains
      SET dns_verified = NOT dns_verified, status = CASE WHEN NOT dns_verified THEN 'active' ELSE 'pending' END, updated_at = NOW()
      WHERE id = ${String(req.params.id)}::uuid
      RETURNING *
    `);
    res.json(rows[0] ?? { ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/hosting/domains/:id/ssl", adminOnly, async (req, res) => {
  try {
    const rows = await safeRows(sql`
      UPDATE hosting_domains SET ssl_enabled = NOT ssl_enabled, updated_at = NOW()
      WHERE id = ${String(req.params.id)}::uuid RETURNING *
    `);
    res.json(rows[0] ?? { ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/hosting/domains/:id", adminOnly, async (req, res) => {
  try {
    await db.execute(sql`DELETE FROM hosting_domains WHERE id=${String(req.params.id)}::uuid`);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════
   PROVIDERS
══════════════════════════════════════════════════ */
router.get("/hosting/providers", adminOnly, async (_req, res) => {
  const rows = await safeRows(sql`SELECT * FROM hosting_providers ORDER BY created_at DESC`);
  /* Mask API keys */
  res.json(rows.map((r: any) => ({
    ...r,
    api_key: r.api_key ? r.api_key.slice(0, 8) + "…" : null,
  })));
});

router.post("/hosting/providers", adminOnly, async (req, res) => {
  try {
    const { providerName, providerType = "dns", apiKey, zoneId, endpoint, notes } = req.body;
    if (!providerName) return res.status(400).json({ error: "اسم المزود مطلوب" });
    const rows = await safeRows(sql`
      INSERT INTO hosting_providers (provider_name, provider_type, api_key, zone_id, endpoint, notes)
      VALUES (${providerName}, ${providerType}, ${apiKey ?? null}, ${zoneId ?? null}, ${endpoint ?? null}, ${notes ?? null})
      RETURNING id, provider_name, provider_type, zone_id, endpoint, notes, is_active, created_at
    `);
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/hosting/providers/:id/toggle", adminOnly, async (req, res) => {
  try {
    const rows = await safeRows(sql`
      UPDATE hosting_providers SET is_active = NOT is_active WHERE id=${String(req.params.id)}::uuid RETURNING *
    `);
    res.json(rows[0] ?? { ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/hosting/providers/:id", adminOnly, async (req, res) => {
  try {
    await db.execute(sql`DELETE FROM hosting_providers WHERE id=${String(req.params.id)}::uuid`);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════
   OFFICES SUBDOMAINS  (read from office_page table)
══════════════════════════════════════════════════ */
router.get("/hosting/offices-subdomains", adminOnly, async (_req, res) => {
  try {
    const offices = await safeRows(sql`
      SELECT id, name, slug, plan, email, phone, is_published, created_at
      FROM office_page ORDER BY created_at DESC
    `);
    const productionBase = getProductionBaseUrl({ required: false });
    res.json(offices.map((o: any) => ({
      ...o,
      subdomain:   `${o.slug}`,
      previewUrl:  productionBase ? `${productionBase}/firms/${o.slug}` : `/firms/${o.slug}`,
    })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════
   DOMAIN DNS RECORDS  (simulate / Cloudflare info)
══════════════════════════════════════════════════ */
router.get("/hosting/dns-guide", adminOnly, (_req, res) => {
  const productionBase = getProductionBaseUrl({ required: false });
  const cnameTarget = productionBase
    ? new URL(productionBase).host
    : "your-production-domain.com";
  res.json({
    cname: cnameTarget,
    targetIp: "CNAME → origin host",
    instructions: [
      { step: 1, desc: "في لوحة تحكم DNS (Cloudflare/GoDaddy)، أضف سجل CNAME" },
      { step: 2, desc: `اجعل القيمة تشير إلى: ${cnameTarget}` },
      { step: 3, desc: "فعّل الوضع Proxied في Cloudflare لتفعيل SSL تلقائياً" },
      { step: 4, desc: "انتظر حتى 24 ساعة لنشر DNS، ثم اضغط 'تحقق'" },
    ],
  });
});

export default router;
