import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { validate } from "../../middlewares/validate";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db, clientInvoicesTable as invoicesTable, clientsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { getUncachableStripeClient } from "../../stripeClient";
import { eventBus } from "../../core/eventBus";
import { auditLog, auditMeta } from "../../lib/auditLogger";

const router = Router();

/* ─── DB migrations ─────────────────────────────────────────────────────────── */
async function ensureInvoiceTables() {
  /* tax_enabled: ضريبة القيمة المضافة اختيارية */
  await db.execute(sql`
    ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS tax_enabled BOOLEAN DEFAULT true
  `).catch(() => {});

  /* amount_paid: لتتبع الدفعات الجزئية */
  await db.execute(sql`
    ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0
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
    const invoices = await db.select().from(invoicesTable)
      .where(eq((invoicesTable as any).officeId, tenantId))
      .orderBy(desc(invoicesTable.createdAt));
    res.json(invoices);
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

    const { clientId, caseId, title, items, taxEnabled, vatRate, dueDate, notes, currency } = req.body;

    const taxOn  = taxEnabled !== false;
    const rate   = vatRate ?? 15;
    const { subtotal, taxAmount, total } = InvoiceEngine.build(items, taxOn, rate);
    const invoiceNumber = await nextInvoiceNumber(tenantId);

    const [invoice] = await db.insert(invoicesTable).values({
      invoiceNumber,
      clientId:   clientId ?? null,
      caseId:     caseId   ?? null,
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
    res.status(201).json(invoice);
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
      import("../financial/financial-event-engine").then(({ recordFinancialEvent }) =>
        recordFinancialEvent({
          officeId: tenantId, type: "INVOICE_PAID",
          amount: total, currency: "SAR",
          referenceId: String(req.params.id),
          description: `تحصيل فاتورة — ${method} — ${amount} ر.س`,
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

    import("../financial/financial-event-engine").then(({ recordFinancialEvent }) =>
      recordFinancialEvent({
        officeId: tenantId, type: "INVOICE_PAID",
        amount: total, currency: (updated as any).currency ?? "SAR",
        referenceId: String(req.params.id),
        description: `تحصيل فاتورة ${(updated as any).invoiceNumber ?? ""}`,
      })
    ).catch(() => {});

    auditLog({ action: "mark_paid", resource: "invoice", resourceId: String(req.params.id), officeId: tenantId }).catch(() => {});
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
