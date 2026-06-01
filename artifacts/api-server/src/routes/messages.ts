import { Router } from "express";
import { db, messagesTable, casesTable } from "@workspace/db";
import { ListMessagesQueryParams, SendMessageBody } from "@workspace/api-zod";

const router = Router();

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
