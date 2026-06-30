import { Router, type Request, type Response } from "express";
import { db, messagesTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { requireAuthWithTenant } from "../../middlewares/requireAuth";

const router = Router();

/* ── helpers ── */
async function dbRows(q: any): Promise<any[]> {
  try { const r = await db.execute(q) as any; return Array.isArray(r) ? r : (r?.rows ?? []); }
  catch { return []; }
}

// ─── GET: Meta Webhook Verification ───
router.get("/webhook/whatsapp", (req: Request, res: Response) => {
  const mode      = req.query["hub.mode"];
  const token     = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "adala_whatsapp_verify";

  if (mode === "subscribe" && token === verifyToken) {
        res.status(200).send(challenge as string);
    return;
  }
  res.status(403).json({ error: "Forbidden — token mismatch" });
});

// ─── POST: Receive Incoming Messages from Meta ───
router.post("/webhook/whatsapp", async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, any>;
    if (body.object !== "whatsapp_business_account") {
      res.status(400).json({ error: "Not a WhatsApp event" });
      return;
    }
    for (const entry of (body.entry ?? []) as any[]) {
      for (const change of (entry.changes ?? []) as any[]) {
        const value = change.value ?? {};

        if (value.messages) {
          for (const msg of value.messages as any[]) {
            const phone = msg.from as string;
            const msgId = msg.id as string;
            const type  = msg.type as string;
            let content = "";
            if (type === "text")          content = msg.text?.body ?? "";
            else if (type === "image")    content = `[صورة] ${msg.image?.caption ?? ""}`;
            else if (type === "document") content = `[مستند] ${msg.document?.filename ?? ""}`;
            else if (type === "audio")    content = "[رسالة صوتية]";
            else                          content = `[${type}]`;

            let category = "عام";
            if (/استشار|قانون|قضي|محام/.test(content))  category = "استشارة قانونية";
            else if (/موعد|جلس|تاريخ/.test(content))    category = "طلب موعد";
            else if (/مستند|وثيق|ملف/.test(content))    category = "طلب مستند";
            else if (/دفع|رسوم|مبلغ/.test(content))     category = "استفسار مالي";
            else if (/شكو|مشكل/.test(content))          category = "شكوى";

            await db.insert(messagesTable).values({
              channel: "whatsapp", direction: "inbound",
              fromPhone: phone, content, category,
              externalId: msgId, status: "received",
              metadata: JSON.stringify({ type }),
            }).onConflictDoNothing();
          }
        }

        if (value.statuses) {
          for (const s of value.statuses as any[]) {
            await db.update(messagesTable)
              .set({ status: s.status as string, updatedAt: new Date() })
              .where(eq(messagesTable.externalId, s.id as string));
          }
        }
      }
    }
    res.status(200).json({ ok: true });
  } catch (err) {
        res.status(200).json({ ok: true });
  }
});

// ─── GET: WhatsApp connection status ───
router.get("/webhook/whatsapp/settings", requireAuthWithTenant, (req: Request, res: Response) => {
  const hasPhone  = !!process.env.WHATSAPP_PHONE_NUMBER_ID;
  const hasToken  = !!process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneHint = hasPhone
    ? "****" + process.env.WHATSAPP_PHONE_NUMBER_ID!.slice(-4)
    : null;

  res.json({
    connected:      hasPhone && hasToken,
    phoneNumberId:  phoneHint,
    accessTokenSet: hasToken,
    verifyToken:    process.env.WHATSAPP_VERIFY_TOKEN || "adala_whatsapp_verify",
    provider:       process.env.WHATSAPP_PROVIDER || "meta",
    webhookUrl:     `${req.protocol}://${req.get("host")}/api/webhook/whatsapp`,
  });
});

// ─── POST: Test connection against Meta Graph API ───
router.post("/webhook/whatsapp/test", requireAuthWithTenant, async (req: Request, res: Response) => {
  const { phoneNumberId, accessToken } = req.body as { phoneNumberId?: string; accessToken?: string };
  if (!phoneNumberId || !accessToken) {
    res.status(400).json({ error: "Phone Number ID و Access Token مطلوبان" });
    return;
  }
  try {
    const r = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const d = (await r.json()) as Record<string, any>;
    if (d["error"]) {
      res.status(400).json({ error: (d["error"] as any).message ?? "Meta API error" });
      return;
    }
    res.json({ ok: true, phone: d["display_phone_number"] ?? phoneNumberId, verified: true });
  } catch {
    res.status(500).json({ error: "تعذّر الاتصال بـ Meta API" });
  }
});

// ─── POST: Send outbound WhatsApp message ───
router.post("/webhook/whatsapp/send", requireAuthWithTenant, async (req: Request, res: Response) => {
  const { to, message } = req.body as { to?: string; message?: string };
  const phoneNumberId   = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken     = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    res.status(400).json({ error: "لم يتم تهيئة WhatsApp API" });
    return;
  }
  if (!to || !message) {
    res.status(400).json({ error: "رقم الهاتف والرسالة مطلوبان" });
    return;
  }

  try {
    const r = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/\D/g, ""),
        type: "text",
        text: { body: message },
      }),
    });
    const d = (await r.json()) as Record<string, any>;
    if (d["error"]) {
      res.status(400).json({ error: (d["error"] as any).message });
      return;
    }

    const msgs = d["messages"] as any[] | undefined;
    await db.insert(messagesTable).values({
      channel: "whatsapp", direction: "outbound",
      toPhone: to, content: message, status: "sent",
      externalId: msgs?.[0]?.id as string | undefined,
    }).onConflictDoNothing();

    res.json({ ok: true, messageId: msgs?.[0]?.id });
  } catch (err: any) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/* ══════════════════════════════════════════════════
   MOYASAR PAYMENT WEBHOOK
══════════════════════════════════════════════════ */

/* POST /webhook/moyasar — Moyasar sends payment events here */
router.post("/webhook/moyasar", async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, any>;

    /* Optional: verify Moyasar signature if webhook_secret is set */
    const officeId = body.metadata?.office_id ?? "default";
    const settings = await dbRows(sql`
      SELECT webhook_secret FROM moyasar_settings WHERE office_id = ${officeId} LIMIT 1
    `);
    const secret = settings[0]?.webhook_secret;
    if (secret) {
      const sig = req.headers["x-moyasar-signature"] as string ?? "";
      const raw = JSON.stringify(body);
      const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
      if (sig && sig !== expected) {
        res.status(403).json({ error: "توقيع غير صحيح" });
        return;
      }
    }

    const { id: moyasarId, status, amount, currency, description, metadata } = body;
    const txRef = metadata?.ref as string | undefined;
    const txId  = metadata?.tx_id as string | undefined;

    if (!moyasarId) { res.json({ ok: true, skipped: true }); return; }

    /* Map Moyasar status → our status */
    const statusMap: Record<string, string> = {
      paid: "completed", initiated: "pending", captured: "completed",
      refunded: "refunded", voided: "cancelled", failed: "failed",
    };
    const newStatus = statusMap[status] ?? "pending";
    const amountSAR = typeof amount === "number" ? amount / 100 : parseFloat(amount ?? "0") / 100;

    /* Find transaction by ref or moyasar id */
    let updated = false;
    if (txId) {
      await db.execute(sql`
        UPDATE payment_transactions
        SET status = ${newStatus},
            gateway_payment_id = ${moyasarId},
            updated_at = NOW()
        WHERE id = ${txId}::uuid
      `).catch(() => {});
      updated = true;
    } else if (txRef) {
      await db.execute(sql`
        UPDATE payment_transactions
        SET status = ${newStatus},
            gateway_payment_id = ${moyasarId},
            updated_at = NOW()
        WHERE gateway_payment_id = ${txRef} AND gateway = 'moyasar'
      `).catch(() => {});
      updated = true;
    }

    /* If no existing transaction, create one */
    if (!updated && moyasarId && amountSAR > 0) {
      const commission = 10;
      const platformFee = parseFloat((amountSAR * commission / 100).toFixed(2));
      const netAmount   = parseFloat((amountSAR - platformFee).toFixed(2));
      await db.execute(sql`
        INSERT INTO payment_transactions
          (office_id, description, amount, platform_fee, net_amount,
           status, payment_method, gateway, gateway_payment_id)
        VALUES
          (${officeId}, ${description ?? "دفع Moyasar"}, ${amountSAR}, ${platformFee},
           ${netAmount}, ${newStatus}, 'moyasar', 'moyasar', ${moyasarId})
        ON CONFLICT DO NOTHING
      `).catch(() => {});
    }

    console.log(`✅ Moyasar Webhook: ${moyasarId} → ${newStatus} (${amountSAR} SAR)`);
    res.json({ ok: true, received: moyasarId, status: newStatus });
  } catch (err: any) {
        res.status(500).json({ error: err.message });
  }
});

/* GET /webhook/moyasar/callback — Moyasar redirect after payment */
router.get("/webhook/moyasar/callback", async (req: Request, res: Response) => {
  try {
    const { tx, id: moyasarId, status: mStatus } = req.query as any;
    if (tx) {
      const finalStatus = mStatus === "paid" ? "completed" : "pending";
      await db.execute(sql`
        UPDATE payment_transactions
        SET status = ${finalStatus},
            gateway_payment_id = COALESCE(gateway_payment_id, ${moyasarId ?? null}),
            updated_at = NOW()
        WHERE id = ${tx}::uuid
      `).catch(() => {});
    }
    const base = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "https://adala-ai.app";
    res.redirect(`${base}/payment-center?gateway=moyasar&result=${mStatus ?? "unknown"}`);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
