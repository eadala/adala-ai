/**
 * Case Repository — طبقة عزل قاعدة البيانات
 * ────────────────────────────────────────────
 * القاعدة الصارمة: كل query تتضمن office_id (tenant_id) + deleted_at IS NULL
 * لا يُسمح بالوصول المباشر لقاعدة البيانات خارج هذا الملف
 */

import { db, casesTable } from "@workspace/db";
import { eq, and, sql }   from "drizzle-orm";
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
    version:     Number(c.version ?? 1),
    deletedAt:   c.deleted_at ?? c.deletedAt ?? null,
  };
}

export class CaseRepository {
  constructor(private readonly tenantId: string) {}

  /* ── findAll — all filters + LIMIT/OFFSET + soft-delete guard ── */
  async findAll(filters?: CaseFilters): Promise<CaseEntity[]> {
    const statusCond   = filters?.status
      ? sql`AND status    = ${filters.status}`   : sql``;
    const caseTypeCond = filters?.caseType
      ? sql`AND case_type = ${filters.caseType}` : sql``;

    /* Full-text search via trigram (pg_trgm) — falls back gracefully */
    const searchCond = filters?.search
      ? sql`AND (title ILIKE ${"%" + filters.search + "%"} OR client_name ILIKE ${"%" + filters.search + "%"})`
      : sql``;

    /* Row-level visibility: restrict to assigned/created-by user when set */
    const roleCond = filters?.assignedUserId
      ? sql`AND (assigned_to = ${filters.assignedUserId} OR created_by = ${filters.assignedUserId})`
      : sql``;

    const limitSql  = sql`LIMIT  ${filters?.limit  ?? 200}`;
    const offsetSql = filters?.offset ? sql`OFFSET ${filters.offset}` : sql``;

    const rows = await db.execute(sql`
      SELECT id, title, description, case_type, status,
             client_name, assigned_to, created_at, updated_at,
             COALESCE(source,'manual') AS source,
             store_order_id, created_by, office_id, version, deleted_at
      FROM cases
      WHERE office_id = ${this.tenantId} AND deleted_at IS NULL
      ${statusCond} ${caseTypeCond} ${searchCond} ${roleCond}
      ORDER BY created_at DESC
      ${limitSql} ${offsetSql}
    `);
    const list: any[] = (rows as any).rows ?? (rows as any) ?? [];
    return list.map(mapRow);
  }

  /* ── countAll — COUNT(*) with same filters ── */
  async countAll(filters?: Pick<CaseFilters, "status" | "caseType" | "search" | "assignedUserId">): Promise<number> {
    const statusCond   = filters?.status
      ? sql`AND status    = ${filters.status}`   : sql``;
    const caseTypeCond = filters?.caseType
      ? sql`AND case_type = ${filters.caseType}` : sql``;
    const searchCond   = filters?.search
      ? sql`AND (title ILIKE ${"%" + filters.search + "%"} OR client_name ILIKE ${"%" + filters.search + "%"})`
      : sql``;
    const roleCond = filters?.assignedUserId
      ? sql`AND (assigned_to = ${filters.assignedUserId} OR created_by = ${filters.assignedUserId})`
      : sql``;

    const rows = await db.execute(sql`
      SELECT COUNT(*) AS total FROM cases
      WHERE office_id = ${this.tenantId} AND deleted_at IS NULL
      ${statusCond} ${caseTypeCond} ${searchCond} ${roleCond}
    `);
    const list: any[] = (rows as any).rows ?? (rows as any) ?? [];
    return Number(list[0]?.total ?? 0);
  }

  /* ── findById ── strictly scoped to tenant, excludes soft-deleted ── */
  async findById(id: string): Promise<CaseEntity | null> {
    const rows = await db.execute(sql`
      SELECT *, COALESCE(source,'manual') AS source
      FROM cases
      WHERE id = ${id} AND office_id = ${this.tenantId} AND deleted_at IS NULL
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

  /* ── update ── versioned atomic UPDATE ── */
  async update(id: string, data: UpdateCaseInput): Promise<CaseEntity | null> {
    const clientVersion = data.version;

    /* Conditional SET clauses — each carries its own leading comma */
    const tSet  = data.title       !== undefined ? sql`, title       = ${data.title}`       : sql``;
    const dSet  = data.description !== undefined ? sql`, description = ${data.description}` : sql``;
    const ctSet = data.caseType    !== undefined ? sql`, case_type   = ${data.caseType}`    : sql``;
    const stSet = data.status      !== undefined ? sql`, status      = ${data.status}`      : sql``;
    const cnSet = data.clientName  !== undefined ? sql`, client_name = ${data.clientName}`  : sql``;
    const atSet = data.assignedTo  !== undefined ? sql`, assigned_to = ${data.assignedTo}`  : sql``;

    /* Version optimistic-lock condition */
    const vCond = clientVersion !== undefined
      ? sql`AND version = ${clientVersion}`
      : sql``;

    const rows = await db.execute(sql`
      UPDATE cases
      SET updated_at = NOW(), version = version + 1
          ${tSet} ${dSet} ${ctSet} ${stSet} ${cnSet} ${atSet}
      WHERE id = ${id}
        AND office_id = ${this.tenantId}
        AND deleted_at IS NULL
        ${vCond}
      RETURNING id, office_id, title, description, case_type, status,
                client_name, assigned_to, created_at, updated_at,
                COALESCE(source,'manual') AS source,
                store_order_id, created_by, version, deleted_at
    `);
    const list: any[] = (rows as any).rows ?? (rows as any) ?? [];

    if (list.length === 0 && clientVersion !== undefined) {
      throw Object.assign(
        new Error("تم تعديل هذه القضية من شخص آخر، يرجى تحديث الصفحة"),
        { statusCode: 409 },
      );
    }
    return list[0] ? mapRow(list[0]) : null;
  }

  /* ── softDelete ── sets deleted_at, keeps data intact ── */
  async softDelete(id: string): Promise<void> {
    await db.execute(sql`
      UPDATE cases
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = ${id} AND office_id = ${this.tenantId} AND deleted_at IS NULL
    `);
  }

  /* ── hardDelete ── permanent, super_admin only ── */
  async hardDelete(id: string): Promise<void> {
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
      FROM cases WHERE office_id = ${this.tenantId} AND deleted_at IS NULL
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
