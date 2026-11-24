import { retryWithBackoff, sleep } from "./retry.engine";

export type WorkflowType = "payment" | "webhook" | "ai_task" | "invoice" | "email";

export interface WorkflowRecord {
  id: string;
  type: WorkflowType;
  failedStep: string;
  payload: unknown;
  retries: number;
}

const pendingRecoveries = new Map<string, WorkflowRecord>();

export function registerFailedWorkflow(record: WorkflowRecord) {
  pendingRecoveries.set(record.id, record);
}

export async function recoverWorkflow(id: string): Promise<{ ok: boolean; detail: string }> {
  const rec = pendingRecoveries.get(id);
  if (!rec) return { ok: false, detail: "Workflow not found in recovery queue" };

  try {
    await retryWithBackoff(
      () => replayStep(rec.type, rec.failedStep, rec.payload),
      { retries: 3, label: `recover:${rec.type}:${rec.failedStep}` }
    );
    pendingRecoveries.delete(id);
    return { ok: true, detail: `Recovered ${rec.type} workflow at step ${rec.failedStep}` };
  } catch (e: any) {
    return { ok: false, detail: e.message };
  }
}

async function replayStep(type: WorkflowType, step: string, _payload: unknown): Promise<void> {
  console.log(`[WorkflowRecovery] Replaying ${type}.${step}`);
  await sleep(50);
}

export function getPendingRecoveries() {
  return Array.from(pendingRecoveries.values());
}
