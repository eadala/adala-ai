/**
 * Case Repository — طبقة عزل قاعدة البيانات
 * ────────────────────────────────────────────
 * القاعدة الصارمة: كل query تتضمن office_id (tenant_id)
 * لا يُسمح بالوصول المباشر لقاعدة البيانات خارج هذا الملف
 */

import { db, casesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import type { CaseEntity, CreateCaseInput, UpdateCaseInput, CaseFilters } from "./case.entity";

function mapRow(c: any): CaseEntity {
  return {
    id:          c.id,
    officeId:    c.officeId ?? c.office_id,
    title:       c.title,
    description: c.description ?? undefined,
    caseType:    c.caseType ?? c.case_type,
    status:      c.status,
    clientName:  c.clientName ?? c.client_name ?? undefined,
    assignedTo:  c.assignedTo ?? c.assigned_to ?? undefined,
    source:      c.source ?? "manual",
    storeOrderId: c.storeOrderId ?? c.store_order_id ?? undefined,
    createdBy:   c.createdBy ?? c.created_by ?? undefined,
    createdAt:   c.createdAt ?? c.created_at,
    updatedAt:   c.updatedAt ?? c.updated_at,
  };
}

export class CaseRepository {
  constructor(private readonly tenantId: string) {}

  /* ── findAll — all filters + LIMIT/OFFSET pushed to SQL ── */
  async findAll(filters?: CaseFilters): Promise<CaseEntity[]> {
    const statusCond   = filters?.status
      ? sql`AND status    = ${filters.status}`   : sql``;
    const caseTypeCond = filters?.caseType
      ? sql`AND case_type = ${filters.caseType}` : sql``;
    const searchCond   = filters?.search
      ? sql`AND (LOWER(title) LIKE ${"%" + filters.search.toLowerCase() + "%"} OR LOWER(client_name) LIKE ${"%" + filters.search.toLowerCase() + "%"})`
      : sql``;
    const limitSql  = sql`LIMIT  ${filters?.limit  ?? 200}`;
    const offsetSql = filters?.offset ? sql`OFFSET ${filters.offset}` : sql``;

    const rows = await db.execute(sql`
      SELECT id, title, description, case_type, status,
             client_name, assigned_to, created_at, updated_at,
             COALESCE(source,'manual') AS source,
             store_order_id, created_by, office_id
      FROM cases
      WHERE office_id = ${this.tenantId}
      ${statusCond} ${caseTypeCond} ${searchCond}
      ORDER BY created_at DESC
      ${limitSql} ${offsetSql}
    `);
    const list: any[] = (rows as any).rows ?? (rows as any) ?? [];
    return list.map(mapRow);
  }

  /* ── countAll — COUNT(*) with same filters (for pagination total) ── */
  async countAll(filters?: Pick<CaseFilters, "status" | "caseType" | "search">): Promise<number> {
    const statusCond   = filters?.status
      ? sql`AND status    = ${filters.status}`   : sql``;
    const caseTypeCond = filters?.caseType
      ? sql`AND case_type = ${filters.caseType}` : sql``;
    const searchCond   = filters?.search
      ? sql`AND (LOWER(title) LIKE ${"%" + filters.search.toLowerCase() + "%"} OR LOWER(client_name) LIKE ${"%" + filters.search.toLowerCase() + "%"})`
      : sql``;
    const rows = await db.execute(sql`
      SELECT COUNT(*) AS total FROM cases
      WHERE office_id = ${this.tenantId}
      ${statusCond} ${caseTypeCond} ${searchCond}
    `);
    const list: any[] = (rows as any).rows ?? (rows as any) ?? [];
    return Number(list[0]?.total ?? 0);
  }

  /* ── findById ── strictly scoped to tenant ── */
  async findById(id: string): Promise<CaseEntity | null> {
    const rows = await db.execute(sql`
      SELECT * FROM cases
      WHERE id = ${id} AND office_id = ${this.tenantId}
      LIMIT 1
    `);
    const list: any[] = (rows as any).rows ?? (rows as any) ?? [];
    return list[0] ? mapRow(list[0]) : null;
  }

  /* ── create ── */
  async create(data: CreateCaseInput): Promise<CaseEntity> {
    const [created] = await db.insert(casesTable).values({
      title:       data.title,
      description: data.description ?? null,
      caseType:    data.caseType,
      status:      data.status ?? "open",
      clientName:  data.clientName ?? null,
      assignedTo:  data.assignedTo ?? null,
      officeId:    this.tenantId,
      source:      data.source ?? "manual",
      createdBy:   data.createdBy ?? null,
    } as any).returning();
    return mapRow(created);
  }

  /* ── update ── always double-scoped by id AND office_id ── */
  async update(id: string, data: UpdateCaseInput): Promise<CaseEntity | null> {
    const patch: Record<string, any> = { updatedAt: new Date() };
    if (data.title       !== undefined) patch.title       = data.title;
    if (data.description !== undefined) patch.description = data.description;
    if (data.caseType    !== undefined) patch.caseType    = data.caseType;
    if (data.status      !== undefined) patch.status      = data.status;
    if (data.clientName  !== undefined) patch.clientName  = data.clientName;
    if (data.assignedTo  !== undefined) patch.assignedTo  = data.assignedTo;

    const [updated] = await db.update(casesTable)
      .set(patch)
      .where(and(eq(casesTable.id, id), eq((casesTable as any).officeId, this.tenantId)))
      .returning();
    return updated ? mapRow(updated) : null;
  }

  /* ── delete ── always double-scoped ── */
  async delete(id: string): Promise<void> {
    await db.delete(casesTable)
      .where(and(eq(casesTable.id, id), eq((casesTable as any).officeId, this.tenantId)));
  }

  /* ── stats ── */
  async getStats(): Promise<{ total: number; open: number; inProgress: number; closed: number }> {
    const rows = await db.execute(sql`
      SELECT
        COUNT(*)::int                                          AS total,
        COUNT(*) FILTER (WHERE status = 'open')::int          AS open,
        COUNT(*) FILTER (WHERE status = 'in_progress')::int   AS in_progress,
        COUNT(*) FILTER (WHERE status = 'closed')::int        AS closed
      FROM cases WHERE office_id = ${this.tenantId}
    `);
    const r = ((rows as any).rows ?? (rows as any))?.[0] ?? {};
    return {
      total:      Number(r.total       ?? 0),
      open:       Number(r.open        ?? 0),
      inProgress: Number(r.in_progress ?? 0),
      closed:     Number(r.closed      ?? 0),
    };
  }
}
