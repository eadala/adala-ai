import { query, queryOne } from "./db.js";

/* ── Types ─────────────────────────────────────────────── */
export interface CaseStats {
  active:      number;
  overdue:     number;
  closed:      number;
  total:       number;
  avgDays:     number;
  officesActive: number;
}

export interface ContractStats {
  total:          number;
  pendingSig:     number;
  expiring30:     number;
}

export interface DocumentStats {
  total:          number;
  pendingReview:  number;
}

export interface TaskStats {
  open:       number;
  overdue:    number;
  completed:  number;
}

export interface LegalSnapshot {
  cases:     CaseStats;
  contracts: ContractStats;
  documents: DocumentStats;
  tasks:     TaskStats;
  ts:        string;
}

/* ── Cases ─────────────────────────────────────────────── */
export async function analyzeCases(): Promise<CaseStats> {
  const [counts, avg, officesActive] = await Promise.all([
    queryOne<{ active: string; overdue: string; closed: string; total: string }>(`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('open','in_progress'))                  AS active,
        COUNT(*) FILTER (WHERE deadline < NOW() AND status NOT IN ('closed'))     AS overdue,
        COUNT(*) FILTER (WHERE status = 'closed')                                 AS closed,
        COUNT(*)                                                                   AS total
      FROM cases
    `),
    queryOne<{ avg_days: string }>(`
      SELECT ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400))::int AS avg_days
      FROM cases
      WHERE status = 'closed'
        AND updated_at >= NOW() - INTERVAL '90 days'
    `),
    queryOne<{ cnt: string }>(`
      SELECT COUNT(DISTINCT office_id)::int AS cnt
      FROM cases WHERE status IN ('open','in_progress')
    `),
  ]);

  return {
    active:        parseInt(counts?.active  ?? "0"),
    overdue:       parseInt(counts?.overdue ?? "0"),
    closed:        parseInt(counts?.closed  ?? "0"),
    total:         parseInt(counts?.total   ?? "0"),
    avgDays:       parseInt(avg?.avg_days   ?? "0"),
    officesActive: parseInt(officesActive?.cnt ?? "0"),
  };
}

/* ── Contracts ─────────────────────────────────────────── */
export async function analyzeContracts(): Promise<ContractStats> {
  const [counts, pendSig, expiring] = await Promise.all([
    queryOne<{ total: string }>(`SELECT COUNT(*)::int AS total FROM contracts`),
    queryOne<{ cnt: string }>(`
      SELECT COUNT(*)::int AS cnt
      FROM document_signatures ds
      JOIN contracts c ON c.id::text = ds.document_id
      WHERE ds.status = 'pending'
    `),
    queryOne<{ cnt: string }>(`
      SELECT COUNT(*)::int AS cnt
      FROM contracts
      WHERE expires_at BETWEEN NOW() AND NOW() + INTERVAL '30 days'
        AND status != 'expired'
    `),
  ]);

  return {
    total:      parseInt(counts?.total ?? "0"),
    pendingSig: parseInt(pendSig?.cnt  ?? "0"),
    expiring30: parseInt(expiring?.cnt ?? "0"),
  };
}

/* ── Documents ─────────────────────────────────────────── */
export async function analyzeDocuments(): Promise<DocumentStats> {
  const counts = await queryOne<{ total: string; pending: string }>(`
    SELECT
      COUNT(*)                                              AS total,
      COUNT(*) FILTER (WHERE status = 'pending_review')    AS pending
    FROM documents
  `);

  return {
    total:         parseInt(counts?.total   ?? "0"),
    pendingReview: parseInt(counts?.pending ?? "0"),
  };
}

/* ── Tasks ─────────────────────────────────────────────── */
export async function analyzeTasks(): Promise<TaskStats> {
  const counts = await queryOne<{ open: string; overdue: string; done: string }>(`
    SELECT
      COUNT(*) FILTER (WHERE status NOT IN ('completed','done','closed'))               AS open,
      COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('completed','done','closed')) AS overdue,
      COUNT(*) FILTER (WHERE status IN ('completed','done'))                            AS done
    FROM tasks
  `);

  return {
    open:      parseInt(counts?.open    ?? "0"),
    overdue:   parseInt(counts?.overdue ?? "0"),
    completed: parseInt(counts?.done    ?? "0"),
  };
}

/* ── Lawyer workload score (per office aggregate) ────── */
export function calcLawyerLoad({
  openCases, openTasks, overdueCases,
}: { openCases: number; openTasks: number; overdueCases: number }): number {
  return Math.min(100, Math.round(openCases * 0.5 + openTasks * 0.3 + overdueCases * 0.2));
}

/* ── Legal risk score ───────────────────────────────── */
export function calcLegalRisk(
  cases: CaseStats, contracts: ContractStats, tasks: TaskStats
): { score: number; status: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" } {
  let score = 0;
  score += cases.overdue        * 5;
  score += tasks.overdue        * 2;
  score += contracts.pendingSig * 1;
  score += contracts.expiring30 * 0.5;
  const capped = Math.min(100, Math.round(score));
  const status =
    capped >= 70 ? "CRITICAL" :
    capped >= 45 ? "HIGH" :
    capped >= 20 ? "MEDIUM" :
    "LOW";
  return { score: capped, status };
}

/* ── Recommendations ────────────────────────────────── */
export function buildRecommendations(
  cases: CaseStats, contracts: ContractStats, tasks: TaskStats
): string[] {
  const recs: string[] = [];
  if (cases.overdue > 10)        recs.push("تجاوزت 10 قضايا موعدها — يُنصح بإعادة توزيع الأحمال");
  if (cases.overdue > 0 && cases.overdue <= 10) recs.push(`${cases.overdue} قضايا متأخرة — تحقق من المواعيد النهائية`);
  if (contracts.pendingSig > 20) recs.push("أكثر من 20 عقداً بانتظار التوقيع — فعّل سير عمل المراجعة");
  if (contracts.expiring30 > 5)  recs.push(`${contracts.expiring30} عقوداً تنتهي خلال 30 يوماً — تحقق من التجديد`);
  if (tasks.overdue > 15)        recs.push("تراكم المهام المتأخرة — راجع توزيع المهام على الفريق");
  if (cases.avgDays > 180)       recs.push("متوسط إغلاق القضايا > 180 يوماً — ادرس تحسين سير العمل");
  return recs;
}

/* ── Full snapshot ──────────────────────────────────── */
export async function buildSnapshot(): Promise<LegalSnapshot> {
  const [cases, contracts, documents, tasks] = await Promise.all([
    analyzeCases(),
    analyzeContracts(),
    analyzeDocuments(),
    analyzeTasks(),
  ]);
  return { cases, contracts, documents, tasks, ts: new Date().toISOString() };
}
