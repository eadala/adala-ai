/**
 * Financial Engine Routes — 9 endpoints
 * يُعرَّض تحت /api/financial-engine/*
 */
import { Router, type Request, type Response } from "express";
import { requireAuthWithTenant } from "../middlewares/requireAuth";
import {
  processTransaction,
  calculateRevenueSplit,
  getTenantBalance,
  getPlatformRevenueSummary,
  reconcile,
} from "../engine/financial.engine";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

function guard(req: any, res: any, next: any) {
  const meta = req.auth?.sessionClaims?.publicMetadata as any;
  if (meta?.role !== "super_admin") return res.status(403).json({ error: "super_admin only" });
  next();
}

/* ── GET /financial-engine/summary ── لوحة التحكم الرئيسية ── */
router.get("/financial-engine/summary", requireAuthWithTenant, guard, async (_req, res) => {
  try {
    const [platform, recon] = await Promise.all([
      getPlatformRevenueSummary(),
      reconcile(),
    ]);

    /* أحدث 5 معاملات */
    const recent = await db.execute(sql`
      SELECT id, office_id, amount, platform_fee, net_amount, status, gateway, created_at, client_name, description
      FROM payment_transactions
      ORDER BY created_at DESC LIMIT 5
    `);

    res.json({
      platform,
      reconciliation: recon,
      recentTransactions: recent.rows ?? recent,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── GET /financial-engine/balance/:officeId ── رصيد مكتب ── */
router.get("/financial-engine/balance/:officeId", requireAuthWithTenant, guard, async (req, res) => {
  try {
    const officeId = String(req.params.officeId);
    const balance = await getTenantBalance(officeId);
    res.json(balance);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── GET /financial-engine/ledger ── دفتر الأستاذ ── */
router.get("/financial-engine/ledger", requireAuthWithTenant, guard, async (req, res) => {
  try {
    const limit    = Math.min(Number(req.query.limit) || 50, 200);
    const officeId = req.query.officeId as string | undefined;
    const rows = await db.execute(sql`
      SELECT le.*, pt.client_name, pt.gateway, pt.status AS tx_status
      FROM ledger_entries le
      LEFT JOIN payment_transactions pt ON pt.id::text = le.transaction_ref
      ${officeId ? sql`WHERE le.office_id = ${officeId}` : sql``}
      ORDER BY le.created_at DESC
      LIMIT ${limit}
    `);
    res.json({ entries: rows.rows ?? rows });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── GET /financial-engine/transactions ── المعاملات ── */
router.get("/financial-engine/transactions", requireAuthWithTenant, guard, async (req, res) => {
  try {
    const limit    = Math.min(Number(req.query.limit) || 50, 200);
    const officeId = req.query.officeId as string | undefined;
    const status   = req.query.status   as string | undefined;
    const rows = await db.execute(sql`
      SELECT * FROM payment_transactions
      ${officeId ? sql`WHERE office_id = ${officeId}` : sql``}
      ${status   ? sql`AND status = ${status}`         : sql``}
      ORDER BY created_at DESC LIMIT ${limit}
    `);
    res.json({ transactions: rows.rows ?? rows });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── GET /financial-engine/reconcile ── مطابقة ── */
router.get("/financial-engine/reconcile", requireAuthWithTenant, guard, async (req, res) => {
  try {
    const officeId = req.query.officeId as string | undefined;
    const result   = await reconcile(officeId);

    /* تفاصيل إضافية حسب المكتب */
    const byOffice = await db.execute(sql`
      SELECT
        pt.office_id,
        COUNT(*) AS tx_count,
        COALESCE(SUM(pt.amount),0) AS gross_total,
        COALESCE(SUM(pt.net_amount),0) AS net_total,
        COALESCE(SUM(pt.platform_fee),0) AS fee_total
      FROM payment_transactions pt
      WHERE pt.status = 'completed'
      GROUP BY pt.office_id
      ORDER BY net_total DESC
      LIMIT 20
    `);

    res.json({ ...result, byOffice: byOffice.rows ?? byOffice });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── GET /financial-engine/revenue-split ── توزيع الإيرادات ── */
router.get("/financial-engine/revenue-split", requireAuthWithTenant, guard, async (req, res) => {
  try {
    const amount = Number(req.query.amount) || 1000;
    const source = (req.query.source as string) || "stripe";
    const split  = calculateRevenueSplit(amount, source);

    /* مجاميع فعلية */
    const actual = await db.execute(sql`
      SELECT
        COALESCE(SUM(platform_fee),0) AS total_platform,
        COALESCE(SUM(stripe_fee),0)   AS total_stripe,
        COALESCE(SUM(amount),0)       AS total_net,
        COUNT(*)                       AS entries
      FROM ledger_entries WHERE status = 'posted'
    `);
    const a = ((actual.rows ?? actual) as any[])[0] ?? {};

    res.json({
      simulation: { amount, source, ...split },
      actual: {
        platformFees: +Number(a.total_platform ?? 0).toFixed(2),
        stripeFees:   +Number(a.total_stripe   ?? 0).toFixed(2),
        netRevenue:   +Number(a.total_net      ?? 0).toFixed(2),
        entries:      Number(a.entries ?? 0),
      },
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── POST /financial-engine/ingest ── إدخال معاملة يدوياً ── */
router.post("/financial-engine/ingest", requireAuthWithTenant, guard, async (req, res) => {
  try {
    const {
      officeId, source = "manual", type = "payment",
      amount, currency = "SAR", description, clientName,
      invoiceId, caseId, metadata,
    } = req.body ?? {};

    if (!officeId || !amount || isNaN(Number(amount))) {
      return res.status(400).json({ error: "officeId و amount مطلوبان" });
    }

    const result = await processTransaction({
      officeId: String(officeId),
      source, type, amount: Number(amount), currency,
      description, clientName, invoiceId, caseId, metadata,
    });

    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── POST /financial-engine/test ── معاملة اختبارية ── */
router.post("/financial-engine/test", requireAuthWithTenant, guard, async (req, res) => {
  try {
    const officeId = req.body?.officeId ?? "test-office";
    const amount   = Number(req.body?.amount ?? 500);
    const result   = await processTransaction({
      officeId,
      source: "system",
      type: "payment",
      amount,
      currency: "SAR",
      description: `معاملة اختبارية — ${new Date().toLocaleString("ar-SA")}`,
      clientName: "اختبار",
    });
    res.json({ ...result, test: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── GET /financial-engine/offices-summary ── ملخص جميع المكاتب ── */
router.get("/financial-engine/offices-summary", requireAuthWithTenant, guard, async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        le.office_id,
        COUNT(*)                     AS entry_count,
        COALESCE(SUM(le.amount),0)   AS net_balance,
        COALESCE(SUM(le.platform_fee),0) AS platform_earned,
        MAX(le.balance_after)        AS latest_balance,
        MAX(le.created_at)           AS last_activity
      FROM ledger_entries le
      WHERE le.status = 'posted'
      GROUP BY le.office_id
      ORDER BY net_balance DESC
    `);
    res.json({ offices: rows.rows ?? rows });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
