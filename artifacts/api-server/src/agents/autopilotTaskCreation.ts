/**
 * Stage 15.2d — Autopilot task-creation contract (pure + injectable DB).
 * No module-level database import (safe for unit tests without DATABASE_URL).
 */

import { sql } from "drizzle-orm";
import { resolveTaskOfficeId } from "../lib/taskTenantVisibility";
import { classifyTenantId } from "../lib/tenantResolution";

export type AutopilotTaskCreateStatus = "success" | "partial" | "failed" | "skipped";

export interface AutopilotTaskCreateError {
  taskTitle?: string;
  code: string;
  message: string;
}

/** Structured outcome of Autopilot task inserts (actual DB rows, not planned). */
export interface AutopilotTaskCreateResult {
  status: AutopilotTaskCreateStatus;
  planned: number;
  created: number;
  failed: number;
  skipped: number;
  reason?: string;
  errors?: AutopilotTaskCreateError[];
  /** Canonical Office UUID used for inserts — never default, platform, trial_*, or NULL. */
  officeId?: string;
}

export interface PlannedAutopilotTask {
  title: string;
  priority: string;
  description: string;
}

export interface AutopilotCaseContext {
  case: {
    id?: unknown;
    title?: string | null;
    status?: string | null;
    client_name?: string | null;
    description?: string | null;
    assigned_to?: string | null;
    [key: string]: unknown;
  };
  documents: unknown[];
  events: Array<{ start_at?: string | null }>;
  contracts: unknown[];
  invoices?: unknown[];
  tasks?: unknown[];
}

type ExecuteFn = (q: unknown) => Promise<unknown>;
type TransactionFn = <T>(fn: (tx: { execute: ExecuteFn }) => Promise<T>) => Promise<T>;

export interface AutopilotTaskDb {
  execute: ExecuteFn;
  transaction: TransactionFn;
}

/**
 * Classify insert counts into the Autopilot result contract.
 * - planned=0 → success (nothing to create is valid)
 * - planned>0 && created=0 → never success
 * - 0 < created < planned → partial
 */
export function classifyAutopilotInsertOutcome(input: {
  planned: number;
  created: number;
  failed?: number;
  skipped?: number;
  reason?: string;
  errors?: AutopilotTaskCreateError[];
  officeId?: string;
}): AutopilotTaskCreateResult {
  const planned = Math.max(0, input.planned);
  const created = Math.max(0, input.created);
  const failed = Math.max(0, input.failed ?? 0);
  const skipped = Math.max(0, input.skipped ?? 0);
  const base = {
    planned,
    created,
    failed,
    skipped,
    reason: input.reason,
    errors: input.errors,
    officeId: input.officeId,
  };

  if (planned === 0 && created === 0) {
    return { ...base, status: "success", reason: input.reason ?? "no_tasks_planned" };
  }

  if (created === planned && failed === 0 && skipped === 0) {
    return { ...base, status: "success" };
  }

  if (created > 0 && created < planned) {
    return { ...base, status: "partial", reason: input.reason ?? "partial_insert" };
  }

  if (skipped > 0 && created === 0 && failed === 0) {
    return { ...base, status: "skipped", reason: input.reason ?? "tasks_skipped" };
  }

  return { ...base, status: "failed", reason: input.reason ?? "insert_failed" };
}

/** True only for canonical Office UUID — rejects default, platform, trial_*, NULL, or text. */
export function resolveAutopilotOfficeId(tenantId: unknown): string | null {
  const kind = classifyTenantId(
    tenantId == null || tenantId === "" ? null : String(tenantId),
  );
  if (kind !== "uuid") return null;
  return resolveTaskOfficeId(tenantId);
}

/** Pure planner — does not write to the database. */
export function planAutopilotTasks(ctx: AutopilotCaseContext): PlannedAutopilotTask[] {
  const c = ctx.case;
  const caseTitle = c.title ?? "القضية";
  const tasks: PlannedAutopilotTask[] = [];

  if (!c.client_name) {
    tasks.push({
      title:       "إضافة بيانات العميل",
      priority:    "high",
      description: `استكمال بيانات العميل في القضية "${caseTitle}"`,
    });
  }

  if (!c.description || c.description.trim().length < 20) {
    tasks.push({
      title:       "استكمال وصف القضية",
      priority:    "medium",
      description: `إضافة وصف تفصيلي لملابسات القضية "${caseTitle}"`,
    });
  }

  if (ctx.documents.length === 0) {
    tasks.push({
      title:       "رفع مستندات القضية",
      priority:    "high",
      description: `رفع المستندات والأدلة الداعمة للقضية "${caseTitle}"`,
    });
  }

  const upcoming = ctx.events.filter(e => e.start_at && new Date(e.start_at) > new Date());
  if (upcoming.length === 0 && (c.status === "open" || c.status === "in_progress")) {
    tasks.push({
      title:       "تحديد موعد الجلسة القادمة",
      priority:    "high",
      description: `إدراج موعد الجلسة القادمة في التقويم للقضية "${caseTitle}"`,
    });
  }

  if (ctx.contracts.length === 0) {
    tasks.push({
      title:       "إعداد عقد الوكالة القانونية",
      priority:    "medium",
      description: `إنشاء وتوقيع عقد الوكالة القانونية للقضية "${caseTitle}"`,
    });
  }

  if (!c.assigned_to) {
    tasks.push({
      title:       "تعيين المحامي المسؤول",
      priority:    "medium",
      description: `تحديد المحامي المسؤول عن متابعة القضية "${caseTitle}"`,
    });
  }

  return tasks;
}

/**
 * Insert planned Autopilot tasks under a canonical Office UUID.
 * Atomic: all inserts succeed or none are committed (no silent partial).
 * Returns actual created counts — never returns planned as created.
 */
export async function createAutopilotTasks(
  ctx:      AutopilotCaseContext,
  _missing: string[],
  tenantId: string | null | undefined,
  deps:     AutopilotTaskDb,
): Promise<AutopilotTaskCreateResult> {
  const tasks = planAutopilotTasks(ctx);
  const planned = tasks.length;

  if (planned === 0) {
    return classifyAutopilotInsertOutcome({
      planned: 0,
      created: 0,
      reason: "no_tasks_planned",
    });
  }

  const officeId = resolveAutopilotOfficeId(tenantId);
  if (!officeId) {
    const kind = classifyTenantId(
      tenantId == null || tenantId === "" ? null : String(tenantId),
    );
    return classifyAutopilotInsertOutcome({
      planned,
      created: 0,
      skipped: planned,
      reason: "MISSING_CANONICAL_OFFICE_UUID",
      errors: [{
        code: "MISSING_CANONICAL_OFFICE_UUID",
        message:
          `Autopilot refuses task inserts without a canonical Office UUID ` +
          `(got kind=${kind}; never uses default, platform, trial_*, or NULL)`,
      }],
    });
  }

  const c = ctx.case;
  const caseTitle = c.title ?? "القضية";
  const caseIdVal = c.id != null ? String(c.id) : null;

  try {
    await deps.transaction(async (tx) => {
      for (const t of tasks) {
        await tx.execute(sql`
          INSERT INTO tasks (office_id, case_id, title, description, status, priority, case_title, created_by, tags)
          VALUES (
            ${officeId}::uuid,
            ${caseIdVal},
            ${t.title},
            ${t.description},
            'todo',
            ${t.priority},
            ${caseTitle},
            'autopilot',
            ARRAY['autopilot', 'ai-generated']::text[]
          )
        `);
      }
    });
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    return classifyAutopilotInsertOutcome({
      planned,
      created: 0,
      failed: planned,
      officeId,
      reason: "DB_INSERT_FAILED",
      errors: [{
        code: err?.code ? String(err.code) : "DB_INSERT_FAILED",
        message: err?.message ? String(err.message) : "task insert transaction failed",
      }],
    });
  }

  return classifyAutopilotInsertOutcome({
    planned,
    created: planned,
    officeId,
  });
}

/**
 * HTTP status for Autopilot task-creation outcomes.
 * success (incl. planned=0) → 200; partial → 207; failed/skipped-with-work → 422.
 */
export function httpStatusForAutopilotTaskCreation(
  result: AutopilotTaskCreateResult,
): number {
  if (result.status === "success") return 200;
  if (result.status === "partial") return 207;
  /* failed or skipped when work was expected */
  if (result.planned > 0 && result.created === 0) return 422;
  if (result.status === "skipped" && result.planned === 0) return 200;
  return 422;
}
