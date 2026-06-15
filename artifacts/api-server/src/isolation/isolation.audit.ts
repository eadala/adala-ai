/**
 * Isolation Audit — Static Code Scanner
 * ─────────────────────────────────────
 * يفحص ملفات الـ routes ويكتشف:
 *   1. SQL queries بدون office_id / tenant_id
 *   2. db.execute بدون WHERE clause
 *   3. Raw queries خطيرة
 *
 * لا يُعدّل الكود — يُقرّر فقط.
 */

import { readdir, readFile } from "fs/promises";
import { join } from "path";

export interface AuditFinding {
  file: string;
  line: number;
  code: string;
  risk: "high" | "medium" | "low";
  reason: string;
}

export interface AuditResult {
  file:     string;
  score:    number;            // 0 (unsafe) → 100 (safe)
  findings: AuditFinding[];
  linesChecked: number;
}

/* ─── Risk Patterns ─── */
const HIGH_RISK_PATTERNS = [
  { re: /FROM\s+(cases|clients|contracts|documents|revenues|expenses|employees|payroll|tasks|reminders|client_invoices)\b(?!.*\boffice_id\b)/i,
    reason: "تعداد جدول حرج بدون فلتر office_id" },
  { re: /SELECT\s+\*\s+FROM\b/i,
    reason: "SELECT * بدون فلتر — خطر تسرب شامل" },
];

const MEDIUM_RISK_PATTERNS = [
  { re: /db\.execute\(sql`[^`]*FROM\s+\w+[^`]*`\)/,
    reason: "db.execute بدون WHERE مرئي في نفس السطر" },
  { re: /ORDER BY\s+created_at\s+DESC\s+LIMIT\s+\d+(?!.*office_id)/i,
    reason: "استعلام مرتب بدون فلتر tenant" },
];

const LOW_RISK_PATTERNS = [
  { re: /JOIN\s+\w+\s+ON/i,
    reason: "JOIN — تحقق من أن العزل يمتد للجدول المُضاف" },
];

/* ─── Scan a single file ─── */
async function scanFile(filePath: string): Promise<AuditResult> {
  const content = await readFile(filePath, "utf8");
  const lines   = content.split("\n");
  const findings: AuditFinding[] = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
    if (trimmed.includes("office_id") || trimmed.includes("tenantId") || trimmed.includes("tenant_id")) return;

    for (const p of HIGH_RISK_PATTERNS) {
      if (p.re.test(line)) {
        findings.push({ file: filePath, line: idx + 1, code: trimmed.slice(0, 120), risk: "high", reason: p.reason });
      }
    }
    for (const p of MEDIUM_RISK_PATTERNS) {
      if (p.re.test(line)) {
        findings.push({ file: filePath, line: idx + 1, code: trimmed.slice(0, 120), risk: "medium", reason: p.reason });
      }
    }
    for (const p of LOW_RISK_PATTERNS) {
      if (p.re.test(line)) {
        findings.push({ file: filePath, line: idx + 1, code: trimmed.slice(0, 120), risk: "low", reason: p.reason });
      }
    }
  });

  const highCount   = findings.filter(f => f.risk === "high").length;
  const medCount    = findings.filter(f => f.risk === "medium").length;
  const penalty     = highCount * 15 + medCount * 5;
  const score       = Math.max(0, 100 - penalty);

  return { file: filePath.split("/routes/")[1] ?? filePath, score, findings, linesChecked: lines.length };
}

/* ─── Scan all routes ─── */
export async function runIsolationAudit(routesDir?: string): Promise<{
  results: AuditResult[];
  summary: {
    totalFiles:    number;
    safeFiles:     number;
    riskFiles:     number;
    highRiskTotal: number;
    medRiskTotal:  number;
    avgScore:      number;
    overallScore:  number;
  };
}> {
  const dir = routesDir ?? join(process.cwd(), "src/routes");
  let files: string[] = [];
  try {
    const entries = await readdir(dir);
    files = entries.filter(f => f.endsWith(".ts")).map(f => join(dir, f));
  } catch {
    return { results: [], summary: { totalFiles: 0, safeFiles: 0, riskFiles: 0, highRiskTotal: 0, medRiskTotal: 0, avgScore: 100, overallScore: 100 } };
  }

  const results = await Promise.all(files.map(scanFile));
  const highRiskTotal = results.reduce((s, r) => s + r.findings.filter(f => f.risk === "high").length, 0);
  const medRiskTotal  = results.reduce((s, r) => s + r.findings.filter(f => f.risk === "medium").length, 0);
  const avgScore      = results.length ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length) : 100;

  /* حساب الدرجة الإجمالية */
  const overallScore = Math.max(0, avgScore - highRiskTotal * 2);

  return {
    results: results.sort((a, b) => a.score - b.score),   /* الأخطر أولاً */
    summary: {
      totalFiles:    results.length,
      safeFiles:     results.filter(r => r.score >= 80).length,
      riskFiles:     results.filter(r => r.score < 80).length,
      highRiskTotal,
      medRiskTotal,
      avgScore,
      overallScore,
    },
  };
}
