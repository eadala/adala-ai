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

  /* ── findAll ── */
  async findAll(filters?: CaseFilters): Promise<CaseEntity[]> {
    const rows = await db.execute(sql`
      SELECT id, title, description, case_type, status,
             client_name, assigned_to, created_at, updated_at,
             COALESCE(source,'manual') AS source,
             store_order_id, created_by, office_id
      FROM cases
      WHERE office_id = ${this.tenantId}
      ORDER BY created_at DESC
    `);
    let list: any[] = (rows as any).rows ?? (rows as any) ?? [];
    if (filters?.status)   list = list.filter(c => c.status    === filters.status);
    if (filters?.caseType) list = list.filter(c => c.case_type === filters.caseType);
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(c => c.title?.toLowerCase().includes(q) || c.client_name?.toLowerCase().includes(q));
    }
    return list.map(mapRow);
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
