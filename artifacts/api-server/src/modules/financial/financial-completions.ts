/**
 * Financial Completions — عدالة AI
 * ─────────────────────────────────────────────────────────────────────────
 * يُكمل النظام المالي الموجود بدون كسر أي API أو جدول.
 * جميع التغييرات Backward Compatible.
 *
 * يُضيف:
 *  1. إعدادات الضريبة على مستوى المكتب (office_tax_settings)
 *  2. سجل إصدارات الفاتورة (invoice_revisions)
 *  3. إشعارات الدائن/المدين (credit_notes)
 *  4. رقم الفاتورة التسلسلي + بيانات ZATCA الأساسية
 *  5. تقارير موسعة: حسب القضية / العميل / المحامي / الذمم المدينة / مقارنة الفترات
 *  6. مساعد AI المالي (قراءة فقط - لا تعديل)
 *  7. ملخص مالي موحد — مصدر بيانات واحد لجميع التقارير
 */

import { Router, type Request, type Response } from "express";
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { callAI } from "../ai/aiChat";
import { auditLog, auditMeta } from "../../lib/auditLogger";

const router = Router();

/* ─── helpers ──────────────────────────────────────────────────────── */
function rows(r: any): any[] { return Array.isArray(r) ? r : (r?.rows ?? []); }
function one(r: any): any    { return rows(r)[0] ?? {}; }
async function sqlAll(q: any): Promise<any[]> {
  try { return rows(await db.execute(q)); } catch { return []; }
}
async function sqlOne(q: any): Promise<any> {
  return (await sqlAll(q))[0] ?? {};
}
function num(v: any): number { return parseFloat(String(v ?? "0")) || 0; }
function apiErr(res: Response, status: number, code: string, msg: string) {
  return res.status(status).json({ error: msg, code });
}

/* ══════════════════════════════════════════════════════════════════════
   DB MIGRATIONS — تُشغَّل مرة واحدة عند التحميل
══════════════════════════════════════════════════════════════════════ */
async function ensureFinancialCompletionTables() {
  /* 1. إعدادات الضريبة على مستوى المكتب */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS office_tax_settings (
      id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      office_id    TEXT NOT NULL UNIQUE,
      tax_enabled  BOOLEAN NOT NULL DEFAULT true,
      tax_rate     NUMERIC(5,2) NOT NULL DEFAULT 15,
      tax_type     TEXT NOT NULL DEFAULT 'VAT',
      tax_number   TEXT,
      tax_exempt   BOOLEAN NOT NULL DEFAULT false,
      zatca_enabled BOOLEAN NOT NULL DEFAULT false,
      notes        TEXT,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});

  /* 2. سجل إصدارات الفاتورة */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS invoice_revisions (
      id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      invoice_id   TEXT NOT NULL,
      office_id    TEXT NOT NULL,
      version      INTEGER NOT NULL DEFAULT 1,
      changed_by   TEXT NOT NULL,
      change_type  TEXT NOT NULL DEFAULT 'edit',
      snapshot     JSONB NOT NULL,
      old_snapshot JSONB,
      changed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_invoice_revisions_invoice ON invoice_revisions(invoice_id)
  `).catch(() => {});

  /* 3. إشعارات الدائن (Credit Notes) */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS credit_notes (
      id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      office_id           TEXT NOT NULL,
      original_invoice_id TEXT NOT NULL,
      credit_number       TEXT NOT NULL,
      client_id           TEXT,
      client_name         TEXT,
      case_id             TEXT,
      amount              NUMERIC(12,2) NOT NULL,
      tax_amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
      total               NUMERIC(12,2) NOT NULL,
      reason              TEXT NOT NULL,
      status              TEXT NOT NULL DEFAULT 'issued',
      notes               TEXT,
      issued_by           TEXT,
      issued_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_credit_notes_office ON credit_notes(office_id)
  `).catch(() => {});

  /* 4. حقول إضافية على client_invoices */
  await db.execute(sql`
    ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS invoice_number TEXT
  `).catch(() => {});

  await db.execute(sql`
    ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS zatca_uuid TEXT
  `).catch(() => {});

  await db.execute(sql`
    ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS qr_code_data TEXT
  `).catch(() => {});

  await db.execute(sql`
    ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ
  `).catch(() => {});

  await db.execute(sql`
    ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS linked_credit_note_id TEXT
  `).catch(() => {});

  /* تسلسل أرقام الفواتير */
  await db.execute(sql`
    CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1
  `).catch(() => {});

  /* ملء invoice_number للفواتير القديمة التي لا تملكه */
  await db.execute(sql`
    UPDATE client_invoices
    SET invoice_number = 'INV-' || TO_CHAR(created_at, 'YYYY') || '-' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::text, 4, '0')
    WHERE invoice_number IS NULL
  `).catch(() => {});
}

ensureFinancialCompletionTables().catch(console.error);

/* ══════════════════════════════════════════════════════════════════════
   1. إعدادات الضريبة على مستوى المكتب
══════════════════════════════════════════════════════════════════════ */

router.get("/accounting/tax-settings", requireAuthWithTenant, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId as string;
  try {
    const row = await sqlOne(sql`
      SELECT * FROM office_tax_settings WHERE office_id = ${tenantId}
    `);
    if (!row?.id) {
      return res.json({
        taxEnabled: true, taxRate: 15, taxType: "VAT",
        taxNumber: null, taxExempt: false, zatcaEnabled: false, notes: null,
      });
    }
    res.json({
      taxEnabled:   row.tax_enabled,
      taxRate:      num(row.tax_rate),
      taxType:      row.tax_type,
      taxNumber:    row.tax_number,
      taxExempt:    row.tax_exempt,
      zatcaEnabled: row.zatca_enabled,
      notes:        row.notes,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/accounting/tax-settings", requireAuthWithTenant, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId as string;
  const userId   = (req as any).auth?.userId as string;
  try {
    const { taxEnabled, taxRate, taxType, taxNumber, taxExempt, zatcaEnabled, notes } = req.body;
    await db.execute(sql`
      INSERT INTO office_tax_settings (office_id, tax_enabled, tax_rate, tax_type, tax_number, tax_exempt, zatca_enabled, notes)
      VALUES (
        ${tenantId},
        ${taxEnabled ?? true},
        ${num(taxRate) || 15},
        ${taxType ?? "VAT"},
        ${taxNumber ?? null},
        ${taxExempt ?? false},
        ${zatcaEnabled ?? false},
        ${notes ?? null}
      )
      ON CONFLICT (office_id) DO UPDATE SET
        tax_enabled   = EXCLUDED.tax_enabled,
        tax_rate      = EXCLUDED.tax_rate,
        tax_type      = EXCLUDED.tax_type,
        tax_number    = EXCLUDED.tax_number,
        tax_exempt    = EXCLUDED.tax_exempt,
        zatca_enabled = EXCLUDED.zatca_enabled,
        notes         = EXCLUDED.notes,
        updated_at    = NOW()
    `);
    await auditLog({ ...auditMeta(req as any), action: "UPDATE", resource: "tax_settings", resourceId: tenantId, details: `taxRate=${taxRate} taxEnabled=${taxEnabled}` });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════════════════
   2. سجل إصدارات الفاتورة
══════════════════════════════════════════════════════════════════════ */

router.get("/invoices/:id/revisions", requireAuthWithTenant, async (req: Request, res: Response) => {
  const tenantId  = (req as any).tenantId as string;
  const invoiceId = String(req.params.id);
  try {
    const invoice = await sqlOne(sql`
      SELECT id FROM client_invoices WHERE id::text = ${invoiceId} AND office_id = ${tenantId}
    `);
    if (!invoice?.id) return apiErr(res, 404, "NOT_FOUND", "الفاتورة غير موجودة");

    const revisions = await sqlAll(sql`
      SELECT * FROM invoice_revisions
      WHERE invoice_id = ${invoiceId} AND office_id = ${tenantId}
      ORDER BY version DESC
    `);
    res.json(revisions);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* دالة مساعدة: تُسجّل مراجعة فاتورة (تُستدعى داخلياً) */
export async function recordInvoiceRevision({
  invoiceId, officeId, changedBy, changeType, snapshot, oldSnapshot,
}: {
  invoiceId: string; officeId: string; changedBy: string;
  changeType: string; snapshot: any; oldSnapshot?: any;
}) {
  try {
    const { version } = await sqlOne(sql`
      SELECT COALESCE(MAX(version), 0) + 1 AS version
      FROM invoice_revisions
      WHERE invoice_id = ${invoiceId} AND office_id = ${officeId}
    `);
    await db.execute(sql`
      INSERT INTO invoice_revisions (invoice_id, office_id, version, changed_by, change_type, snapshot, old_snapshot)
      VALUES (${invoiceId}, ${officeId}, ${version || 1}, ${changedBy}, ${changeType},
              ${JSON.stringify(snapshot)}, ${oldSnapshot ? JSON.stringify(oldSnapshot) : null})
    `);
  } catch { /* non-blocking */ }
}

/* ══════════════════════════════════════════════════════════════════════
   3. إشعارات الدائن (Credit Notes)
══════════════════════════════════════════════════════════════════════ */

router.get("/accounting/credit-notes", requireAuthWithTenant, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId as string;
  try {
    const data = await sqlAll(sql`
      SELECT cn.*, ci.title AS invoice_title, ci.invoice_number
      FROM credit_notes cn
      LEFT JOIN client_invoices ci ON ci.id::text = cn.original_invoice_id
      WHERE cn.office_id = ${tenantId}
      ORDER BY cn.issued_at DESC
    `);
    res.json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/invoices/:id/credit-note", requireAuthWithTenant, async (req: Request, res: Response) => {
  const tenantId  = (req as any).tenantId as string;
  const userId    = (req as any).auth?.userId as string;
  const invoiceId = String(req.params.id);
  try {
    const invoice = await sqlOne(sql`
      SELECT * FROM client_invoices WHERE id::text = ${invoiceId} AND office_id = ${tenantId}
    `);
    if (!invoice?.id) return apiErr(res, 404, "NOT_FOUND", "الفاتورة غير موجودة");
    if (invoice.status === "draft") return apiErr(res, 400, "DRAFT", "لا يمكن إصدار إشعار دائن على مسودة");

    const { reason, amount, fullCredit } = req.body;
    if (!reason) return apiErr(res, 400, "REQUIRED", "يجب ذكر سبب الإشعار");

    const creditAmount = fullCredit ? num(invoice.total) : num(amount);
    if (creditAmount <= 0) return apiErr(res, 400, "INVALID_AMOUNT", "المبلغ يجب أن يكون أكبر من صفر");
    if (creditAmount > num(invoice.total)) return apiErr(res, 400, "EXCEEDS", "المبلغ أكبر من إجمالي الفاتورة");

    const taxSettings = await sqlOne(sql`
      SELECT tax_rate FROM office_tax_settings WHERE office_id = ${tenantId}
    `);
    const taxRate = num(taxSettings?.tax_rate) || num(invoice.vat_rate) || 15;
    const taxAmount  = +(creditAmount * taxRate / (100 + taxRate)).toFixed(2);
    const totalCredit = +creditAmount.toFixed(2);

    const year  = new Date().getFullYear();
    const count = await sqlOne(sql`SELECT COUNT(*) AS cnt FROM credit_notes WHERE office_id = ${tenantId}`);
    const seq   = (Number(count?.cnt ?? 0) + 1).toString().padStart(4, "0");
    const creditNumber = `CN-${year}-${seq}`;

    const cn = one(await db.execute(sql`
      INSERT INTO credit_notes (
        office_id, original_invoice_id, credit_number,
        client_id, client_name, case_id,
        amount, tax_amount, total, reason, issued_by
      ) VALUES (
        ${tenantId}, ${invoiceId}, ${creditNumber},
        ${invoice.client_id ?? null}, ${invoice.client_name ?? null}, ${invoice.case_id ?? null},
        ${creditAmount - taxAmount}, ${taxAmount}, ${totalCredit},
        ${reason}, ${userId}
      ) RETURNING *
    `));

    /* رسالة في audit log */
    await auditLog({ ...auditMeta(req as any), action: "CREATE", resource: "credit_note", resourceId: cn.id, details: `invoice=${invoiceId} creditNumber=${creditNumber} amount=${totalCredit}` });

    res.status(201).json(cn);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════════════════
   4. ZATCA — رقم الفاتورة + بيانات QR الأساسية
══════════════════════════════════════════════════════════════════════ */

router.get("/invoices/:id/zatca", requireAuthWithTenant, async (req: Request, res: Response) => {
  const tenantId  = (req as any).tenantId as string;
  const invoiceId = String(req.params.id);
  try {
    const invoice = await sqlOne(sql`
      SELECT ci.*, ots.tax_number, ots.tax_rate AS office_tax_rate, ots.zatca_enabled
      FROM client_invoices ci
      LEFT JOIN office_tax_settings ots ON ots.office_id = ci.office_id
      WHERE ci.id::text = ${invoiceId} AND ci.office_id = ${tenantId}
    `);
    if (!invoice?.id) return apiErr(res, 404, "NOT_FOUND", "الفاتورة غير موجودة");

    /* توليد UUID للـ ZATCA إن لم يكن موجوداً */
    let zatcaUuid = invoice.zatca_uuid;
    if (!zatcaUuid) {
      const upd = one(await db.execute(sql`
        UPDATE client_invoices
        SET zatca_uuid = gen_random_uuid()::text
        WHERE id::text = ${invoiceId} AND office_id = ${tenantId}
        RETURNING zatca_uuid
      `));
      zatcaUuid = upd.zatca_uuid;
    }

    /* بيانات QR وفق TLV السعودي (Base64) */
    const sellerName = "مكتب محاماة";
    const taxNumber  = invoice.tax_number ?? "300000000000003";
    const timestamp  = invoice.created_at;
    const totalStr   = String(num(invoice.total));
    const vatStr     = String(num(invoice.vat_amount));

    const tlvFields = [
      { tag: 1, value: sellerName },
      { tag: 2, value: taxNumber },
      { tag: 3, value: timestamp },
      { tag: 4, value: totalStr },
      { tag: 5, value: vatStr },
    ];

    function encodeTLV(tag: number, val: string): Buffer {
      const valBuf = Buffer.from(val, "utf8");
      return Buffer.concat([Buffer.from([tag, valBuf.length]), valBuf]);
    }
    const qrBuffer = Buffer.concat(tlvFields.map(f => encodeTLV(f.tag, f.value)));
    const qrBase64 = qrBuffer.toString("base64");

    if (!invoice.qr_code_data) {
      await db.execute(sql`
        UPDATE client_invoices SET qr_code_data = ${qrBase64}
        WHERE id::text = ${invoiceId} AND office_id = ${tenantId}
      `);
    }

    res.json({
      invoiceNumber: invoice.invoice_number,
      zatcaUuid,
      qrCodeBase64: qrBase64,
      taxNumber,
      sellerName,
      issuedAt:   invoice.created_at,
      total:      num(invoice.total),
      vatAmount:  num(invoice.vat_amount),
      currency:   invoice.currency ?? "SAR",
      zatcaEnabled: !!invoice.zatca_enabled,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════════════════
   5. التقارير الموسعة
══════════════════════════════════════════════════════════════════════ */

/* 5-A: الإيرادات حسب القضية */
router.get("/accounting/reports/by-case", requireAuthWithTenant, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId as string;
  const { from, to, limit } = req.query;
  const lim = Math.min(Number(limit) || 50, 200);
  try {
    const data = await sqlAll(sql`
      SELECT
        r.case_id,
        c.title        AS case_title,
        c.case_number,
        COUNT(r.id)    AS entries_count,
        SUM(r.amount)  AS total_revenue,
        MAX(r.date)    AS last_entry_date,
        ARRAY_AGG(DISTINCT r.category) FILTER (WHERE r.category IS NOT NULL) AS categories
      FROM revenues r
      LEFT JOIN cases c ON c.id::text = r.case_id
      WHERE r.office_id = ${tenantId}
        AND r.deleted_at IS NULL
        AND r.case_id IS NOT NULL
        ${from ? sql`AND r.date >= ${from}` : sql``}
        ${to   ? sql`AND r.date <= ${to}`   : sql``}
      GROUP BY r.case_id, c.title, c.case_number
      ORDER BY total_revenue DESC
      LIMIT ${lim}
    `);

    /* أيضاً الفواتير المدفوعة مرتبطة بقضايا */
    const invoiceData = await sqlAll(sql`
      SELECT
        ci.case_id,
        c.title       AS case_title,
        c.case_number,
        COUNT(ci.id)  AS invoices_count,
        SUM(ci.total) AS invoiced_total,
        SUM(ci.amount_paid) AS collected_total
      FROM client_invoices ci
      LEFT JOIN cases c ON c.id::text = ci.case_id
      WHERE ci.office_id = ${tenantId}
        AND ci.case_id IS NOT NULL
        AND ci.status IN ('paid','partially_paid')
        ${from ? sql`AND ci.created_at >= ${from}` : sql``}
        ${to   ? sql`AND ci.created_at <= ${to}`   : sql``}
      GROUP BY ci.case_id, c.title, c.case_number
      ORDER BY invoiced_total DESC
      LIMIT ${lim}
    `);

    res.json({ revenues: data, invoices: invoiceData });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* 5-B: الإيرادات حسب العميل */
router.get("/accounting/reports/by-client", requireAuthWithTenant, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId as string;
  const { from, to } = req.query;
  try {
    const data = await sqlAll(sql`
      SELECT
        ci.client_id,
        COALESCE(cl.name, ci.client_name, 'غير محدد') AS client_name,
        cl.phone,
        cl.email,
        COUNT(ci.id)         AS invoices_count,
        SUM(ci.subtotal)     AS subtotal_total,
        SUM(ci.vat_amount)   AS vat_total,
        SUM(ci.total)        AS grand_total,
        SUM(ci.amount_paid)  AS paid_total,
        SUM(ci.total) - SUM(ci.amount_paid) AS outstanding,
        MAX(ci.created_at)   AS last_invoice_date,
        COUNT(CASE WHEN ci.status = 'overdue' THEN 1 END) AS overdue_count
      FROM client_invoices ci
      LEFT JOIN clients cl ON cl.id::text = ci.client_id
      WHERE ci.office_id = ${tenantId}
        ${from ? sql`AND ci.created_at >= ${from}` : sql``}
        ${to   ? sql`AND ci.created_at <= ${to}`   : sql``}
      GROUP BY ci.client_id, cl.name, ci.client_name, cl.phone, cl.email
      ORDER BY grand_total DESC
      LIMIT 100
    `);
    res.json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* 5-C: الإيرادات حسب الفئة مع مقارنة الفترات */
router.get("/accounting/reports/period-comparison", requireAuthWithTenant, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId as string;
  const period   = (req.query.period as string) || "month";

  function periodSql(offset: number) {
    if (period === "month") {
      return sql`DATE_TRUNC('month', NOW() - (${offset} || ' month')::INTERVAL)`;
    } else if (period === "quarter") {
      return sql`DATE_TRUNC('quarter', NOW() - (${offset * 3} || ' month')::INTERVAL)`;
    } else {
      return sql`DATE_TRUNC('year', NOW() - (${offset} || ' year')::INTERVAL)`;
    }
  }

  try {
    const [currRev, prevRev, currExp, prevExp, currInv, prevInv] = await Promise.all([
      sqlOne(sql`
        SELECT COALESCE(SUM(amount),0) AS total FROM revenues
        WHERE office_id = ${tenantId} AND deleted_at IS NULL
          AND date >= ${periodSql(0)}
      `),
      sqlOne(sql`
        SELECT COALESCE(SUM(amount),0) AS total FROM revenues
        WHERE office_id = ${tenantId} AND deleted_at IS NULL
          AND date >= ${periodSql(1)} AND date < ${periodSql(0)}
      `),
      sqlOne(sql`
        SELECT COALESCE(SUM(amount),0) AS total FROM expenses
        WHERE office_id = ${tenantId} AND deleted_at IS NULL
          AND date >= ${periodSql(0)}
      `),
      sqlOne(sql`
        SELECT COALESCE(SUM(amount),0) AS total FROM expenses
        WHERE office_id = ${tenantId} AND deleted_at IS NULL
          AND date >= ${periodSql(1)} AND date < ${periodSql(0)}
      `),
      sqlOne(sql`
        SELECT COALESCE(SUM(total),0) AS invoiced, COALESCE(SUM(amount_paid),0) AS collected
        FROM client_invoices
        WHERE office_id = ${tenantId} AND created_at >= ${periodSql(0)}
      `),
      sqlOne(sql`
        SELECT COALESCE(SUM(total),0) AS invoiced, COALESCE(SUM(amount_paid),0) AS collected
        FROM client_invoices
        WHERE office_id = ${tenantId}
          AND created_at >= ${periodSql(1)} AND created_at < ${periodSql(0)}
      `),
    ]);

    function growth(curr: number, prev: number) {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return +((curr - prev) / prev * 100).toFixed(1);
    }

    const curr = {
      revenue:   num(currRev.total),
      expenses:  num(currExp.total),
      profit:    num(currRev.total) - num(currExp.total),
      invoiced:  num(currInv.invoiced),
      collected: num(currInv.collected),
    };
    const prev = {
      revenue:   num(prevRev.total),
      expenses:  num(prevExp.total),
      profit:    num(prevRev.total) - num(prevExp.total),
      invoiced:  num(prevInv.invoiced),
      collected: num(prevInv.collected),
    };

    res.json({
      period,
      current: curr,
      previous: prev,
      growth: {
        revenue:   growth(curr.revenue,   prev.revenue),
        expenses:  growth(curr.expenses,  prev.expenses),
        profit:    growth(curr.profit,    prev.profit),
        invoiced:  growth(curr.invoiced,  prev.invoiced),
        collected: growth(curr.collected, prev.collected),
      },
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* 5-D: الذمم المدينة (AR Aging) */
router.get("/accounting/reports/ar-aging", requireAuthWithTenant, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId as string;
  try {
    const invoices = await sqlAll(sql`
      SELECT
        ci.id,
        ci.invoice_number,
        COALESCE(cl.name, ci.client_name, 'غير محدد') AS client_name,
        ci.total,
        ci.amount_paid,
        ci.total - ci.amount_paid AS outstanding,
        ci.due_date,
        ci.status,
        CURRENT_DATE - ci.due_date::date AS days_overdue,
        ci.case_id,
        c.title AS case_title
      FROM client_invoices ci
      LEFT JOIN clients cl ON cl.id::text = ci.client_id
      LEFT JOIN cases c ON c.id::text = ci.case_id
      WHERE ci.office_id = ${tenantId}
        AND ci.status NOT IN ('paid','cancelled','draft')
        AND ci.total > ci.amount_paid
      ORDER BY ci.due_date ASC NULLS LAST
    `);

    const aging = {
      current:    [] as any[],
      days30:     [] as any[],
      days60:     [] as any[],
      days90:     [] as any[],
      over90:     [] as any[],
    };

    for (const inv of invoices) {
      const days = Number(inv.days_overdue ?? 0);
      if (days <= 0)       aging.current.push(inv);
      else if (days <= 30) aging.days30.push(inv);
      else if (days <= 60) aging.days60.push(inv);
      else if (days <= 90) aging.days90.push(inv);
      else                 aging.over90.push(inv);
    }

    function sum(arr: any[]) {
      return arr.reduce((s, r) => s + num(r.outstanding), 0);
    }

    res.json({
      summary: {
        current:  { count: aging.current.length,  total: +sum(aging.current).toFixed(2) },
        days1_30: { count: aging.days30.length,   total: +sum(aging.days30).toFixed(2) },
        days31_60:{ count: aging.days60.length,   total: +sum(aging.days60).toFixed(2) },
        days61_90:{ count: aging.days90.length,   total: +sum(aging.days90).toFixed(2) },
        over90:   { count: aging.over90.length,   total: +sum(aging.over90).toFixed(2) },
        grandTotal: +sum(invoices).toFixed(2),
      },
      details: aging,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* 5-E: الإيرادات حسب المحامي (المسؤول عن القضية) */
router.get("/accounting/reports/by-lawyer", requireAuthWithTenant, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId as string;
  const { from, to } = req.query;
  try {
    const data = await sqlAll(sql`
      SELECT
        c.assigned_to          AS lawyer_id,
        COALESCE(u.full_name, c.assigned_to, 'غير محدد') AS lawyer_name,
        COUNT(DISTINCT ci.id)  AS invoices_count,
        COUNT(DISTINCT ci.case_id) AS cases_count,
        SUM(ci.total)          AS invoiced_total,
        SUM(ci.amount_paid)    AS collected_total,
        SUM(ci.total) - SUM(ci.amount_paid) AS outstanding
      FROM client_invoices ci
      JOIN cases c ON c.id::text = ci.case_id
      LEFT JOIN users u ON u.id = c.assigned_to
      WHERE ci.office_id = ${tenantId}
        AND ci.case_id IS NOT NULL
        ${from ? sql`AND ci.created_at >= ${from}` : sql``}
        ${to   ? sql`AND ci.created_at <= ${to}`   : sql``}
      GROUP BY c.assigned_to, u.full_name
      ORDER BY collected_total DESC
      LIMIT 50
    `);
    res.json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════════════════
   6. الملخص المالي الموحد — مصدر بيانات واحد لجميع التقارير
══════════════════════════════════════════════════════════════════════ */

router.get("/accounting/unified-summary", requireAuthWithTenant, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId as string;
  const year = Number(req.query.year) || new Date().getFullYear();
  try {
    const [
      revTotal, expTotal,
      invoiceStats, payrollTotal,
      topExpCats, revByMonth, expByMonth,
      arTotal, creditNotesTotal,
    ] = await Promise.all([
      sqlOne(sql`
        SELECT COALESCE(SUM(amount),0) AS total FROM revenues
        WHERE office_id = ${tenantId} AND deleted_at IS NULL
          AND EXTRACT(YEAR FROM date::date) = ${year}
      `),
      sqlOne(sql`
        SELECT COALESCE(SUM(amount),0) AS total FROM expenses
        WHERE office_id = ${tenantId} AND deleted_at IS NULL
          AND EXTRACT(YEAR FROM date::date) = ${year}
      `),
      sqlOne(sql`
        SELECT
          COUNT(*) FILTER (WHERE status = 'paid')            AS paid_count,
          COUNT(*) FILTER (WHERE status IN ('sent','overdue')) AS unpaid_count,
          COUNT(*) FILTER (WHERE status = 'overdue')         AS overdue_count,
          COALESCE(SUM(total),0)                             AS invoiced_total,
          COALESCE(SUM(amount_paid),0)                       AS collected_total,
          COALESCE(SUM(total) - SUM(amount_paid),0)         AS outstanding_total
        FROM client_invoices
        WHERE office_id = ${tenantId}
          AND EXTRACT(YEAR FROM created_at) = ${year}
      `),
      sqlOne(sql`
        SELECT COALESCE(SUM(net_salary),0) AS total FROM payroll
        WHERE office_id = ${tenantId} AND status = 'paid'
          AND EXTRACT(YEAR FROM pay_date::date) = ${year}
      `),
      sqlAll(sql`
        SELECT category, COALESCE(SUM(amount),0) AS total FROM expenses
        WHERE office_id = ${tenantId} AND deleted_at IS NULL
          AND EXTRACT(YEAR FROM date::date) = ${year}
        GROUP BY category ORDER BY total DESC LIMIT 5
      `),
      sqlAll(sql`
        SELECT EXTRACT(MONTH FROM date::date) AS month, COALESCE(SUM(amount),0) AS total
        FROM revenues
        WHERE office_id = ${tenantId} AND deleted_at IS NULL
          AND EXTRACT(YEAR FROM date::date) = ${year}
        GROUP BY month ORDER BY month
      `),
      sqlAll(sql`
        SELECT EXTRACT(MONTH FROM date::date) AS month, COALESCE(SUM(amount),0) AS total
        FROM expenses
        WHERE office_id = ${tenantId} AND deleted_at IS NULL
          AND EXTRACT(YEAR FROM date::date) = ${year}
        GROUP BY month ORDER BY month
      `),
      sqlOne(sql`
        SELECT COALESCE(SUM(total - amount_paid),0) AS total
        FROM client_invoices
        WHERE office_id = ${tenantId}
          AND status NOT IN ('paid','cancelled','draft')
          AND total > amount_paid
      `),
      sqlOne(sql`
        SELECT COALESCE(SUM(total),0) AS total FROM credit_notes
        WHERE office_id = ${tenantId}
      `),
    ]);

    const revenue        = num(revTotal.total);
    const expenses       = num(expTotal.total);
    const payroll        = num(payrollTotal.total);
    const totalExpenses  = +(expenses + payroll).toFixed(2);
    const netProfit      = +(revenue - totalExpenses).toFixed(2);
    const profitMargin   = revenue > 0 ? +((netProfit / revenue) * 100).toFixed(1) : 0;

    /* بناء بيانات الرسم البياني الشهري */
    const revMap = new Map((revByMonth as any[]).map((r: any) => [Number(r.month), num(r.total)]));
    const expMap = new Map((expByMonth as any[]).map((r: any) => [Number(r.month), num(r.total)]));
    const months = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const labels = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
      const rev = revMap.get(m) || 0;
      const exp = expMap.get(m) || 0;
      return { month: m, label: labels[i], revenue: rev, expenses: exp, profit: +(rev - exp).toFixed(2) };
    });

    res.json({
      year,
      kpi: {
        revenue,
        expenses: totalExpenses,
        netProfit,
        profitMargin,
        payroll,
        accountsReceivable: num(arTotal.total),
        creditNotesIssued: num(creditNotesTotal.total),
      },
      invoices: {
        paidCount:       Number(invoiceStats.paid_count  ?? 0),
        unpaidCount:     Number(invoiceStats.unpaid_count ?? 0),
        overdueCount:    Number(invoiceStats.overdue_count ?? 0),
        invoicedTotal:   num(invoiceStats.invoiced_total),
        collectedTotal:  num(invoiceStats.collected_total),
        outstandingTotal: num(invoiceStats.outstanding_total),
      },
      topExpenseCategories: topExpCats,
      monthlyChart: months,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════════════════
   7. مساعد الذكاء الاصطناعي المالي — قراءة فقط
══════════════════════════════════════════════════════════════════════ */

router.post("/accounting/ai-analysis", requireAuthWithTenant, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId as string;
  const { question, context } = req.body;
  if (!question) return apiErr(res, 400, "REQUIRED", "يرجى إدخال سؤالك");

  try {
    /* جمع البيانات المالية الحالية (قراءة فقط) */
    const [summary, arAging, topClients] = await Promise.all([
      sqlOne(sql`
        SELECT
          COALESCE(SUM(r.amount),0) AS total_revenue,
          COALESCE(SUM(e.amount),0) AS total_expenses,
          (SELECT COALESCE(SUM(total - amount_paid),0) FROM client_invoices
            WHERE office_id = ${tenantId} AND status NOT IN ('paid','cancelled','draft')) AS outstanding
        FROM revenues r, expenses e
        WHERE r.office_id = ${tenantId} AND r.deleted_at IS NULL
          AND e.office_id = ${tenantId} AND e.deleted_at IS NULL
          AND EXTRACT(MONTH FROM r.date::date) = EXTRACT(MONTH FROM NOW())
          AND EXTRACT(MONTH FROM e.date::date) = EXTRACT(MONTH FROM NOW())
      `),
      sqlOne(sql`
        SELECT
          COUNT(*) FILTER (WHERE CURRENT_DATE - due_date::date BETWEEN 1 AND 30) AS d30,
          COUNT(*) FILTER (WHERE CURRENT_DATE - due_date::date BETWEEN 31 AND 60) AS d60,
          COUNT(*) FILTER (WHERE CURRENT_DATE - due_date::date > 60) AS d60plus,
          COALESCE(SUM(total - amount_paid),0) FILTER (WHERE status = 'overdue') AS overdue_amount
        FROM client_invoices
        WHERE office_id = ${tenantId} AND status NOT IN ('paid','cancelled','draft')
      `),
      sqlAll(sql`
        SELECT COALESCE(cl.name, ci.client_name,'غير محدد') AS client_name,
               COALESCE(SUM(ci.total),0) AS total
        FROM client_invoices ci LEFT JOIN clients cl ON cl.id::text = ci.client_id
        WHERE ci.office_id = ${tenantId}
        GROUP BY client_name ORDER BY total DESC LIMIT 5
      `),
    ]);

    const systemPrompt = `أنت مساعد مالي قانوني متخصص لمكاتب المحاماة.
بياناتك المالية للشهر الحالي:
- إجمالي الإيرادات: ${num(summary.total_revenue)} ريال
- إجمالي المصاريف: ${num(summary.total_expenses)} ريال
- صافي الربح: ${num(summary.total_revenue) - num(summary.total_expenses)} ريال
- الذمم المدينة المعلقة: ${num(summary.outstanding)} ريال
- فواتير متأخرة 30 يوم: ${summary.d30} فاتورة
- فواتير متأخرة 31-60 يوم: ${summary.d60} فاتورة
- فواتير متأخرة أكثر من 60 يوم: ${summary.d60plus} فاتورة
- إجمالي المتأخرات: ${num(arAging.overdue_amount)} ريال
- أكبر 5 عملاء: ${(topClients as any[]).map((c: any) => `${c.client_name} (${num(c.total)} ر.س)`).join("، ")}

قواعد المساعد:
1. تحليل فقط — لا تُنفّذ أي عملية أو تعديل
2. أجب بالعربية الفصحى
3. كن محدداً وعملياً في توصياتك
4. لا تخترع أرقاماً غير موجودة في البيانات`;

    const answer = await callAI(tenantId, systemPrompt, question, "gemini");
    res.json({ answer, dataSnapshot: { revenue: num(summary.total_revenue), expenses: num(summary.total_expenses), outstanding: num(summary.outstanding) } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
