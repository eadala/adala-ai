import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { validate } from "../../middlewares/validate";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db, clientInvoicesTable as invoicesTable, clientsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { getUncachableStripeClient } from "../../stripeClient";
import { eventBus } from "../../core/eventBus";
import { auditLog, auditMeta } from "../../lib/auditLogger";

const router = Router();

// ── Zod schemas ───────────────────────────────────────────────────────────────
const InvoiceItemSchema = z.object({
  description: z.string().min(1, "وصف البند مطلوب"),
  quantity:    z.number().positive("الكمية يجب أن تكون أكبر من الصفر"),
  unitPrice:   z.number().min(0, "السعر يجب أن يكون صفراً أو أكثر"),
});

const CreateInvoiceSchema = z.object({
  clientId: z.string().uuid("معرف الموكل غير صحيح").optional().nullable(),
  caseId:   z.string().uuid("معرف القضية غير صحيح").optional().nullable(),
  title:    z.string().min(2, "عنوان الفاتورة مطلوب"),
  items:    z.array(InvoiceItemSchema).min(1, "يجب إضافة بند واحد على الأقل"),
  vatRate:  z.number().min(0).max(100).optional().default(15),
  dueDate:  z.string().optional().nullable(),
  notes:    z.string().max(2000).optional().nullable(),
  currency: z.string().length(3).optional().default("SAR"),
});

const UpdateInvoiceSchema = z.object({
  title:   z.string().min(2).optional(),
  items:   z.array(InvoiceItemSchema).min(1).optional(),
  vatRate: z.number().min(0).max(100).optional(),
  dueDate: z.string().optional().nullable(),
  notes:   z.string().max(2000).optional().nullable(),
  status:  z.enum(["draft","sent","paid","overdue","cancelled"]).optional(),
});

// ── Unified error helper ──────────────────────────────────────────────────────
function apiErr(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ success: false, error: { code, message } });
}

// ─── Helper: generate invoice number ───
async function nextInvoiceNumber(): Promise<string> {
  const count = await db.select().from(invoicesTable);
  const n = (count.length + 1).toString().padStart(4, "0");
  const year = new Date().getFullYear();
  return `INV-${year}-${n}`;
}

// ─── GET /invoices ───
router.get("/invoices", requireAuthWithTenant, async (_req: Request, res: Response) => {
  try {
    const tenantId = (_req as any).tenantId;
    if (!tenantId) return apiErr(res, 403, "FORBIDDEN", "مكتب غير محدد");
    const invoices = await db.select().from(invoicesTable)
      .where(eq((invoicesTable as any).officeId, tenantId))
      .orderBy(desc(invoicesTable.createdAt));
    res.json(invoices);
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});

// ─── GET /invoices/:id ───
router.get("/invoices/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) return apiErr(res, 403, "FORBIDDEN", "مكتب غير محدد");
    const [invoice] = await db.select().from(invoicesTable)
      .where(and(eq(invoicesTable.id, String(req.params.id)), eq((invoicesTable as any).officeId, tenantId)));
    if (!invoice) return apiErr(res, 404, "NOT_FOUND", "الفاتورة غير موجودة");
    res.json(invoice);
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});

// ─── POST /invoices ─── Create invoice
router.post("/invoices", requireAuthWithTenant, validate(CreateInvoiceSchema), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) return apiErr(res, 403, "FORBIDDEN", "مكتب غير محدد");
    const { clientId, caseId, title, items, vatRate, dueDate, notes, currency } = req.body;

    const subtotal = (items as any[]).reduce((s: number, i: any) => s + i.quantity * i.unitPrice, 0);
    const vat      = vatRate ?? 15;
    const vatAmt   = Math.round(subtotal * vat / 100);
    const total    = subtotal + vatAmt;
    const invoiceNumber = await nextInvoiceNumber();

    const [invoice] = await db.insert(invoicesTable).values({
      invoiceNumber, clientId, caseId, title,
      items: JSON.stringify(items),
      subtotal, vatRate: vat, vatAmount: vatAmt, total,
      currency: currency ?? "SAR",
      status: "draft", dueDate, notes,
      officeId: tenantId,
    } as any).returning();

    eventBus.emit({
      type: "INVOICE_CREATED",
      data: { invoiceNumber, clientId, caseId, title, total, currency: currency ?? "SAR" },
    }).catch(() => {});

    auditLog({ ...auditMeta(req), action: "create", resource: "invoice", resourceId: String(invoice.id), details: `رقم: ${invoiceNumber} — المبلغ: ${total}` }).catch(() => {});
    res.status(201).json(invoice);
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});

// ─── PUT /invoices/:id ─── Update invoice
router.put("/invoices/:id", requireAuthWithTenant, validate(UpdateInvoiceSchema), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) return apiErr(res, 403, "FORBIDDEN", "مكتب غير محدد");
    const { title, items, vatRate, dueDate, notes, status } = req.body;

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (title   !== undefined) updates.title   = title;
    if (status  !== undefined) updates.status  = status;
    if (dueDate !== undefined) updates.dueDate = dueDate;
    if (notes   !== undefined) updates.notes   = notes;

    if (items) {
      const subtotal = (items as any[]).reduce((s: number, i: any) => s + i.quantity * i.unitPrice, 0);
      const vat      = vatRate ?? 15;
      const vatAmt   = Math.round(subtotal * vat / 100);
      updates.items     = JSON.stringify(items);
      updates.subtotal  = subtotal;
      updates.vatRate   = vat;
      updates.vatAmount = vatAmt;
      updates.total     = subtotal + vatAmt;
    }

    const [updated] = await db.update(invoicesTable).set(updates)
      .where(and(eq(invoicesTable.id, String(req.params.id)), eq((invoicesTable as any).officeId, tenantId)))
      .returning();

    if (!updated) return apiErr(res, 404, "NOT_FOUND", "الفاتورة غير موجودة");
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});

// ─── DELETE /invoices/:id ───
router.delete("/invoices/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) return apiErr(res, 403, "FORBIDDEN", "مكتب غير محدد");
    await db.delete(invoicesTable)
      .where(and(eq(invoicesTable.id, String(req.params.id)), eq((invoicesTable as any).officeId, tenantId)));
    auditLog({ ...auditMeta(req), action: "delete", resource: "invoice", resourceId: String(req.params.id) }).catch(() => {});
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});

// ─── POST /invoices/:id/payment-link ─── Create Stripe Payment Link
router.post("/invoices/:id/payment-link", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const [invoice] = await db.select().from(invoicesTable)
      .where(and(eq(invoicesTable.id, String(req.params.id)), eq((invoicesTable as any).officeId, tenantId)));
    if (!invoice) return apiErr(res, 404, "NOT_FOUND", "الفاتورة غير موجودة");

    if (invoice.stripePaymentLinkUrl) {
      res.json({ url: invoice.stripePaymentLinkUrl, existing: true }); return;
    }

    const unitAmount = Math.round(invoice.total * 100);
    const STRIPE_MAX = 99_999_999;
    if (unitAmount > STRIPE_MAX) {
      const sarDisplay = invoice.total.toLocaleString("ar-SA", { maximumFractionDigits: 2 });
      return apiErr(res, 400, "STRIPE_LIMIT_EXCEEDED", `المبلغ (${sarDisplay} ر.س) يتجاوز الحد الأقصى لـ Stripe (999,999.99 ر.س).`);
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
    }).where(and(eq(invoicesTable.id, invoice.id), eq((invoicesTable as any).officeId, tenantId)));

    res.json({ url: paymentLink.url, id: paymentLink.id });
  } catch (err: any) {
        res.status(500).json({ error: err.message });
  }
});

// ─── POST /invoices/:id/mark-paid ───
router.post("/invoices/:id/mark-paid", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) return apiErr(res, 403, "FORBIDDEN", "مكتب غير محدد");
    const [updated] = await db.update(invoicesTable)
      .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
      .where(and(eq(invoicesTable.id, String(req.params.id)), eq((invoicesTable as any).officeId, tenantId)))
      .returning();
    if (!updated) return apiErr(res, 404, "NOT_FOUND", "الفاتورة غير موجودة");
    auditLog({ action: "mark_paid", resource: "invoice", resourceId: String(req.params.id), officeId: tenantId }).catch(() => {});
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});

export default router;
