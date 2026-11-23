/**
 * Fee agreements — minimal auditable domain (ADALA-031).
 * No electronic signature / legally binding e-execution claim.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuthWithTenant } from "../../middlewares/requireAuth";

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

const FINANCIAL_ROLES = new Set([
  "firm_owner",
  "office_owner",
  "office_manager",
  "accountant",
  "lawyer",
]);

async function actorRole(userId: string, officeId: string): Promise<string> {
  const r = one(
    await db.execute(sql`
      SELECT role FROM office_members
      WHERE user_id = ${userId} AND office_id = ${officeId} AND status = 'active'
      LIMIT 1
    `),
  );
  return String(r?.role ?? "");
}

async function assertFinancialActor(req: Request, res: Response): Promise<{ userId: string; officeId: string; role: string } | null> {
  const userId = String((req as any).userId ?? "");
  const officeId = String((req as any).tenantId ?? "");
  if (!userId || !officeId || officeId === "platform") {
    res.status(403).json({ error: "tenant required" });
    return null;
  }
  const role = await actorRole(userId, officeId);
  if (!FINANCIAL_ROLES.has(role) && role !== "office_owner") {
    res.status(403).json({ error: "financial role required", code: "FEE_ROLE_DENIED" });
    return null;
  }
  return { userId, officeId, role: role || "lawyer" };
}

async function audit(officeId: string, agreementId: string, action: string, actorId: string, detail?: string) {
  await db.execute(sql`
    INSERT INTO fee_agreement_audit (id, office_id, agreement_id, action, actor_id, detail)
    VALUES (${randomUUID()}, ${officeId}, ${agreementId}, ${action}, ${actorId}, ${detail ?? null})
  `);
}

router.post("/fee-agreements", requireAuthWithTenant, async (req: Request, res: Response) => {
  const actor = await assertFinancialActor(req, res);
  if (!actor) return;
  try {
    if (req.body?.officeId && String(req.body.officeId) !== actor.officeId) {
      return res.status(403).json({ error: "forged tenant denied", code: "TENANT_FORGERY" });
    }
    const {
      title,
      caseId,
      clientId,
      clientName,
      feeStructure = "fixed",
      fixedFee,
      currency = "SAR",
      notes,
      installments = [],
      documentId,
    } = req.body ?? {};
    if (!title) return res.status(400).json({ error: "title required" });

    let totalValue = 0;
    if (feeStructure === "fixed" || feeStructure === "hourly") {
      totalValue = num(fixedFee);
    } else if (Array.isArray(installments) && installments.length) {
      totalValue = installments.reduce((s: number, i: any) => s + num(i.amount), 0);
    } else {
      totalValue = num(fixedFee);
    }
    if (totalValue < 0) return res.status(400).json({ error: "invalid total" });

    if (caseId) {
      const c = one(await db.execute(sql`
        SELECT id FROM cases WHERE id::text = ${String(caseId)} AND office_id = ${actor.officeId} LIMIT 1
      `));
      if (!c) return res.status(404).json({ error: "case not found in tenant" });
    }

    const id = randomUUID();
    await db.execute(sql`
      INSERT INTO fee_agreements (
        id, office_id, client_id, client_name, case_id, title, status,
        fee_structure, currency, fixed_fee, total_value, notes, document_id, created_by
      ) VALUES (
        ${id}, ${actor.officeId}, ${clientId ?? null}, ${clientName ?? null}, ${caseId ?? null},
        ${title}, 'draft', ${feeStructure}, ${currency},
        ${fixedFee != null ? num(fixedFee) : null}, ${totalValue}, ${notes ?? null},
        ${documentId ?? null}, ${actor.userId}
      )
    `);

    if (Array.isArray(installments)) {
      let seq = 1;
      for (const inst of installments) {
        await db.execute(sql`
          INSERT INTO fee_agreement_installments
            (id, office_id, agreement_id, seq, label, amount, due_date, status)
          VALUES (
            ${randomUUID()}, ${actor.officeId}, ${id}, ${seq},
            ${inst.label ?? `دفعة ${seq}`}, ${num(inst.amount)},
            ${inst.dueDate ?? null}, 'pending'
          )
        `);
        seq += 1;
      }
    }

    await audit(actor.officeId, id, "CREATE", actor.userId, `total=${totalValue}`);
    res.status(201).json({ id, totalValue, status: "draft" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/fee-agreements/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  const actor = await assertFinancialActor(req, res);
  if (!actor) return;
  try {
    const id = String(req.params.id);
    const agreement = one(await db.execute(sql`
      SELECT * FROM fee_agreements WHERE id = ${id} AND office_id = ${actor.officeId} LIMIT 1
    `));
    if (!agreement) return res.status(404).json({ error: "not found" });
    const installments = rows(await db.execute(sql`
      SELECT * FROM fee_agreement_installments
      WHERE agreement_id = ${id} AND office_id = ${actor.officeId}
      ORDER BY seq ASC
    `));
    const amendments = rows(await db.execute(sql`
      SELECT * FROM fee_agreement_amendments
      WHERE agreement_id = ${id} AND office_id = ${actor.officeId}
      ORDER BY created_at ASC
    `));
    const auditRows = rows(await db.execute(sql`
      SELECT * FROM fee_agreement_audit
      WHERE agreement_id = ${id} AND office_id = ${actor.officeId}
      ORDER BY created_at ASC
    `));
    res.json({ agreement, installments, amendments, audit: auditRows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/fee-agreements/:id/activate", requireAuthWithTenant, async (req: Request, res: Response) => {
  const actor = await assertFinancialActor(req, res);
  if (!actor) return;
  try {
    const id = String(req.params.id);
    const upd = one(await db.execute(sql`
      UPDATE fee_agreements SET status = 'active', updated_at = NOW()
      WHERE id = ${id} AND office_id = ${actor.officeId} AND status = 'draft'
      RETURNING id, status
    `));
    if (!upd) return res.status(404).json({ error: "not found or not draft" });
    await audit(actor.officeId, id, "ACTIVATE", actor.userId);
    res.json(upd);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/fee-agreements/:id/acknowledge", requireAuthWithTenant, async (req: Request, res: Response) => {
  const actor = await assertFinancialActor(req, res);
  if (!actor) return;
  try {
    const id = String(req.params.id);
    const by = String(req.body?.acknowledgmentBy ?? "client");
    const upd = one(await db.execute(sql`
      UPDATE fee_agreements
      SET acknowledgment_at = NOW(), acknowledgment_by = ${by}, updated_at = NOW()
      WHERE id = ${id} AND office_id = ${actor.officeId}
      RETURNING id, acknowledgment_at, acknowledgment_by
    `));
    if (!upd) return res.status(404).json({ error: "not found" });
    await audit(actor.officeId, id, "ACKNOWLEDGE", actor.userId, by);
    res.json({
      ...upd,
      note: "Client acknowledgment recorded — not an electronic signature or legally binding e-execution",
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/fee-agreements/:id/link-invoice", requireAuthWithTenant, async (req: Request, res: Response) => {
  const actor = await assertFinancialActor(req, res);
  if (!actor) return;
  try {
    const id = String(req.params.id);
    const invoiceId = String(req.body?.invoiceId ?? "");
    if (!invoiceId) return res.status(400).json({ error: "invoiceId required" });
    const inv = one(await db.execute(sql`
      SELECT id FROM client_invoices WHERE id::text = ${invoiceId} AND office_id = ${actor.officeId} LIMIT 1
    `));
    if (!inv) return res.status(404).json({ error: "invoice not found in tenant" });
    const upd = one(await db.execute(sql`
      UPDATE fee_agreements SET invoice_id = ${invoiceId}, updated_at = NOW()
      WHERE id = ${id} AND office_id = ${actor.officeId}
      RETURNING id, invoice_id
    `));
    if (!upd) return res.status(404).json({ error: "not found" });
    await audit(actor.officeId, id, "LINK_INVOICE", actor.userId, invoiceId);
    res.json(upd);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/fee-agreements/:id/amend", requireAuthWithTenant, async (req: Request, res: Response) => {
  const actor = await assertFinancialActor(req, res);
  if (!actor) return;
  try {
    const id = String(req.params.id);
    const changeSummary = String(req.body?.changeSummary ?? "").trim();
    if (!changeSummary) return res.status(400).json({ error: "changeSummary required" });
    const agr = one(await db.execute(sql`
      SELECT * FROM fee_agreements WHERE id = ${id} AND office_id = ${actor.officeId} LIMIT 1
    `));
    if (!agr) return res.status(404).json({ error: "not found" });
    const newTotal = req.body?.newTotal != null ? num(req.body.newTotal) : num(agr.total_value);
    await db.execute(sql`
      INSERT INTO fee_agreement_amendments
        (id, office_id, agreement_id, change_summary, previous_total, new_total, previous_status, new_status, amended_by)
      VALUES (
        ${randomUUID()}, ${actor.officeId}, ${id}, ${changeSummary},
        ${num(agr.total_value)}, ${newTotal}, ${agr.status}, 'amended', ${actor.userId}
      )
    `);
    await db.execute(sql`
      UPDATE fee_agreements
      SET total_value = ${newTotal}, status = 'amended', updated_at = NOW()
      WHERE id = ${id} AND office_id = ${actor.officeId}
    `);
    await audit(actor.officeId, id, "AMEND", actor.userId, changeSummary);
    res.json({ id, status: "amended", totalValue: newTotal });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
