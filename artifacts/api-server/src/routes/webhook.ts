import { Router, type Request, type Response } from "express";
import { db, messagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// ─── GET: Meta Webhook Verification ───
router.get("/webhook/whatsapp", (req: Request, res: Response) => {
  const mode      = req.query["hub.mode"];
  const token     = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "adala_whatsapp_verify";

  if (mode === "subscribe" && token === verifyToken) {
    console.log("✅ WhatsApp Webhook verified");
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
    console.error("Webhook error:", err);
    res.status(200).json({ ok: true });
  }
});

// ─── GET: WhatsApp connection status ───
router.get("/webhook/whatsapp/settings", (req: Request, res: Response) => {
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
router.post("/webhook/whatsapp/test", async (req: Request, res: Response) => {
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
router.post("/webhook/whatsapp/send", async (req: Request, res: Response) => {
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

export default router;
