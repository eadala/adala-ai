import { requireAuth, requireAuthWithTenant } from "../../middlewares/requireAuth";
import { Router } from "express";
import { db, documentsTable, casesTable } from "@workspace/db";
import { auditLog, auditMeta } from "../../lib/auditLogger";
import { eq, and } from "drizzle-orm";
import { ListDocumentsQueryParams, CreateDocumentBody } from "@workspace/api-zod";

const router = Router();

router.get("/documents", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const query = ListDocumentsQueryParams.parse(req.query);

    const conditions = [eq((documentsTable as any).officeId, tenantId)];
    if (query.caseId) conditions.push(eq(documentsTable.caseId, query.caseId));

    const docs = await db.select().from(documentsTable)
      .where(and(...conditions))
      .orderBy(documentsTable.createdAt);

    const caseIds = [...new Set(docs.map((d) => d.caseId).filter(Boolean))] as string[];
    const cases = caseIds.length > 0
      ? await db.select({ id: casesTable.id, title: casesTable.title }).from(casesTable)
        .where(eq((casesTable as any).officeId, tenantId))
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

router.post("/documents", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const body = CreateDocumentBody.parse(req.body);
    const [created] = await db.insert(documentsTable).values({
      caseId:   body.caseId ?? null,
      officeId: tenantId,
      fileUrl:  body.fileUrl,
      fileType: body.fileType,
      fileName: body.fileName,
    } as any).returning();
    auditLog({ ...auditMeta(req), action: "upload", resource: "document", resourceId: String(created.id), details: `ملف: ${body.fileName ?? body.fileType}` }).catch(() => {});
    res.status(201).json({ ...created, caseName: null, createdAt: created.createdAt.toISOString() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/documents/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const [found] = await db.select().from(documentsTable)
      .where(and(eq(documentsTable.id, String(req.params.id)), eq((documentsTable as any).officeId, tenantId)));
    if (!found) return res.status(404).json({ error: "Not found" });
    let caseName: string | null = null;
    if (found.caseId) {
      const [c] = await db.select({ title: casesTable.title }).from(casesTable)
        .where(and(eq(casesTable.id, found.caseId), eq((casesTable as any).officeId, tenantId)));
      caseName = c?.title ?? null;
    }
    res.json({ ...found, caseName, createdAt: found.createdAt.toISOString() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/documents/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    await db.delete(documentsTable)
      .where(and(eq(documentsTable.id, String(req.params.id)), eq((documentsTable as any).officeId, tenantId)));
    auditLog({ ...auditMeta(req), action: "delete", resource: "document", resourceId: String(req.params.id) }).catch(() => {});
    res.status(204).end();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
