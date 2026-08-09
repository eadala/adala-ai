/**
 * Autopilot Listener — تنشيط الطيار الآلي عند إنشاء القضايا
 *
 * يستمع لـ CASE_CREATED → يشغّل التحليل الآلي بعد 3 ثواني
 * (تأخير بسيط لضمان اكتمال الحفظ قبل القراءة)
 *
 * Stage 15.2d — never log success when planned tasks were skipped/failed;
 * never fall back to default/platform/trial_* office ids.
 * Stage 19 — schema via migration 028; no Runtime DDL for this table.
 */

import { eventBus }            from "../eventBus";
import type { StoredEvent }    from "../eventBus";
import {
  runCaseAutopilot,
  resolveAutopilotOfficeId,
  type AutopilotTaskCreateResult,
} from "../../agents/caseAutopilot";

function logAutopilotOutcome(fields: {
  tenantId: string | null;
  officeId: string | null;
  caseId: string;
  taskCreation: AutopilotTaskCreateResult;
  healthScore?: number;
  grade?: string;
}): void {
  const { tenantId, officeId, caseId, taskCreation: tc, healthScore, grade } = fields;
  const payload = {
    tenantId,
    officeId,
    caseId,
    planned: tc.planned,
    created: tc.created,
    failed: tc.failed,
    skipped: tc.skipped,
    status: tc.status,
    reason: tc.reason ?? null,
    healthScore: healthScore ?? null,
    grade: grade ?? null,
  };

  if (tc.status === "success") {
    console.log("[Autopilot] success", payload);
    return;
  }

  /* Do not log success when planned work was skipped or failed */
  console.warn("[Autopilot] task_creation_not_success", payload);
}

export function registerAutopilotListeners(): void {

  /* CASE_CREATED → Autopilot بعد 3 ثوانٍ */
  eventBus.on("CASE_CREATED", async (event: StoredEvent) => {
    const { caseId } = event.data ?? {};
    const rawOffice = event.officeId ?? null;
    if (!caseId) return;

    /* نُشغّل بشكل غير متزامن حتى لا نُبطئ الاستجابة / لا نفسد مسار الحدث */
    setTimeout(async () => {
      try {
        const officeId = resolveAutopilotOfficeId(rawOffice);
        if (!officeId) {
          logAutopilotOutcome({
            tenantId: rawOffice,
            officeId: null,
            caseId: String(caseId),
            taskCreation: {
              status: "skipped",
              planned: 0,
              created: 0,
              failed: 0,
              skipped: 0,
              reason: "MISSING_CANONICAL_OFFICE_UUID",
              errors: [{
                code: "MISSING_CANONICAL_OFFICE_UUID",
                message: "Listener refused Autopilot run without canonical Office UUID",
              }],
            },
          });
          return;
        }

        const report = await runCaseAutopilot(String(caseId), officeId, true);
        if (!report) {
          console.warn("[Autopilot] case_not_found", {
            tenantId: officeId,
            officeId,
            caseId: String(caseId),
            status: "failed",
            reason: "case_not_found",
          });
          return;
        }

        logAutopilotOutcome({
          tenantId: officeId,
          officeId,
          caseId: String(caseId),
          taskCreation: report.taskCreation,
          healthScore: report.healthScore,
          grade: report.grade,
        });
      } catch (e: unknown) {
        /* Listener failure must not corrupt originating event flow */
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[Autopilot] Error:", msg, {
          tenantId: rawOffice,
          officeId: resolveAutopilotOfficeId(rawOffice),
          caseId: String(caseId),
          status: "failed",
          reason: "listener_exception",
        });
      }
    }, 3000);
  });

  /* CASE_UPDATED → إعادة التحليل (لا إنشاء مهام مكررة) */
  eventBus.on("CASE_UPDATED", async (event: StoredEvent) => {
    const { caseId } = event.data ?? {};
    const rawOffice = event.officeId ?? null;
    if (!caseId) return;

    setTimeout(async () => {
      try {
        const officeId = resolveAutopilotOfficeId(rawOffice);
        if (!officeId) {
          console.warn("[Autopilot] skip_update_analysis", {
            tenantId: rawOffice,
            officeId: null,
            caseId: String(caseId),
            planned: 0,
            created: 0,
            failed: 0,
            skipped: 0,
            status: "skipped",
            reason: "MISSING_CANONICAL_OFFICE_UUID",
          });
          return;
        }
        await runCaseAutopilot(String(caseId), officeId, false); /* createTasks=false */
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[Autopilot] update_analysis_error:", msg);
      }
    }, 2000);
  });

  console.log("[Autopilot] ✅ Listener registered");
}
