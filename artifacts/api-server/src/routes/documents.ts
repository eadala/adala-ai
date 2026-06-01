import { Router } from "express";
import { db, documentsTable, casesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ListDocumentsQueryParams, CreateDocumentBody } from "@workspace/api-zod";

const router = Router();

router.get("/documents", async (req, res) => {
  try {
    const query = ListDocumentsQueryParams.parse(req.query);
    let docs = await db.select().from(documentsTable).orderBy(documentsTable.createdAt);
    if (query.caseId) docs = docs.filter((d) => d.caseId === query.caseId);

    const caseIds = [...new Set(docs.map((d) => d.caseId).filter(Boolean))] as string[];
    const cases = caseIds.length > 0
      ? await db.select({ id: casesTable.id, title: casesTable.title }).from(casesTable)
      : [];
    const caseMap = Object.fromEntries(cases.map((c) => [c.id, c.title]));

    res.json(docs.map((d) => ({
      id: d.id, caseId: d.caseId, caseName: d.caseId ? (caseMap[d.caseId] ?? null) : null,
      fileUrl: d.fileUrl, fileType: d.fileType, fileName: d.fileName,
      ocrText: d.ocrText, aiSummary: d.aiSummary,
      createdAt: d.createdAt.toISOString(),
    })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/documents", async (req, res) => {
  try {
    const body = CreateDocumentBody.parse(req.body);
    const [created] = await db.insert(documentsTable).values({
      caseId: body.caseId ?? null,
      fileUrl: body.fileUrl,
      fileType: body.fileType,
      fileName: body.fileName,
    }).returning();
    res.status(201).json({ ...created, caseName: null, createdAt: created.createdAt.toISOString() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/documents/:id", async (req, res) => {
  try {
    const [found] = await db.select().from(documentsTable).where(eq(documentsTable.id, req.params.id));
    if (!found) return res.status(404).json({ error: "Not found" });
    let caseName: string | null = null;
    if (found.caseId) {
      const [c] = await db.select({ title: casesTable.title }).from(casesTable).where(eq(casesTable.id, found.caseId));
      caseName = c?.title ?? null;
    }
    res.json({ ...found, caseName, createdAt: found.createdAt.toISOString() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/documents/:id", async (req, res) => {
  try {
    await db.delete(documentsTable).where(eq(documentsTable.id, req.params.id));
    res.status(204).end();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
