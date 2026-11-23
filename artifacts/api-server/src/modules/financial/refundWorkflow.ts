/**
 * Refund + credit-note workflow via fake transport (ADALA-031).
 * Local state never implies provider success.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { createHash, randomUUID } from "crypto";
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import {
  getFakePaymentTransport,
  liveRefundsForbidden,
} from "./fakePaymentTransport";

const router = Router();

function rows(r: any): any[] {
  return Array.isArray(r) ? r : (r?.rows ?? []);
}
function one(r: any): any {
  return rows(r)[0] ?? null;
}
function num(v: any): number {
  return parseFloat(String(v ?? "0")) || 0;
}

const AUTH_ROLES = new Set(["firm_owner", "office_owner", "office_manager", "accountant"]);

async function refundableBalance(officeId: string, paymentId: string): Promise<{ payment: any; refunded: number; balance: number } | null> {
  const payment = one(await db.execute(sql`
    SELECT * FROM payment_transactions
    WHERE id::text = ${paymentId} AND office_id = ${officeId}
    LIMIT 1
  `));
  if (!payment) return null;
  const sumRow = one(await db.execute(sql`
    SELECT COALESCE(SUM(amount),0)::numeric AS refunded
    FROM refund_requests
    WHERE office_id = ${officeId}
      AND payment_id = ${paymentId}
      AND status IN ('authorized','submitted','succeeded')
  `));
  const refunded = num(sumRow?.refunded);
  const balance = Math.max(0, num(payment.amount) - refunded);
  return { payment, refunded, balance };
}

router.post("/refunds/request", requireAuthWithTenant, async (req: Request, res: Response) => {
  const officeId = String((req as any).tenantId ?? "");
  const userId = String((req as any).userId ?? "");
  try {
    const paymentId = String(req.body?.paymentId ?? "");
    const amount = num(req.body?.amount);
    const reason = String(req.body?.reason ?? "client_refund");
    if (!paymentId || amount <= 0) return res.status(400).json({ error: "paymentId and positive amount required" });

    const bal = await refundableBalance(officeId, paymentId);
    if (!bal) return res.status(404).json({ error: "payment not found" });
    if (amount > bal.balance + 1e-9) {
      return res.status(400).json({ error: "refund exceeds refundable balance", refundable: bal.balance });
    }

    const duplicateKey = createHash("sha256")
      .update(`${officeId}|${paymentId}|${amount.toFixed(2)}|${reason}`)
      .digest("hex")
      .slice(0, 40);

    const existing = one(await db.execute(sql`
      SELECT id, status FROM refund_requests
      WHERE office_id = ${officeId} AND duplicate_key = ${duplicateKey}
      LIMIT 1
    `));
    if (existing) {
      return res.status(409).json({ error: "duplicate refund request", id: existing.id, status: existing.status });
    }

    const id = randomUUID();
    const row = one(await db.execute(sql`
      INSERT INTO refund_requests (
        id, office_id, payment_id, invoice_id, amount, currency, status,
        reason, requested_by, duplicate_key
      ) VALUES (
        ${id}, ${officeId}, ${paymentId}, ${bal.payment.invoice_id ?? null},
        ${amount}, ${bal.payment.currency ?? "SAR"}, 'pending',
        ${reason}, ${userId}, ${duplicateKey}
      ) RETURNING *
    `));
    res.status(201).json(row);
  } catch (e: any) {
    if (String(e.message || "").includes("uq_refund_requests_duplicate_key")) {
      return res.status(409).json({ error: "duplicate refund request" });
    }
    res.status(500).json({ error: e.message });
  }
});

router.post("/refunds/:id/authorize", requireAuthWithTenant, async (req: Request, res: Response) => {
  const officeId = String((req as any).tenantId ?? "");
  const userId = String((req as any).userId ?? "");
  try {
    const roleRow = one(await db.execute(sql`
      SELECT role FROM office_members
      WHERE user_id = ${userId} AND office_id = ${officeId} AND status = 'active' LIMIT 1
    `));
    if (!AUTH_ROLES.has(String(roleRow?.role ?? ""))) {
      return res.status(403).json({ error: "refund authorization role required" });
    }
    const id = String(req.params.id);
    const upd = one(await db.execute(sql`
      UPDATE refund_requests
      SET status = 'authorized', authorized_by = ${userId}, updated_at = NOW()
      WHERE id = ${id} AND office_id = ${officeId} AND status = 'pending'
      RETURNING *
    `));
    if (!upd) return res.status(404).json({ error: "not found or not pending" });
    res.json(upd);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/refunds/:id/execute", requireAuthWithTenant, async (req: Request, res: Response) => {
  const officeId = String((req as any).tenantId ?? "");
  const userId = String((req as any).userId ?? "");
  try {
    if (!liveRefundsForbidden() && process.env.ADALA_ALLOW_LIVE_REFUNDS !== "1") {
      return res.status(403).json({
        error: "LIVE_REFUND_FORBIDDEN",
        note: "Live provider refunds are not authorized in this environment",
      });
    }
    if (process.env.ADALA_FAKE_PAYMENTS !== "1") {
      return res.status(403).json({
        error: "LIVE_REFUND_FORBIDDEN",
        note: "Set ADALA_FAKE_PAYMENTS=1 to use fake transport only",
      });
    }

    const id = String(req.params.id);
    const reqRow = one(await db.execute(sql`
      SELECT * FROM refund_requests
      WHERE id = ${id} AND office_id = ${officeId} AND status = 'authorized'
      LIMIT 1
    `));
    if (!reqRow) return res.status(404).json({ error: "authorized refund not found" });

    const bal = await refundableBalance(officeId, String(reqRow.payment_id));
    if (!bal || num(reqRow.amount) > bal.balance + num(reqRow.amount) + 1e-9) {
      /* re-check excluding this authorized row's own amount */
    }
    const sumOthers = one(await db.execute(sql`
      SELECT COALESCE(SUM(amount),0)::numeric AS refunded
      FROM refund_requests
      WHERE office_id = ${officeId}
        AND payment_id = ${String(reqRow.payment_id)}
        AND id <> ${id}
        AND status IN ('authorized','submitted','succeeded')
    `));
    const remaining = num(bal?.payment?.amount) - num(sumOthers?.refunded);
    if (num(reqRow.amount) > remaining + 1e-9) {
      return res.status(400).json({ error: "refund exceeds refundable balance", refundable: remaining });
    }

    await db.execute(sql`
      UPDATE refund_requests SET status = 'submitted', updated_at = NOW()
      WHERE id = ${id} AND office_id = ${officeId}
    `);

    const transport = getFakePaymentTransport();
    const result = await transport.refund(String(reqRow.payment_id), num(reqRow.amount));

    if (!result.ok) {
      await db.execute(sql`
        UPDATE refund_requests
        SET status = 'failed', provider_status = ${result.providerStatus}, updated_at = NOW()
        WHERE id = ${id} AND office_id = ${officeId}
      `);
      return res.status(502).json({
        error: "provider_refund_failed",
        providerStatus: result.providerStatus,
        note: `${result.note}; local success not inferred`,
      });
    }

    let creditNoteId: string | null = null;
    if (reqRow.invoice_id) {
      const year = new Date().getFullYear();
      const count = one(await db.execute(sql`
        SELECT COUNT(*)::int AS cnt FROM credit_notes WHERE office_id = ${officeId}
      `));
      const seq = String((count?.cnt ?? 0) + 1).padStart(4, "0");
      const creditNumber = `CN-${year}-RF-${seq}`;
      const cn = one(await db.execute(sql`
        INSERT INTO credit_notes (
          office_id, original_invoice_id, credit_number,
          amount, tax_amount, total, reason, issued_by, status
        ) VALUES (
          ${officeId}, ${String(reqRow.invoice_id)}, ${creditNumber},
          ${num(reqRow.amount)}, 0, ${num(reqRow.amount)},
          ${`refund ${id}`}, ${userId}, 'issued'
        ) RETURNING id
      `));
      creditNoteId = cn?.id ?? null;
      if (creditNoteId) {
        await db.execute(sql`
          UPDATE client_invoices
          SET linked_credit_note_id = ${creditNoteId}
          WHERE id::text = ${String(reqRow.invoice_id)} AND office_id = ${officeId}
        `).catch(() => {});
      }
    }

    const done = one(await db.execute(sql`
      UPDATE refund_requests
      SET status = 'succeeded',
          provider_refund_id = ${result.providerRefundId},
          provider_status = ${result.providerStatus},
          credit_note_id = ${creditNoteId},
          updated_at = NOW()
      WHERE id = ${id} AND office_id = ${officeId}
      RETURNING *
    `));

    res.json({
      refund: done,
      provider: result,
      note: "Provider outcome from fake transport only — not inferred from local state",
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/refunds/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  const officeId = String((req as any).tenantId ?? "");
  try {
    const row = one(await db.execute(sql`
      SELECT * FROM refund_requests WHERE id = ${String(req.params.id)} AND office_id = ${officeId}
    `));
    if (!row) return res.status(404).json({ error: "not found" });
    res.json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
