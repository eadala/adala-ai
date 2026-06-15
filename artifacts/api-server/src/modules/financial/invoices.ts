import { requireAuth, requireAuthWithTenant } from "../../middlewares/requireAuth";
import { Router, type Request, type Response } from "express";
import { db, clientInvoicesTable as invoicesTable, clientsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { getUncachableStripeClient } from "../../stripeClient";
import { eventBus } from "../../core/eventBus";
import { auditLog, auditMeta } from "../../lib/auditLogger";

const router = Router();

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
    const invoices = await db.select().from(invoicesTable)
      .where(eq((invoicesTable as any).officeId, tenantId))
      .orderBy(desc(invoicesTable.createdAt));
    res.json(invoices);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /invoices/:id ───
router.get("/invoices/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const [invoice] = await db.select().from(invoicesTable)
      .where(and(eq(invoicesTable.id, String(req.params.id)), eq((invoicesTable as any).officeId, tenantId)));
    if (!invoice) { res.status(404).json({ error: "الفاتورة غير موجودة" }); return; }
    res.json(invoice);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /invoices ─── Create invoice
router.post("/invoices", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { clientId, caseId, title, items, vatRate, dueDate, notes, currency } = req.body as {
      clientId?: string; caseId?: string; title: string;
      items: Array<{ description: string; quantity: number; unitPrice: number }>;
      vatRate?: number; dueDate?: string; notes?: string; currency?: string;
    };

    if (!title || !items?.length) {
      res.status(400).json({ error: "العنوان وعناصر الفاتورة مطلوبة" }); return;
    }

    const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
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
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /invoices/:id ─── Update invoice
router.put("/invoices/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { title, items, vatRate, dueDate, notes, status } = req.body as {
      title?: string;
      items?: Array<{ description: string; quantity: number; unitPrice: number }>;
      vatRate?: number; dueDate?: string; notes?: string; status?: string;
    };

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (title)   updates.title   = title;
    if (status)  updates.status  = status;
    if (dueDate) updates.dueDate = dueDate;
    if (notes !== undefined) updates.notes = notes;

    if (items) {
      const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
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

    if (!updated) { res.status(404).json({ error: "الفاتورة غير موجودة" }); return; }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /invoices/:id ───
router.delete("/invoices/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    await db.delete(invoicesTable)
      .where(and(eq(invoicesTable.id, String(req.params.id)), eq((invoicesTable as any).officeId, tenantId)));
    auditLog({ ...auditMeta(req), action: "delete", resource: "invoice", resourceId: String(req.params.id) }).catch(() => {});
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /invoices/:id/payment-link ─── Create Stripe Payment Link
router.post("/invoices/:id/payment-link", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const [invoice] = await db.select().from(invoicesTable)
      .where(and(eq(invoicesTable.id, String(req.params.id)), eq((invoicesTable as any).officeId, tenantId)));
    if (!invoice) { res.status(404).json({ error: "الفاتورة غير موجودة" }); return; }

    if (invoice.stripePaymentLinkUrl) {
      res.json({ url: invoice.stripePaymentLinkUrl, existing: true }); return;
    }

    const unitAmount = Math.round(invoice.total * 100);
    const STRIPE_MAX = 99_999_999;
    if (unitAmount > STRIPE_MAX) {
      const sarDisplay = invoice.total.toLocaleString("ar-SA", { maximumFractionDigits: 2 });
      res.status(400).json({
        error: `المبلغ (${sarDisplay} ر.س) يتجاوز الحد الأقصى لـ Stripe (999,999.99 ر.س). يُرجى تقسيم الفاتورة أو تحصيل المبلغ خارج المنصة.`,
        hint: "stripe_max_exceeded",
      }); return;
    }
    if (unitAmount <= 0) {
      res.status(400).json({ error: "مبلغ الفاتورة يجب أن يكون أكبر من الصفر" }); return;
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
    const [updated] = await db.update(invoicesTable)
      .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
      .where(and(eq(invoicesTable.id, String(req.params.id)), eq((invoicesTable as any).officeId, tenantId)))
      .returning();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
