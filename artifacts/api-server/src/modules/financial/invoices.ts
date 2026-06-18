import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { validate } from "../../middlewares/validate";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db, clientInvoicesTable as invoicesTable, clientsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { getUncachableStripeClient } from "../../stripeClient";
import { eventBus } from "../../core/eventBus";
import { auditLog, auditMeta } from "../../lib/auditLogger";
import nodemailer from "nodemailer";

const router = Router();

/* ─── DB migrations ─────────────────────────────────────────────────────────── */
async function ensureInvoiceTables() {
  /* client_name: اسم العميل يدوياً (بديل عن client_id) */
  await db.execute(sql`
    ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS client_name TEXT
  `).catch(() => {});

  /* tax_enabled: ضريبة القيمة المضافة اختيارية */
  await db.execute(sql`
    ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS tax_enabled BOOLEAN DEFAULT true
  `).catch(() => {});

  /* amount_paid: لتتبع الدفعات الجزئية */
  await db.execute(sql`
    ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0
  `).catch(() => {});

  /* view_token: رابط عام للعميل بدون تسجيل دخول */
  await db.execute(sql`
    ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS view_token UUID DEFAULT gen_random_uuid()
  `).catch(() => {});
  /* ملء view_token للفواتير القديمة التي لا تملكه */
  await db.execute(sql`
    UPDATE client_invoices SET view_token = gen_random_uuid() WHERE view_token IS NULL
  `).catch(() => {});

  /* جدول الدفعات — يدعم الدفعات الجزئية وعزل المكاتب */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS invoice_payments (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id  UUID NOT NULL,
      office_id   TEXT NOT NULL,
      amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
      method      TEXT NOT NULL DEFAULT 'bank',
      notes       TEXT,
      recorded_by TEXT,
      paid_at     TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at  TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_inv_payments_invoice ON invoice_payments(invoice_id)
  `).catch(() => {});
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_inv_payments_office ON invoice_payments(office_id)
  `).catch(() => {});
}
ensureInvoiceTables();

/* ─── InvoiceEngine — محرك الحساب المالي الموحد ─────────────────────────────
 *  القاعدة الصارمة: القيم بالريال SAR — ممنوع /100 أو *100 داخلياً
 *  التحويل لـ Stripe (×100) يحدث في موضع واحد فقط عند إنشاء payment link
 * ─────────────────────────────────────────────────────────────────────────── */
const InvoiceEngine = {
  calcSubtotal(items: { quantity: number; unitPrice: number }[]): number {
    return +items.reduce((s, i) => s + i.quantity * i.unitPrice, 0).toFixed(2);
  },
  calcTax(subtotal: number, taxEnabled: boolean, taxRate: number): number {
    if (!taxEnabled || taxRate <= 0) return 0;
    return +(subtotal * (taxRate / 100)).toFixed(2);
  },
  calcTotal(subtotal: number, taxAmount: number): number {
    return +(subtotal + taxAmount).toFixed(2);
  },
  build(items: { quantity: number; unitPrice: number }[], taxEnabled: boolean, taxRate: number) {
    const subtotal  = this.calcSubtotal(items);
    const taxAmount = this.calcTax(subtotal, taxEnabled, taxRate);
    const total     = this.calcTotal(subtotal, taxAmount);
    return { subtotal, taxAmount, total };
  },
};

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function apiErr(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ success: false, error: { code, message } });
}

async function nextInvoiceNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*)::int AS n FROM client_invoices
      WHERE office_id = ${tenantId}
        AND invoice_number LIKE ${`INV-${year}-%`}
    `) as any;
    const rows = Array.isArray(result) ? result : (result?.rows ?? []);
    const n = ((rows[0]?.n ?? 0) + 1).toString().padStart(4, "0");
    return `INV-${year}-${n}`;
  } catch {
    return `INV-${year}-${Date.now().toString(36).toUpperCase()}`;
  }
}

async function sqlRows(q: any): Promise<any[]> {
  const r = await db.execute(q) as any;
  return Array.isArray(r) ? r : (r?.rows ?? []);
}

/* ════════════════════════════════════════════════════════════════════════════
   Zod Schemas
════════════════════════════════════════════════════════════════════════════ */
const InvoiceItemSchema = z.object({
  description: z.string().min(1, "وصف البند مطلوب"),
  quantity:    z.number().positive("الكمية يجب أن تكون أكبر من الصفر"),
  unitPrice:   z.number().min(0, "السعر يجب أن يكون صفراً أو أكثر"),
});

const CreateInvoiceSchema = z.object({
  clientId:   z.string().uuid().optional().nullable(),
  clientName: z.string().max(200).optional().nullable(),
  caseId:     z.string().uuid().optional().nullable(),
  title:      z.string().min(2, "عنوان الفاتورة مطلوب"),
  items:      z.array(InvoiceItemSchema).min(1, "يجب إضافة بند واحد على الأقل"),
  taxEnabled: z.boolean().optional().default(true),
  vatRate:    z.number().min(0).max(100).optional().default(15),
  dueDate:    z.string().optional().nullable(),
  notes:      z.string().max(2000).optional().nullable(),
  currency:   z.string().length(3).optional().default("SAR"),
});

const UpdateInvoiceSchema = z.object({
  title:      z.string().min(2).optional(),
  items:      z.array(InvoiceItemSchema).min(1).optional(),
  taxEnabled: z.boolean().optional(),
  vatRate:    z.number().min(0).max(100).optional(),
  dueDate:    z.string().optional().nullable(),
  notes:      z.string().max(2000).optional().nullable(),
  status:     z.enum(["draft","sent","paid","partially_paid","overdue","cancelled"]).optional(),
});

const RecordPaymentSchema = z.object({
  amount:  z.number().positive("المبلغ يجب أن يكون أكبر من الصفر"),
  method:  z.enum(["bank","cash","card","cheque","transfer","stripe","other"]).default("bank"),
  notes:   z.string().max(500).optional().nullable(),
  paid_at: z.string().optional().nullable(),
});

/* ════════════════════════════════════════════════════════════════════════════
   GET /invoices
════════════════════════════════════════════════════════════════════════════ */
router.get("/invoices", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) return apiErr(res, 403, "FORBIDDEN", "مكتب غير محدد");
    const rows = await sqlRows(sql`
      SELECT *, view_token::text AS view_token
      FROM client_invoices
      WHERE office_id = ${tenantId}
      ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ════════════════════════════════════════════════════════════════════════════
   GET /invoices/public/:token — عرض الفاتورة للعميل (بدون تسجيل دخول)
   ⚠️ يجب أن يكون قبل /:id لمنع Express من مطابقة "public" كـ id
════════════════════════════════════════════════════════════════════════════ */
router.get("/invoices/public/:token", async (req: Request, res: Response) => {
  try {
    const token = String(req.params.token ?? "").trim();
    if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
      return res.status(400).json({ error: "رابط غير صحيح" });
    }
    const rows = await sqlRows(sql`
      SELECT
        ci.id, ci.invoice_number, ci.title, ci.items, ci.subtotal,
        ci.vat_rate, ci.vat_amount, ci.total, ci.currency, ci.status,
        ci.due_date, ci.notes, ci.stripe_payment_link_url,
        ci.created_at, ci.paid_at, ci.tax_enabled, ci.client_name,
        ci.view_token::text AS view_token,
        op.name          AS office_name,
        op.phone         AS office_phone,
        op.email         AS office_email,
        op.logo          AS office_logo,
        op.address       AS office_address,
        op.website       AS office_website,
        op.primary_color AS office_color
      FROM  client_invoices ci
      LEFT JOIN office_page op ON op.id::text = ci.office_id
      WHERE ci.view_token = ${token}::uuid
      LIMIT 1
    `);
    if (!rows[0]) return res.status(404).json({ error: "الفاتورة غير موجودة" });

    /* إضافة اسم العميل من جدول العملاء إذا كان id موجوداً */
    const row = rows[0];
    if (!row.client_name && row.client_id) {
      const cRows = await sqlRows(sql`SELECT full_name FROM clients WHERE id = ${String(row.client_id)}::uuid LIMIT 1`);
      if (cRows[0]) row.client_name = cRows[0].full_name;
    }

    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ════════════════════════════════════════════════════════════════════════════
   GET /invoices/:id
════════════════════════════════════════════════════════════════════════════ */
router.get("/invoices/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) return apiErr(res, 403, "FORBIDDEN", "مكتب غير محدد");
    const [invoice] = await db.select().from(invoicesTable)
      .where(and(
        eq(invoicesTable.id, String(req.params.id)),
        eq((invoicesTable as any).officeId, tenantId),
      ));
    if (!invoice) return apiErr(res, 404, "NOT_FOUND", "الفاتورة غير موجودة");
    res.json(invoice);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ════════════════════════════════════════════════════════════════════════════
   POST /invoices — إنشاء فاتورة
════════════════════════════════════════════════════════════════════════════ */
router.post("/invoices", requireAuthWithTenant, validate(CreateInvoiceSchema), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) return apiErr(res, 403, "FORBIDDEN", "مكتب غير محدد");

    const { clientId, clientName, caseId, title, items, taxEnabled, vatRate, dueDate, notes, currency } = req.body;

    const taxOn  = taxEnabled !== false;
    const rate   = vatRate ?? 15;
    const { subtotal, taxAmount, total } = InvoiceEngine.build(items, taxOn, rate);
    const invoiceNumber = await nextInvoiceNumber(tenantId);

    const [invoice] = await db.insert(invoicesTable).values({
      invoiceNumber,
      clientId:   clientId   ?? null,
      clientName: clientName ?? null,
      caseId:     caseId     ?? null,
      title,
      items:      JSON.stringify(items),
      subtotal,
      vatRate:    taxOn ? rate : 0,
      vatAmount:  taxAmount,
      total,
      currency:   currency ?? "SAR",
      status:     "draft",
      dueDate:    dueDate ?? null,
      notes:      notes   ?? null,
      officeId:   tenantId,
      taxEnabled: taxOn,
      amountPaid: 0,
    } as any).returning();

    eventBus.emit({
      officeId: tenantId,
      type: "INVOICE_CREATED",
      data: { invoiceNumber, clientId, caseId, title, total, currency: currency ?? "SAR" },
    }).catch(() => {});

    import("../financial/financial-event-engine").then(({ recordFinancialEvent }) =>
      recordFinancialEvent({
        officeId: tenantId, type: "INVOICE_CREATED",
        amount: total, currency: currency ?? "SAR",
        referenceId: String(invoice.id),
        description: `فاتورة ${invoiceNumber} — ${title}`,
      })
    ).catch(() => {});

    auditLog({ ...auditMeta(req), action: "create", resource: "invoice", resourceId: String(invoice.id), details: `${invoiceNumber} — ${total} SAR` }).catch(() => {});

    /* أضف view_token للاستجابة */
    const vtRows = await sqlRows(sql`SELECT view_token::text AS view_token FROM client_invoices WHERE id = ${String(invoice.id)}::uuid LIMIT 1`);
    res.status(201).json({ ...invoice, viewToken: vtRows[0]?.view_token ?? null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ════════════════════════════════════════════════════════════════════════════
   PUT /invoices/:id — تعديل فاتورة
════════════════════════════════════════════════════════════════════════════ */
router.put("/invoices/:id", requireAuthWithTenant, validate(UpdateInvoiceSchema), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) return apiErr(res, 403, "FORBIDDEN", "مكتب غير محدد");
    const { title, items, taxEnabled, vatRate, dueDate, notes, status } = req.body;

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (title      !== undefined) updates.title      = title;
    if (status     !== undefined) updates.status     = status;
    if (dueDate    !== undefined) updates.dueDate    = dueDate;
    if (notes      !== undefined) updates.notes      = notes;
    if (taxEnabled !== undefined) updates.taxEnabled = taxEnabled;

    if (items) {
      const taxOn = taxEnabled !== undefined ? taxEnabled : true;
      const rate  = vatRate ?? 15;
      const { subtotal, taxAmount, total } = InvoiceEngine.build(items, taxOn, rate);
      updates.items     = JSON.stringify(items);
      updates.subtotal  = subtotal;
      updates.vatRate   = taxOn ? rate : 0;
      updates.vatAmount = taxAmount;
      updates.total     = total;
      updates.taxEnabled = taxOn;
    }

    const [updated] = await db.update(invoicesTable).set(updates)
      .where(and(
        eq(invoicesTable.id, String(req.params.id)),
        eq((invoicesTable as any).officeId, tenantId),
      ))
      .returning();

    if (!updated) return apiErr(res, 404, "NOT_FOUND", "الفاتورة غير موجودة");
    auditLog({ ...auditMeta(req), action: "update", resource: "invoice", resourceId: String(req.params.id) }).catch(() => {});
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ════════════════════════════════════════════════════════════════════════════
   DELETE /invoices/:id — الحذف محمي إذا وجدت دفعات
════════════════════════════════════════════════════════════════════════════ */
router.delete("/invoices/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) return apiErr(res, 403, "FORBIDDEN", "مكتب غير محدد");

    const payRows = await sqlRows(sql`
      SELECT COUNT(*)::int AS cnt FROM invoice_payments
      WHERE invoice_id = ${String(req.params.id)}::uuid AND office_id = ${tenantId}
    `);
    if ((payRows[0]?.cnt ?? 0) > 0) {
      return apiErr(res, 409, "HAS_PAYMENTS", "لا يمكن حذف فاتورة مرتبطة بدفعات مسجّلة");
    }

    await db.delete(invoicesTable)
      .where(and(
        eq(invoicesTable.id, String(req.params.id)),
        eq((invoicesTable as any).officeId, tenantId),
      ));

    auditLog({ ...auditMeta(req), action: "delete", resource: "invoice", resourceId: String(req.params.id) }).catch(() => {});
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ════════════════════════════════════════════════════════════════════════════
   GET /invoices/:id/payments — قائمة الدفعات
════════════════════════════════════════════════════════════════════════════ */
router.get("/invoices/:id/payments", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) return apiErr(res, 403, "FORBIDDEN", "مكتب غير محدد");

    const invRows = await sqlRows(sql`
      SELECT id, total, amount_paid, status FROM client_invoices
      WHERE id = ${String(req.params.id)}::uuid AND office_id = ${tenantId} LIMIT 1
    `);
    if (!invRows[0]) return apiErr(res, 404, "NOT_FOUND", "الفاتورة غير موجودة");
    const inv = invRows[0];

    const payments = await sqlRows(sql`
      SELECT * FROM invoice_payments
      WHERE invoice_id = ${String(req.params.id)}::uuid AND office_id = ${tenantId}
      ORDER BY paid_at DESC
    `);

    const total      = parseFloat(inv.total ?? 0);
    const amountPaid = parseFloat(inv.amount_paid ?? 0);
    res.json({
      payments,
      total,
      amountPaid,
      remaining: +(total - amountPaid).toFixed(2),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ════════════════════════════════════════════════════════════════════════════
   POST /invoices/:id/payments — تسجيل دفعة
════════════════════════════════════════════════════════════════════════════ */
router.post("/invoices/:id/payments", requireAuthWithTenant, validate(RecordPaymentSchema), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) return apiErr(res, 403, "FORBIDDEN", "مكتب غير محدد");

    const { amount, method, notes, paid_at } = req.body;

    const invRows = await sqlRows(sql`
      SELECT id, total, amount_paid, status FROM client_invoices
      WHERE id = ${String(req.params.id)}::uuid AND office_id = ${tenantId} LIMIT 1
    `);
    if (!invRows[0]) return apiErr(res, 404, "NOT_FOUND", "الفاتورة غير موجودة");
    const inv = invRows[0];
    if (inv.status === "cancelled") return apiErr(res, 409, "CANCELLED", "لا يمكن تسجيل دفعة على فاتورة ملغاة");

    const currentPaid = parseFloat(inv.amount_paid ?? 0);
    const total       = parseFloat(inv.total ?? 0);
    const newPaid     = +(currentPaid + amount).toFixed(2);

    if (newPaid > total + 0.01) {
      return apiErr(res, 400, "OVERPAYMENT",
        `المبلغ المدفوع (${newPaid} ر.س) يتجاوز إجمالي الفاتورة (${total} ر.س)`);
    }

    const userId = (req as any).auth?.userId ?? null;
    const payRows = await sqlRows(sql`
      INSERT INTO invoice_payments (invoice_id, office_id, amount, method, notes, recorded_by, paid_at)
      VALUES (
        ${String(req.params.id)}::uuid,
        ${tenantId},
        ${amount},
        ${method},
        ${notes ?? null},
        ${userId},
        ${paid_at ? new Date(paid_at) : new Date()}
      )
      RETURNING *
    `);
    const payment = payRows[0];

    const newStatus = newPaid >= total ? "paid" : "partially_paid";
    await db.execute(sql`
      UPDATE client_invoices
      SET amount_paid = ${newPaid},
          status      = ${newStatus},
          updated_at  = NOW()
          ${newStatus === "paid" ? sql`, paid_at = NOW()` : sql``}
      WHERE id = ${String(req.params.id)}::uuid AND office_id = ${tenantId}
    `);

    if (newStatus === "paid") {
      const invMeta = await sqlRows(sql`SELECT invoice_number, client_name FROM client_invoices WHERE id = ${String(req.params.id)}::uuid LIMIT 1`);
      const invoiceNumber = invMeta[0]?.invoice_number ?? "";
      const clientName    = invMeta[0]?.client_name    ?? "";

      eventBus.emit({
        officeId: tenantId,
        type: "INVOICE_PAID",
        data: { invoiceNumber, total, clientName, method, referenceId: String(req.params.id) },
      }).catch(() => {});

      import("../financial/financial-event-engine").then(({ recordFinancialEvent }) =>
        recordFinancialEvent({
          officeId: tenantId, type: "INVOICE_PAID",
          amount: total, currency: "SAR",
          referenceId: String(req.params.id),
          description: `تحصيل فاتورة ${invoiceNumber} — ${method} — ${amount} ر.س`,
          paymentMethod: method === "bank_transfer" ? "bank" : method === "cash" ? "cash" : undefined,
        })
      ).catch(() => {});
    }

    auditLog({ ...auditMeta(req), action: "record_payment", resource: "invoice", resourceId: String(req.params.id), details: `${amount} SAR — ${method}` }).catch(() => {});
    res.status(201).json({
      payment,
      amountPaid: newPaid,
      status:     newStatus,
      remaining:  +(total - newPaid).toFixed(2),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ════════════════════════════════════════════════════════════════════════════
   DELETE /invoices/:id/payments/:pid — حذف دفعة
════════════════════════════════════════════════════════════════════════════ */
router.delete("/invoices/:id/payments/:pid", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) return apiErr(res, 403, "FORBIDDEN", "مكتب غير محدد");

    const payRows = await sqlRows(sql`
      SELECT amount FROM invoice_payments
      WHERE id = ${String(req.params.pid)}::uuid
        AND invoice_id = ${String(req.params.id)}::uuid
        AND office_id = ${tenantId}
      LIMIT 1
    `);
    if (!payRows[0]) return apiErr(res, 404, "NOT_FOUND", "الدفعة غير موجودة");

    await db.execute(sql`
      DELETE FROM invoice_payments
      WHERE id = ${String(req.params.pid)}::uuid AND office_id = ${tenantId}
    `);

    const sumRows = await sqlRows(sql`
      SELECT COALESCE(SUM(amount), 0)::numeric AS total_paid
      FROM invoice_payments
      WHERE invoice_id = ${String(req.params.id)}::uuid AND office_id = ${tenantId}
    `);
    const totalPaid = parseFloat(sumRows[0]?.total_paid ?? 0);

    const invRows = await sqlRows(sql`
      SELECT total FROM client_invoices
      WHERE id = ${String(req.params.id)}::uuid AND office_id = ${tenantId} LIMIT 1
    `);
    const invTotal  = parseFloat(invRows[0]?.total ?? 0);
    const newStatus = totalPaid <= 0 ? "sent" : totalPaid >= invTotal ? "paid" : "partially_paid";

    await db.execute(sql`
      UPDATE client_invoices
      SET amount_paid = ${totalPaid}, status = ${newStatus}, updated_at = NOW()
      WHERE id = ${String(req.params.id)}::uuid AND office_id = ${tenantId}
    `);

    auditLog({ ...auditMeta(req), action: "delete_payment", resource: "invoice", resourceId: String(req.params.id), details: `${payRows[0].amount} SAR removed` }).catch(() => {});
    res.json({ success: true, amountPaid: totalPaid, status: newStatus });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ════════════════════════════════════════════════════════════════════════════
   POST /invoices/:id/payment-link — Stripe Payment Link
   المبلغ يُضرب ×100 هنا فقط (تحويل SAR → هللة لـ Stripe)
════════════════════════════════════════════════════════════════════════════ */
router.post("/invoices/:id/payment-link", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const [invoice] = await db.select().from(invoicesTable)
      .where(and(
        eq(invoicesTable.id, String(req.params.id)),
        eq((invoicesTable as any).officeId, tenantId),
      ));
    if (!invoice) return apiErr(res, 404, "NOT_FOUND", "الفاتورة غير موجودة");

    if (invoice.stripePaymentLinkUrl) {
      res.json({ url: invoice.stripePaymentLinkUrl, existing: true }); return;
    }

    const total      = parseFloat(String((invoice as any).total ?? 0));
    const amountPaid = parseFloat(String((invoice as any).amountPaid ?? 0));
    const remaining  = +(total - amountPaid).toFixed(2);

    /* ×100: SAR → هللة — الموضع الوحيد المسموح به */
    const unitAmount = Math.round(remaining * 100);
    const STRIPE_MAX = 99_999_999;
    if (unitAmount > STRIPE_MAX) {
      return apiErr(res, 400, "STRIPE_LIMIT_EXCEEDED", `المبلغ (${remaining} ر.س) يتجاوز الحد الأقصى لـ Stripe (999,999.99 ر.س).`);
    }
    if (unitAmount <= 0) {
      return apiErr(res, 400, "INVALID_AMOUNT", "مبلغ الفاتورة يجب أن يكون أكبر من الصفر");
    }

    const stripe = await getUncachableStripeClient();
    const host   = req.get("host") ?? "";

    let clientEmail: string | undefined;
    if (invoice.clientId) {
      const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, invoice.clientId));
      clientEmail = client?.email ?? undefined;
    }

    const product = await stripe.products.create({
      name: `فاتورة: ${invoice.title}`,
      description: `${invoice.invoiceNumber} — ${invoice.title}`,
      metadata: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber },
    });

    const currency = (invoice.currency ?? "SAR").toLowerCase();
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: unitAmount,
      currency,
    });

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      payment_method_types: ["card"],
      after_completion: {
        type: "redirect",
        redirect: { url: `${req.protocol}://${host}/invoices?paid=${invoice.id}` },
      },
      metadata: { invoiceId: invoice.id },
      ...(clientEmail ? { customer_creation: "always" } : {}),
    });

    await db.update(invoicesTable).set({
      stripePaymentLinkId:  paymentLink.id,
      stripePaymentLinkUrl: paymentLink.url,
      stripeProductId: product.id,
      stripePriceId:   price.id,
      status: "sent",
      updatedAt: new Date(),
    }).where(and(
      eq(invoicesTable.id, invoice.id),
      eq((invoicesTable as any).officeId, tenantId),
    ));

    res.json({ url: paymentLink.url, id: paymentLink.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ════════════════════════════════════════════════════════════════════════════
   POST /invoices/:id/mark-paid — تسجيل دفعة كاملة سريعة
════════════════════════════════════════════════════════════════════════════ */
router.post("/invoices/:id/mark-paid", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) return apiErr(res, 403, "FORBIDDEN", "مكتب غير محدد");

    const invRows = await sqlRows(sql`
      SELECT id, total, amount_paid FROM client_invoices
      WHERE id = ${String(req.params.id)}::uuid AND office_id = ${tenantId} LIMIT 1
    `);
    if (!invRows[0]) return apiErr(res, 404, "NOT_FOUND", "الفاتورة غير موجودة");
    const inv = invRows[0];

    const total       = parseFloat(inv.total ?? 0);
    const currentPaid = parseFloat(inv.amount_paid ?? 0);
    const remaining   = +(total - currentPaid).toFixed(2);

    if (remaining > 0) {
      const userId = (req as any).auth?.userId ?? null;
      await db.execute(sql`
        INSERT INTO invoice_payments (invoice_id, office_id, amount, method, notes, recorded_by)
        VALUES (${String(req.params.id)}::uuid, ${tenantId}, ${remaining}, 'other', 'تسجيل يدوي كامل', ${userId})
      `);
    }

    const [updated] = await db.update(invoicesTable)
      .set({ status: "paid", paidAt: new Date(), amountPaid: total, updatedAt: new Date() } as any)
      .where(and(
        eq(invoicesTable.id, String(req.params.id)),
        eq((invoicesTable as any).officeId, tenantId),
      ))
      .returning();
    if (!updated) return apiErr(res, 404, "NOT_FOUND", "الفاتورة غير موجودة");

    const invoiceNumber = (updated as any).invoiceNumber ?? (updated as any).invoice_number ?? "";
    const clientName    = (updated as any).clientName   ?? (updated as any).client_name   ?? "";

    eventBus.emit({
      officeId: tenantId,
      type: "INVOICE_PAID",
      data: { invoiceNumber, total, clientName, method: "other", referenceId: String(req.params.id) },
    }).catch(() => {});

    import("../financial/financial-event-engine").then(({ recordFinancialEvent }) =>
      recordFinancialEvent({
        officeId: tenantId, type: "INVOICE_PAID",
        amount: total, currency: (updated as any).currency ?? "SAR",
        referenceId: String(req.params.id),
        description: `تحصيل فاتورة ${invoiceNumber} — تسجيل يدوي كامل`,
      })
    ).catch(() => {});

    auditLog({ action: "mark_paid", resource: "invoice", resourceId: String(req.params.id), officeId: tenantId }).catch(() => {});
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ════════════════════════════════════════════════════════════════════════════
   POST /invoices/:id/send-email — إرسال الفاتورة بالبريد الإلكتروني
════════════════════════════════════════════════════════════════════════════ */
router.post("/invoices/:id/send-email", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) return apiErr(res, 403, "FORBIDDEN", "مكتب غير محدد");

    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return apiErr(res, 400, "INVALID_EMAIL", "البريد الإلكتروني غير صحيح");
    }

    /* جلب الفاتورة */
    const invRows = await sqlRows(sql`
      SELECT *, view_token::text AS view_token FROM client_invoices
      WHERE id = ${String(req.params.id)}::uuid AND office_id = ${tenantId} LIMIT 1
    `);
    if (!invRows[0]) return apiErr(res, 404, "NOT_FOUND", "الفاتورة غير موجودة");
    const inv = invRows[0];

    /* جلب معلومات المكتب */
    const officeRows = await sqlRows(sql`SELECT * FROM office_page WHERE id::text = ${tenantId} LIMIT 1`);
    const office = officeRows[0] ?? { name: "مكتب المحاماة" };

    /* رابط الفاتورة */
    const origin = req.get("origin") ?? `https://${req.get("host")}`;
    const viewLink = `${origin}/invoice/${inv.view_token}`;

    /* إعدادات SMTP (تجربة المكتب أولاً ثم default) */
    const smtpRows = await sqlRows(sql`
      SELECT * FROM email_notification_settings
      WHERE office_id = ${tenantId} OR office_id = 'default'
      ORDER BY (office_id = ${tenantId}) DESC LIMIT 1
    `);
    const smtp = smtpRows[0];
    if (!smtp?.smtp_host || !smtp?.smtp_user || !smtp?.smtp_pass) {
      return apiErr(res, 400, "NO_SMTP", "لم يتم إعداد بريد SMTP — يرجى إعداده من إعدادات الإشعارات");
    }

    const transporter = nodemailer.createTransport({
      host: smtp.smtp_host,
      port: parseInt(String(smtp.smtp_port ?? 587)),
      secure: parseInt(String(smtp.smtp_port ?? 587)) === 465,
      auth: { user: smtp.smtp_user, pass: smtp.smtp_pass },
    });

    const totalFmt = Number(inv.total).toLocaleString("ar-SA", { minimumFractionDigits: 2 });
    const currency = inv.currency ?? "SAR";
    const officeName = office.name ?? "مكتب المحاماة";
    const accentColor = office.primary_color ?? "#1A56DB";

    await transporter.sendMail({
      from: `"${officeName}" <${smtp.from_email ?? smtp.smtp_user}>`,
      to: email,
      subject: `فاتورة رقم ${inv.invoice_number} — ${inv.title}`,
      html: `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; background:#f8fafc; margin:0; padding:20px; direction:rtl; }
  .card { max-width:560px; margin:0 auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,.08); }
  .header { background:${accentColor}; padding:28px 32px; color:#fff; }
  .header h1 { margin:0; font-size:22px; }
  .header p  { margin:4px 0 0; opacity:.85; font-size:13px; }
  .body { padding:28px 32px; }
  .row { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f1f5f9; font-size:14px; color:#374151; }
  .row:last-child { border:none; }
  .total { font-size:18px; font-weight:700; color:${accentColor}; }
  .btn { display:block; width:100%; text-align:center; background:${accentColor}; color:#fff; padding:14px; border-radius:10px; text-decoration:none; font-weight:600; font-size:15px; margin-top:20px; }
  .footer { padding:16px 32px; background:#f8fafc; text-align:center; font-size:11px; color:#94a3b8; }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <h1>${officeName}</h1>
    <p>فاتورة رقم ${inv.invoice_number}</p>
  </div>
  <div class="body">
    <div class="row"><span>الموضوع</span><span><b>${inv.title}</b></span></div>
    <div class="row"><span>تاريخ الإصدار</span><span>${new Date(inv.created_at).toLocaleDateString("ar-SA")}</span></div>
    ${inv.due_date ? `<div class="row"><span>تاريخ الاستحقاق</span><span>${new Date(inv.due_date).toLocaleDateString("ar-SA")}</span></div>` : ""}
    <div class="row"><span>الإجمالي المستحق</span><span class="total">${totalFmt} ${currency}</span></div>
    ${inv.notes ? `<div style="margin-top:12px;padding:12px;background:#fef9ec;border-radius:8px;font-size:13px;color:#92400e;">${inv.notes}</div>` : ""}
    <a href="${viewLink}" class="btn">عرض الفاتورة كاملة ←</a>
    ${inv.stripe_payment_link_url ? `<a href="${inv.stripe_payment_link_url}" class="btn" style="background:#10b981;margin-top:8px;">💳 ادفع الآن</a>` : ""}
  </div>
  <div class="footer">مدعوم بـ عدالة AI &nbsp;·&nbsp; ${office.phone ?? ""} ${office.email ? `&nbsp;·&nbsp; ${office.email}` : ""}</div>
</div>
</body></html>`,
    });

    auditLog({ action: "send_email", resource: "invoice", resourceId: String(req.params.id), officeId: tenantId, details: `إلى: ${email}` }).catch(() => {});
    res.json({ success: true, message: `تم إرسال الفاتورة إلى ${email}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
