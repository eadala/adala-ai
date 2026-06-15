import { requireAuth } from "../middlewares/requireAuth";
/**
 * Office-facing Support Ticket routes
 * Offices can create, view, and reply to their own tickets.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { supportTicketsTable, supportMessagesTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";

const router = Router();



async function safeRows(q: any): Promise<any[]> {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}

/* ── List own tickets ──────────────────────────────── */
router.get("/support/tickets", requireAuth, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) { res.status(401).json({ error: "غير مصرح" }); return; }
    const tickets = await db.select().from(supportTicketsTable)
      .where(eq(supportTicketsTable.userId, userId))
      .orderBy(desc(supportTicketsTable.createdAt));
    res.json(tickets);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Create ticket ─────────────────────────────────── */
router.post("/support/tickets", requireAuth, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) { res.status(401).json({ error: "غير مصرح" }); return; }
    const { subject, body, priority = "medium", category = "technical" } = req.body;
    if (!subject || !body) return res.status(400).json({ error: "الموضوع والتفاصيل مطلوبة" });

    // Get user info from Clerk
    const auth = getAuth(req);
    const userEmail = (req as any).auth?.sessionClaims?.email ?? req.body.userEmail ?? "";
    const userName  = (req as any).auth?.sessionClaims?.name  ?? req.body.userName  ?? "مستخدم";

    const [ticket] = await db.insert(supportTicketsTable).values({
      subject, body, priority, category,
      userId, userEmail, userName,
      officeName: req.body.officeName ?? null,
      status: "open",
    }).returning();

    // Add initial message as first thread entry
    await db.insert(supportMessagesTable).values({
      ticketId: ticket.id,
      senderType: "office",
      senderName: userName,
      message: body,
    });

    res.json(ticket);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Get single ticket + messages ──────────────────── */
router.get("/support/tickets/:id", requireAuth, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) { res.status(401).json({ error: "غير مصرح" }); return; }
    const { id } = req.params as Record<string, string>;

    const [ticket] = await db.select().from(supportTicketsTable)
      .where(and(eq(supportTicketsTable.id, id), eq(supportTicketsTable.userId, userId)));
    if (!ticket) return res.status(404).json({ error: "التذكرة غير موجودة" });

    const messages = await db.select().from(supportMessagesTable)
      .where(eq(supportMessagesTable.ticketId, id))
      .orderBy(supportMessagesTable.createdAt);

    res.json({ ticket, messages });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Reply to ticket ───────────────────────────────── */
router.post("/support/tickets/:id/messages", requireAuth, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) { res.status(401).json({ error: "غير مصرح" }); return; }
    const { id } = req.params as Record<string, string>;
    const { message, senderName = "المستخدم" } = req.body;
    if (!message) return res.status(400).json({ error: "الرسالة مطلوبة" });

    // Verify ownership
    const [ticket] = await db.select().from(supportTicketsTable)
      .where(and(eq(supportTicketsTable.id, id), eq(supportTicketsTable.userId, userId)));
    if (!ticket) return res.status(404).json({ error: "التذكرة غير موجودة" });
    if (ticket.status === "closed") return res.status(400).json({ error: "التذكرة مغلقة" });

    const [msg] = await db.insert(supportMessagesTable).values({
      ticketId: id, senderType: "office", senderName, message,
    }).returning();

    // Re-open if was resolved
    if (ticket.status === "resolved") {
      await db.update(supportTicketsTable)
        .set({ status: "in_progress", updatedAt: new Date() })
        .where(eq(supportTicketsTable.id, id));
    }

    res.json(msg);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Close ticket ──────────────────────────────────── */
router.patch("/support/tickets/:id/close", requireAuth, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) { res.status(401).json({ error: "غير مصرح" }); return; }
    const { id } = req.params as Record<string, string>;
    const [updated] = await db.update(supportTicketsTable)
      .set({ status: "closed", updatedAt: new Date() })
      .where(and(eq(supportTicketsTable.id, id), eq(supportTicketsTable.userId, userId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "التذكرة غير موجودة" });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
