/**
 * Autopilot Listener — تنشيط الطيار الآلي عند إنشاء القضايا
 *
 * يستمع لـ CASE_CREATED → يشغّل التحليل الآلي بعد 3 ثواني
 * (تأخير بسيط لضمان اكتمال الحفظ قبل القراءة)
 */

import { eventBus }            from "../eventBus";
import type { StoredEvent }    from "../eventBus";
import { runCaseAutopilot, ensureAutopilotTable } from "../../agents/caseAutopilot";

let tableReady = false;

export function registerAutopilotListeners(): void {

  /* تهيئة الجدول مرة واحدة */
  ensureAutopilotTable().then(() => { tableReady = true; }).catch(() => {});

  /* CASE_CREATED → Autopilot بعد 3 ثوانٍ */
  eventBus.on("CASE_CREATED", async (event: StoredEvent) => {
    const { caseId } = event.data ?? {};
    const officeId  = event.officeId ?? "default";
    if (!caseId) return;

    /* نُشغّل بشكل غير متزامن حتى لا نُبطئ الاستجابة */
    setTimeout(async () => {
      try {
        if (!tableReady) await ensureAutopilotTable();
        const report = await runCaseAutopilot(caseId, officeId, true);
        if (report) {
          console.log(
            `[Autopilot] 🧠 Case "${caseId}" — Score ${report.healthScore}/100 (${report.grade}) — ${report.tasksCreated} tasks created`
          );
        }
      } catch (e: any) {
        console.error("[Autopilot] Error:", e.message);
      }
    }, 3000);
  });

  /* CASE_UPDATED → إعادة التحليل (لا إنشاء مهام مكررة) */
  eventBus.on("CASE_UPDATED", async (event: StoredEvent) => {
    const { caseId } = event.data ?? {};
    const officeId  = event.officeId ?? "default";
    if (!caseId) return;

    setTimeout(async () => {
      try {
        await runCaseAutopilot(caseId, officeId, false); /* createTasks=false */
      } catch { /* non-critical */ }
    }, 2000);
  });

  console.log("[Autopilot] ✅ Listener registered");
}
