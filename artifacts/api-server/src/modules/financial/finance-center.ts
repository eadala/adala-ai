import { requireAuth, requireAuthWithTenant } from "../../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import nodemailer from "nodemailer";

const router = Router();

function num(v: any) { return parseFloat(String(v ?? "0")) || 0; }

async function sqlOne(q: any): Promise<Record<string, any>> {
  try {
    const r = await db.execute(q) as any;
    return (Array.isArray(r) ? r[0] : r?.rows?.[0]) ?? {};
  } catch { return {}; }
}
async function sqlAll(q: any): Promise<Record<string, any>[]> {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}

function getTransporter() {
  const h = process.env.SMTP_HOST, u = process.env.SMTP_USER, p = process.env.SMTP_PASS;
  if (!h || !u || !p) return null;
  return nodemailer.createTransport({ host: h, port: parseInt(process.env.SMTP_PORT || "587"), secure: process.env.SMTP_SECURE === "true", auth: { user: u, pass: p } });
}

/* ─── GET /finance/dashboard ────────────────────────────────────────── */
router.get("/finance/dashboard", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const year = new Date().getFullYear();
    const MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

    const [revRow, invRow, expRow, payRow, advRow,
           paidInvRow, overdueInvRow, pendingInvRow, pendingAdvRow] = await Promise.all([
      sqlOne(sql`SELECT COALESCE(SUM(amount),0) AS total FROM revenues WHERE office_id=${tenantId}`),
      sqlOne(sql`SELECT COALESCE(SUM(total),0) AS total FROM client_invoices WHERE status='paid' AND office_id=${tenantId}`),
      sqlOne(sql`SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE office_id=${tenantId}`),
      sqlOne(sql`SELECT COALESCE(SUM(net_salary),0) AS total FROM payroll WHERE status='paid' AND office_id=${tenantId}`),
      sqlOne(sql`SELECT COALESCE(SUM(amount),0) AS total FROM cash_advances WHERE status NOT IN ('repaid','rejected') AND office_id=${tenantId}`),
      sqlOne(sql`SELECT COUNT(*) AS cnt, COALESCE(SUM(total),0) AS amt FROM client_invoices WHERE status='paid' AND office_id=${tenantId}`),
      sqlOne(sql`SELECT COUNT(*) AS cnt, COALESCE(SUM(total),0) AS amt FROM client_invoices WHERE (status='overdue' OR (status='sent' AND due_date < NOW())) AND office_id=${tenantId}`),
      sqlOne(sql`SELECT COUNT(*) AS cnt, COALESCE(SUM(total),0) AS amt FROM client_invoices WHERE status='sent' AND (due_date IS NULL OR due_date >= NOW()) AND office_id=${tenantId}`),
      sqlOne(sql`SELECT COUNT(*) AS cnt FROM cash_advances WHERE status='pending' AND office_id=${tenantId}`),
    ]);

    const totalRevenue  = num(revRow.total) + num(invRow.total);
    const totalExpenses = num(expRow.total) + num(payRow.total);

    const monthly = await Promise.all(MONTHS.map(async (name, idx) => {
      const m = String(idx + 1).padStart(2, "0");
      const from = `${year}-${m}-01`;
      const [mr, ir, me] = await Promise.all([
        sqlOne(sql`SELECT COALESCE(SUM(amount),0) AS v FROM revenues WHERE office_id=${tenantId} AND date >= ${from}::date AND date < ${from}::date + interval '1 month'`),
        sqlOne(sql`SELECT COALESCE(SUM(total),0) AS v FROM client_invoices WHERE status='paid' AND office_id=${tenantId} AND created_at >= ${from}::timestamp AND created_at < ${from}::timestamp + interval '1 month'`),
        sqlOne(sql`SELECT COALESCE(SUM(amount),0) AS v FROM expenses WHERE office_id=${tenantId} AND date >= ${from}::date AND date < ${from}::date + interval '1 month'`),
      ]);
      const rev = num(mr.v) + num(ir.v);
      const exp = num(me.v);
      return { month: name, revenue: rev, expenses: exp, profit: rev - exp };
    }));

    const expCats = await sqlAll(sql`SELECT category, COALESCE(SUM(amount),0) AS total FROM expenses WHERE office_id=${tenantId} GROUP BY category ORDER BY total DESC LIMIT 8`);
    const revCats = await sqlAll(sql`SELECT category, COALESCE(SUM(amount),0) AS total FROM revenues WHERE office_id=${tenantId} GROUP BY category ORDER BY total DESC LIMIT 8`);

    res.json({
      kpi: {
        totalRevenue, totalExpenses,
        netProfit: totalRevenue - totalExpenses,
        profitMargin: totalRevenue > 0 ? Math.round((totalRevenue - totalExpenses) / totalRevenue * 1000) / 10 : 0,
        paidInvoices:    { count: Number(paidInvRow.cnt ?? 0),    amount: num(paidInvRow.amt) },
        overdueInvoices: { count: Number(overdueInvRow.cnt ?? 0), amount: num(overdueInvRow.amt) },
        pendingInvoices: { count: Number(pendingInvRow.cnt ?? 0), amount: num(pendingInvRow.amt) },
        pendingAdvances: Number(pendingAdvRow.cnt ?? 0),
        outstandingAdvances: num(advRow.total),
      },
      monthly,
      expenseCategories: expCats.map(r => ({ name: r.category ?? "أخرى", value: num(r.total) })),
      revenueCategories: revCats.map(r => ({ name: r.category ?? "أخرى", value: num(r.total) })),
    });
  } catch (e: any) {
        res.status(500).json({ error: e.message });
  }
});

/* ─── GET /finance/collections ─────────────────────────────────────── */
router.get("/finance/collections", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const { status = "all" } = req.query as any;

    let statusClause = sql`i.status IN ('sent','overdue')`;
    if (status === "overdue") statusClause = sql`(i.status='overdue' OR (i.status='sent' AND i.due_date < NOW()))`;
    else if (status === "pending") statusClause = sql`(i.status='sent' AND (i.due_date IS NULL OR i.due_date >= NOW()))`;

    const rows = await sqlAll(sql`
      SELECT
        i.id, i.invoice_number, i.title, i.status, i.total, i.subtotal, i.vat_amount,
        i.due_date, i.created_at, i.stripe_payment_link_url,
        c.full_name AS client_name, c.email AS client_email, c.phone AS client_phone,
        cs.title AS case_title
      FROM client_invoices i
      LEFT JOIN clients c ON i.client_id = c.id AND c.office_id = ${tenantId}
      LEFT JOIN cases cs  ON i.case_id  = cs.id  AND cs.office_id = ${tenantId}
      WHERE ${statusClause} AND i.office_id = ${tenantId}
      ORDER BY i.due_date ASC NULLS LAST, i.created_at DESC
      LIMIT 200
    `);

    const summary = await sqlOne(sql`
      SELECT
        COUNT(*) FILTER (WHERE status='overdue' OR (status='sent' AND due_date < NOW())) AS overdue_count,
        COALESCE(SUM(total) FILTER (WHERE status='overdue' OR (status='sent' AND due_date < NOW())),0) AS overdue_amount,
        COUNT(*) FILTER (WHERE status='sent' AND (due_date IS NULL OR due_date >= NOW())) AS pending_count,
        COALESCE(SUM(total) FILTER (WHERE status='sent' AND (due_date IS NULL OR due_date >= NOW())),0) AS pending_amount
      FROM client_invoices
      WHERE status IN ('sent','overdue') AND office_id = ${tenantId}
    `);

    res.json({ invoices: rows, summary });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── GET /finance/collections/analytics ──────────────────────────── */
router.get("/finance/collections/analytics", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const [aging, rateRow, avgRow] = await Promise.all([
      sqlOne(sql`
        SELECT
          COUNT(*) FILTER (WHERE over_days BETWEEN 0 AND 30)   AS count_30,
          COALESCE(SUM(total) FILTER (WHERE over_days BETWEEN 0 AND 30),0)   AS amt_30,
          COUNT(*) FILTER (WHERE over_days BETWEEN 31 AND 60)  AS count_60,
          COALESCE(SUM(total) FILTER (WHERE over_days BETWEEN 31 AND 60),0)  AS amt_60,
          COUNT(*) FILTER (WHERE over_days BETWEEN 61 AND 90)  AS count_90,
          COALESCE(SUM(total) FILTER (WHERE over_days BETWEEN 61 AND 90),0)  AS amt_90,
          COUNT(*) FILTER (WHERE over_days > 90)               AS count_plus,
          COALESCE(SUM(total) FILTER (WHERE over_days > 90),0) AS amt_plus
        FROM (
          SELECT total, GREATEST(0, EXTRACT(DAY FROM NOW() - due_date)::integer) AS over_days
          FROM client_invoices
          WHERE status IN ('sent','overdue') AND due_date IS NOT NULL AND office_id = ${tenantId}
        ) t
      `),
      sqlOne(sql`
        SELECT
          COUNT(*) FILTER (WHERE status='paid') AS paid_count,
          COUNT(*) AS total_count,
          COALESCE(SUM(total) FILTER (WHERE status='paid'),0) AS paid_amt,
          COALESCE(SUM(total),0) AS total_amt
        FROM client_invoices
        WHERE office_id = ${tenantId}
      `),
      sqlOne(sql`
        SELECT ROUND(AVG(GREATEST(0, EXTRACT(DAY FROM NOW() - due_date))))::integer AS avg_days
        FROM client_invoices
        WHERE status IN ('sent','overdue') AND due_date IS NOT NULL AND office_id = ${tenantId}
      `),
    ]);

    const [topDebtors, monthlyCollections] = await Promise.all([
      sqlAll(sql`
        SELECT
          c.full_name AS client_name, c.phone AS client_phone,
          COUNT(i.id) AS inv_count,
          COALESCE(SUM(i.total),0) AS outstanding,
          MAX(GREATEST(0, EXTRACT(DAY FROM NOW() - i.due_date)::integer)) AS max_days_overdue
        FROM client_invoices i
        LEFT JOIN clients c ON i.client_id = c.id AND c.office_id = ${tenantId}
        WHERE i.status IN ('sent','overdue') AND i.office_id = ${tenantId}
        GROUP BY c.full_name, c.phone
        ORDER BY outstanding DESC LIMIT 5
      `),
      sqlAll(sql`
        SELECT
          TO_CHAR(paid_at, 'YYYY-MM') AS month,
          TO_CHAR(paid_at, 'Mon') AS month_label,
          COUNT(*) AS inv_count,
          COALESCE(SUM(total),0) AS collected
        FROM client_invoices
        WHERE status='paid' AND paid_at >= NOW() - interval '6 months' AND office_id = ${tenantId}
        GROUP BY TO_CHAR(paid_at,'YYYY-MM'), TO_CHAR(paid_at,'Mon')
        ORDER BY month ASC
      `),
    ]);

    const paidCount = Number(rateRow.paid_count ?? 0);
    const totalCount = Number(rateRow.total_count ?? 0);
    const paidAmt   = num(rateRow.paid_amt);
    const totalAmt  = num(rateRow.total_amt);

    res.json({
      aging: {
        bucket30:   { count: Number(aging.count_30 ?? 0),   amount: num(aging.amt_30)   },
        bucket60:   { count: Number(aging.count_60 ?? 0),   amount: num(aging.amt_60)   },
        bucket90:   { count: Number(aging.count_90 ?? 0),   amount: num(aging.amt_90)   },
        bucketPlus: { count: Number(aging.count_plus ?? 0), amount: num(aging.amt_plus) },
      },
      collectionRate:    totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0,
      amtCollectionRate: totalAmt  > 0 ? Math.round((paidAmt  / totalAmt)  * 100) : 0,
      avgDaysOverdue:    Number(avgRow.avg_days ?? 0),
      topDebtors: topDebtors.map(d => ({
        clientName:     d.client_name ?? "غير محدد",
        clientPhone:    d.client_phone ?? null,
        invCount:       Number(d.inv_count ?? 0),
        outstanding:    num(d.outstanding),
        maxDaysOverdue: Number(d.max_days_overdue ?? 0),
      })),
      monthlyCollections: monthlyCollections.map(m => ({
        month:     m.month_label ?? m.month,
        collected: num(m.collected),
        count:     Number(m.inv_count ?? 0),
      })),
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ─── GET /finance/collections/profitability ──────────────────────── */
router.get("/finance/collections/profitability", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const rows = await sqlAll(sql`
      SELECT
        c.id AS client_id, c.full_name AS client_name, c.phone AS client_phone,
        COUNT(i.id) AS total_invoices,
        COALESCE(SUM(i.total),0) AS total_billed,
        COALESCE(SUM(i.total) FILTER (WHERE i.status='paid'),0) AS total_collected,
        COALESCE(SUM(i.total) FILTER (WHERE i.status IN ('sent','overdue')),0) AS outstanding,
        COUNT(i.id) FILTER (WHERE i.status='paid') AS paid_count,
        ROUND(AVG(EXTRACT(DAY FROM i.paid_at - i.created_at)) FILTER (WHERE i.status='paid'))::integer AS avg_days_to_pay
      FROM clients c
      LEFT JOIN client_invoices i ON i.client_id = c.id AND i.office_id = ${tenantId}
      WHERE c.office_id = ${tenantId}
      GROUP BY c.id, c.full_name, c.phone
      HAVING COUNT(i.id) > 0
      ORDER BY total_billed DESC LIMIT 50
    `);
    res.json(rows.map(r => ({
      clientId:       r.client_id,
      clientName:     r.client_name ?? "غير محدد",
      clientPhone:    r.client_phone ?? null,
      totalInvoices:  Number(r.total_invoices ?? 0),
      totalBilled:    num(r.total_billed),
      totalCollected: num(r.total_collected),
      outstanding:    num(r.outstanding),
      paidCount:      Number(r.paid_count ?? 0),
      avgDaysToPay:   Number(r.avg_days_to_pay ?? 0),
      collectionRate: num(r.total_billed) > 0
        ? Math.round((num(r.total_collected) / num(r.total_billed)) * 100) : 0,
    })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /finance/intelligence — served by financialIntelligence.ts (registered first) */

/* ─── POST /finance/collections/bulk-reminder ────────────────────── */
router.post("/finance/collections/bulk-reminder", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const { invoiceIds } = req.body as { invoiceIds: string[] };
    if (!invoiceIds?.length) { res.status(400).json({ error: "لا توجد فواتير محددة" }); return; }
    const transporter = getTransporter();
    let sent = 0; let skipped = 0;
    for (const id of invoiceIds) {
      const rows = await sqlAll(sql`
        SELECT i.*, c.full_name AS client_name, c.email AS client_email
        FROM client_invoices i LEFT JOIN clients c ON i.client_id=c.id
        WHERE i.id=${id} AND i.office_id=${tenantId} LIMIT 1
      `);
      const inv = rows[0];
      if (!inv || !inv.client_email || !transporter) { skipped++; continue; }
      const totalSAR = (num(inv.total) / 100).toLocaleString("ar-SA", { maximumFractionDigits: 2 });
      const dueStr   = inv.due_date ? new Date(inv.due_date).toLocaleDateString("ar-SA") : "غير محدد";
      const html = `<div dir="rtl" style="font-family:'Cairo',Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;border:1px solid #e5e7eb;border-radius:12px">
        <h2 style="color:#C9A84C;border-bottom:2px solid #C9A84C;padding-bottom:12px">تذكير بسداد فاتورة</h2>
        <p>مرحباً ${inv.client_name ?? "عزيزنا العميل"}،</p>
        <div style="background:#f8f9fa;border-right:4px solid #C9A84C;padding:16px;border-radius:8px;margin:16px 0">
          <p><strong>رقم الفاتورة:</strong> ${inv.invoice_number ?? inv.id}</p>
          <p><strong>المبلغ الإجمالي:</strong> ${totalSAR} ر.س</p>
          <p><strong>تاريخ الاستحقاق:</strong> ${dueStr}</p></div>
        ${inv.stripe_payment_link_url ? `<a href="${inv.stripe_payment_link_url}" style="display:inline-block;background:#C9A84C;color:#0d1b2a;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold">ادفع الآن</a>` : ""}
        <hr style="margin-top:32px;border-color:#e5e7eb"/>
        <p style="color:#9ca3af;font-size:12px;text-align:center">عدالة AI — نظام التشغيل القانوني</p>
      </div>`;
      try {
        await transporter.sendMail({
          from: `"مكتب المحاماة" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
          to: inv.client_email,
          subject: `تذكير: فاتورة رقم ${inv.invoice_number ?? inv.id} مستحقة السداد`,
          html,
        });
        await db.execute(sql`INSERT INTO collection_activities (id,invoice_id,type,note) VALUES (gen_random_uuid()::text,${id},${'reminder_sent'},${'تم إرسال تذكير بالبريد الإلكتروني'})`).catch(()=>{});
        sent++;
      } catch { skipped++; }
    }
    res.json({ success: true, sent, skipped });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ─── POST /finance/collections/:id/payment ─────────────────────────── */
router.post("/finance/collections/:id/payment", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const { amount, paymentMethod = "bank_transfer", notes } = req.body;
    const { id } = req.params as Record<string, string>;

    // CRITICAL: always scope to tenant to prevent cross-office invoice manipulation
    const updated = await sqlOne(sql`
      UPDATE client_invoices SET status='paid', paid_at=NOW()
      WHERE id=${id} AND office_id=${tenantId}
      RETURNING id, invoice_number, total, client_id
    `);
    if (!updated?.id) {
      res.status(404).json({ error: "الفاتورة غير موجودة أو لا تنتمي لهذا المكتب" }); return;
    }

    await db.execute(sql`
      INSERT INTO revenues (title, category, amount, payment_method, date, client_id, notes)
      VALUES (
        ${'تحصيل فاتورة: ' + (updated.invoice_number ?? updated.id)},
        ${'invoice_collection'},
        ${String(amount ?? (num(updated.total) / 100))},
        ${paymentMethod},
        ${new Date().toISOString().split("T")[0]},
        ${updated.client_id ?? null},
        ${notes ?? null}
      )
    `).catch(() => {});

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── POST /finance/collections/:id/reminder ────────────────────────── */
router.post("/finance/collections/:id/reminder", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params as Record<string, string>;
    const rows = await sqlAll(sql`
      SELECT i.*, c.full_name AS client_name, c.email AS client_email
      FROM client_invoices i LEFT JOIN clients c ON i.client_id=c.id
      WHERE i.id=${id} AND i.office_id=${tenantId} LIMIT 1
    `);
    const inv = rows[0];
    if (!inv) { res.status(404).json({ error: "فاتورة غير موجودة" }); return; }

    const transporter = getTransporter();
    if (!transporter || !inv.client_email) {
      res.json({ success: false, reason: !transporter ? "SMTP غير مضبوط" : "لا يوجد بريد للعميل" }); return;
    }

    const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
    const totalSAR = (num(inv.total) / 100).toLocaleString("ar-SA", { maximumFractionDigits: 2 });
    const dueStr  = inv.due_date ? new Date(inv.due_date).toLocaleDateString("ar-SA") : "غير محدد";

    const html = `
      <div dir="rtl" style="font-family:'Cairo',Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;border:1px solid #e5e7eb;border-radius:12px">
        <h2 style="color:#C9A84C;border-bottom:2px solid #C9A84C;padding-bottom:12px">تذكير بسداد فاتورة</h2>
        <p>مرحباً ${inv.client_name ?? "عزيزنا العميل"}،</p>
        <p>نود تذكيركم بوجود فاتورة مستحقة السداد:</p>
        <div style="background:#f8f9fa;border-right:4px solid #C9A84C;padding:16px;border-radius:8px;margin:16px 0">
          <p><strong>رقم الفاتورة:</strong> ${inv.invoice_number ?? inv.id}</p>
          <p><strong>المبلغ الإجمالي:</strong> ${totalSAR} ر.س</p>
          <p><strong>تاريخ الاستحقاق:</strong> ${dueStr}</p>
        </div>
        ${inv.stripe_payment_link_url ? `<a href="${inv.stripe_payment_link_url}" style="display:inline-block;background:#C9A84C;color:#0d1b2a;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold">ادفع الآن</a>` : ""}
        <hr style="margin-top:32px;border-color:#e5e7eb"/>
        <p style="color:#9ca3af;font-size:12px;text-align:center">عدالة AI — نظام التشغيل القانوني</p>
      </div>`;

    await transporter.sendMail({
      from: `"مكتب المحاماة" <${from}>`,
      to: inv.client_email,
      subject: `تذكير: فاتورة رقم ${inv.invoice_number ?? inv.id} مستحقة السداد`,
      html,
      text: `تذكير بسداد فاتورة رقم ${inv.invoice_number ?? inv.id} بمبلغ ${totalSAR} ر.س — تاريخ الاستحقاق: ${dueStr}`,
    });

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── POST /finance/collections/:id/stage ────────────────────────── */
router.post("/finance/collections/:id/stage", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params as Record<string, string>;
    const { stage, notes } = req.body;
    // Verify invoice belongs to this tenant before updating
    const inv = await sqlOne(sql`SELECT id FROM client_invoices WHERE id=${id} AND office_id=${tenantId} LIMIT 1`);
    if (!inv?.id) { res.status(404).json({ error: "فاتورة غير موجودة" }); return; }

    await db.execute(sql`
      INSERT INTO collection_stages (id, invoice_id, stage, notes)
      VALUES (gen_random_uuid()::text, ${id}, ${stage}, ${notes ?? null})
    `);
    await db.execute(sql`
      INSERT INTO collection_activities (id, invoice_id, type, note)
      VALUES (gen_random_uuid()::text, ${id}, ${'stage_changed'}, ${`الانتقال إلى المرحلة ${stage}${notes ? ': ' + notes : ''}`})
    `).catch(() => {});
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ─── POST /finance/collections/:id/partial-payment ──────────────── */
router.post("/finance/collections/:id/partial-payment", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params as Record<string, string>;
    const { amount, paymentMethod = "bank_transfer", referenceNumber, notes } = req.body;
    const amtHalalas = Math.round(Number(amount) * 100);

    // Verify invoice belongs to this tenant
    const inv = await sqlOne(sql`SELECT id, total FROM client_invoices WHERE id=${id} AND office_id=${tenantId} LIMIT 1`);
    if (!inv?.id) { res.status(404).json({ error: "فاتورة غير موجودة" }); return; }

    await db.execute(sql`
      INSERT INTO partial_payments (id, invoice_id, amount, payment_method, reference_number, notes)
      VALUES (gen_random_uuid()::text, ${id}, ${amtHalalas}, ${paymentMethod}, ${referenceNumber ?? null}, ${notes ?? null})
    `);
    await db.execute(sql`
      INSERT INTO collection_activities (id, invoice_id, type, amount, note)
      VALUES (gen_random_uuid()::text, ${id}, ${'partial_payment'}, ${amtHalalas}, ${'دفعة جزئية: ' + amount + ' ر.س'})
    `).catch(() => {});

    const totRow = await sqlOne(sql`SELECT COALESCE(SUM(amount),0) AS total FROM partial_payments WHERE invoice_id=${id}`);
    const autoMarkedPaid = num(totRow.total) >= num(inv.total);
    if (autoMarkedPaid) {
      await db.execute(sql`UPDATE client_invoices SET status='paid', paid_at=NOW() WHERE id=${id} AND office_id=${tenantId}`);
    }
    res.json({ success: true, autoMarkedPaid });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ─── GET /finance/collections/:id/activities ────────────────────── */
router.get("/finance/collections/:id/activities", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params as Record<string, string>;
    // Verify invoice belongs to tenant
    const inv = await sqlOne(sql`SELECT id FROM client_invoices WHERE id=${id} AND office_id=${tenantId} LIMIT 1`);
    if (!inv?.id) { res.status(404).json({ error: "فاتورة غير موجودة" }); return; }

    const [activities, stages, partials] = await Promise.all([
      sqlAll(sql`SELECT * FROM collection_activities WHERE invoice_id=${id} ORDER BY created_at DESC`),
      sqlAll(sql`SELECT * FROM collection_stages      WHERE invoice_id=${id} ORDER BY created_at DESC LIMIT 1`),
      sqlAll(sql`SELECT * FROM partial_payments        WHERE invoice_id=${id} ORDER BY created_at DESC`),
    ]);
    res.json({ activities, currentStage: stages[0]?.stage ?? 0, partials });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
