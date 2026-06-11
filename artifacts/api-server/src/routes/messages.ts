import { Router } from "express";
import { db, messagesTable, casesTable } from "@workspace/db";
import { ListMessagesQueryParams, SendMessageBody } from "@workspace/api-zod";

const router = Router();

// ── GET /messages/conversations  — grouped view ───────────────────────────────
router.get("/messages/conversations", async (req, res) => {
  try {
    const msgs = await db.select().from(messagesTable).orderBy(messagesTable.createdAt);
    const allCases = await db.select({ id: casesTable.id, title: casesTable.title }).from(casesTable);
    const caseMap = Object.fromEntries(allCases.map((c) => [c.id, c.title]));

    const groups: Record<string, typeof msgs> = {};
    for (const m of msgs) {
      const key = m.caseId ?? "__direct__";
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    }

    const conversations = Object.entries(groups).map(([key, messages]) => {
      const lastMsg = messages[messages.length - 1];
      const unread = messages.filter(m => m.direction === "inbound" && m.status !== "read").length;
      const name = key === "__direct__" ? "مراسلات مباشرة" : (caseMap[key] ?? `قضية ${key.slice(0, 8)}`);
      return {
        id: key,
        caseId: key === "__direct__" ? null : key,
        name,
        channel: lastMsg.channel ?? "internal",
        lastMsg: lastMsg.content,
        time: lastMsg.createdAt.toISOString(),
        unread,
        starred: false,
        online: false,
        caseRef: key !== "__direct__" ? key.slice(0, 8).toUpperCase() : undefined,
        messages: messages.map(m => ({
          id: m.id,
          from: m.direction === "inbound" ? "client" : "me",
          content: m.content,
          time: m.createdAt.toISOString(),
          status: m.status ?? undefined,
          channel: m.channel ?? "internal",
        })),
      };
    });

    res.json(conversations);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /messages  — flat list ────────────────────────────────────────────────
router.get("/messages", async (req, res) => {
  try {
    const query = ListMessagesQueryParams.parse(req.query);
    let msgs = await db.select().from(messagesTable).orderBy(messagesTable.createdAt);
    if (query.caseId) msgs = msgs.filter((m) => m.caseId === query.caseId);
    if (query.channel) msgs = msgs.filter((m) => m.channel === query.channel);

    const caseIds = [...new Set(msgs.map((m) => m.caseId).filter(Boolean))] as string[];
    const cases = caseIds.length > 0
      ? await db.select({ id: casesTable.id, title: casesTable.title }).from(casesTable)
      : [];
    const caseMap = Object.fromEntries(cases.map((c) => [c.id, c.title]));

    res.json(msgs.map((m) => ({
      id: m.id, caseId: m.caseId, caseName: m.caseId ? (caseMap[m.caseId] ?? null) : null,
      channel: m.channel, direction: m.direction, content: m.content, status: m.status,
      createdAt: m.createdAt.toISOString(),
    })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/messages", async (req, res) => {
  try {
    const body = SendMessageBody.parse(req.body);
    const [created] = await db.insert(messagesTable).values({
      caseId: body.caseId ?? null,
      channel: body.channel,
      direction: "outbound",
      content: body.content,
      status: "sent",
    }).returning();
    res.status(201).json({ ...created, caseName: null, createdAt: created.createdAt.toISOString() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
