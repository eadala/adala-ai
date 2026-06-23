import * as client from "prom-client";

/* ── Cases ──────────────────────────────────────────────── */
export const activeCasesGauge = new client.Gauge({
  name: "ci_active_cases_total",
  help: "Active legal cases across all offices",
});
export const overdueCasesGauge = new client.Gauge({
  name: "ci_overdue_cases_total",
  help: "Cases past their deadline and not closed",
});
export const closedCasesGauge = new client.Gauge({
  name: "ci_closed_cases_total",
  help: "Closed cases (all time)",
});
export const avgCaseDaysGauge = new client.Gauge({
  name: "ci_avg_case_completion_days",
  help: "Average days from open to close (last 90 days)",
});

/* ── Contracts ──────────────────────────────────────────── */
export const contractsTotalGauge = new client.Gauge({
  name: "ci_contracts_total",
  help: "Total contracts",
});
export const contractsPendingSigGauge = new client.Gauge({
  name: "ci_contracts_pending_signature",
  help: "Contracts awaiting signature",
});
export const contractsExpiring30Gauge = new client.Gauge({
  name: "ci_contracts_expiring_30d",
  help: "Contracts expiring in the next 30 days",
});

/* ── Documents ──────────────────────────────────────────── */
export const documentsTotalGauge = new client.Gauge({
  name: "ci_documents_total",
  help: "Total documents uploaded",
});
export const documentsPendingGauge = new client.Gauge({
  name: "ci_documents_pending_review",
  help: "Documents pending review",
});

/* ── Tasks ──────────────────────────────────────────────── */
export const tasksOpenGauge = new client.Gauge({
  name: "ci_tasks_open",
  help: "Open tasks",
});
export const tasksOverdueGauge = new client.Gauge({
  name: "ci_tasks_overdue",
  help: "Tasks past their due date",
});
export const tasksCompletedGauge = new client.Gauge({
  name: "ci_tasks_completed_total",
  help: "Completed tasks (all time)",
});

/* ── Risk + Workload ─────────────────────────────────────── */
export const legalRiskScoreGauge = new client.Gauge({
  name: "ci_legal_risk_score",
  help: "Legal operations risk score (0–100)",
});
export const legalRiskStatusGauge = new client.Gauge({
  name: "ci_legal_risk_status",
  help: "Risk level: 0=LOW, 1=MEDIUM, 2=HIGH, 3=CRITICAL",
});
export const officesActiveGauge = new client.Gauge({
  name: "ci_offices_active",
  help: "Offices with at least one active case",
});
