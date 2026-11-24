/* eslint-disable @typescript-eslint/no-explicit-any -- pre-existing lint debt; pagination touch-up */
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { Router } from "express";
import { db, documentsTable, casesTable } from "@workspace/db";
import { auditLog, auditMeta } from "../../lib/auditLogger";
import { eq, and, inArray, sql } from "drizzle-orm";
import { ListDocumentsQueryParams, CreateDocumentBody } from "@workspace/api-zod";
import {
  MAX_PAGE_LIMIT,
  parsePageLimit,
  queryHasPageAndLimit,
} from "../../lib/paginationSafety";

const router = Router();

router.get("/documents", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const query = ListDocumentsQueryParams.parse(req.query);
    const paginated = queryHasPageAndLimit(req.query);
    const { page, limit, offset } = paginated
      ? parsePageLimit(req.query, 50)
      : { page: 1, limit: MAX_PAGE_LIMIT, offset: 0 };
    const search =
      typeof req.query.search === "string" && req.query.search.trim()
        ? req.query.search.trim()
        : null;

    const conditions = [eq((documentsTable as any).officeId, tenantId)];
    if (query.caseId) conditions.push(eq(documentsTable.caseId, query.caseId));
    if (search) {
      conditions.push(sql`(
        COALESCE(${documentsTable.fileName}, '') ILIKE ${"%" + search + "%"}
        OR COALESCE(${documentsTable.fileType}, '') ILIKE ${"%" + search + "%"}
      )`);
    }

    const where = and(...conditions);

    const [docs, countRow] = await Promise.all([
      db.select().from(documentsTable)
        .where(where)
        .orderBy(documentsTable.createdAt)
        .limit(limit)
        .offset(offset),
      db.select({ total: sql<number>`count(*)::int` }).from(documentsTable).where(where)
        .then((rows) => rows[0]),
    ]);

    const caseIds = [...new Set(docs.map((d) => d.caseId).filter(Boolean))] as string[];
    const cases = caseIds.length > 0
      ? await db.select({ id: casesTable.id, title: casesTable.title }).from(casesTable)
        .where(and(
          eq((casesTable as any).officeId, tenantId),
          inArray(casesTable.id, caseIds),
        ))
      : [];
    const caseMap = Object.fromEntries(cases.map((c) => [c.id, c.title]));

    const mapped = docs.map((d) => ({
      id: d.id, caseId: d.caseId, caseName: d.caseId ? (caseMap[d.caseId] ?? null) : null,
      fileUrl: d.fileUrl, fileType: d.fileType, fileName: d.fileName,
      ocrText: d.ocrText, aiSummary: d.aiSummary,
      createdAt: d.createdAt.toISOString(),
    }));

    if (!paginated) {
      res.json(mapped);
      return;
    }

    const total = Number(countRow?.total ?? 0);
    res.json({
      data: mapped,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
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
