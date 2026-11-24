/**
 * عدالة AI — Case Intelligence Engine
 * ─────────────────────────────────────
 * يُراقب القضايا والعقود والمستندات والمهام بنفس طريقة
 * مراقبة CPU وRAM — ويُعرّض نتائجه لـ Prometheus + Grafana.
 *
 * Port: 3003 (internal only)
 */

import express from "express";
import pino from "pino";
import * as client from "prom-client";
import { buildSnapshot, calcLegalRisk, buildRecommendations, calcLawyerLoad } from "./analyzer.js";
import * as m from "./metrics.js";
import type { LegalSnapshot } from "./analyzer.js";

const log  = pino({ level: "info", base: { service: "case-intelligence" } });
const app  = express();
const PORT = parseInt(process.env.PORT ?? "3003");

client.collectDefaultMetrics({ prefix: "ci_node_" });

/* ── Shared state ────────────────────────────────────────── */
let lastSnap: LegalSnapshot | null = null;
let lastRisk: { score: number; status: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" } | null = null;
let lastRecs: string[] = [];

/* ── Push metrics to Prometheus ──────────────────────────── */
function pushMetrics(snap: LegalSnapshot): void {
  const risk = calcLegalRisk(snap.cases, snap.contracts, snap.tasks);
  lastRisk   = risk;
  lastRecs   = buildRecommendations(snap.cases, snap.contracts, snap.tasks);

  /* Cases */
  m.activeCasesGauge.set(snap.cases.active);
  m.overdueCasesGauge.set(snap.cases.overdue);
  m.closedCasesGauge.set(snap.cases.closed);
  m.avgCaseDaysGauge.set(snap.cases.avgDays);
  m.officesActiveGauge.set(snap.cases.officesActive);

  /* Contracts */
  m.contractsTotalGauge.set(snap.contracts.total);
  m.contractsPendingSigGauge.set(snap.contracts.pendingSig);
  m.contractsExpiring30Gauge.set(snap.contracts.expiring30);

  /* Documents */
  m.documentsTotalGauge.set(snap.documents.total);
  m.documentsPendingGauge.set(snap.documents.pendingReview);

  /* Tasks */
  m.tasksOpenGauge.set(snap.tasks.open);
  m.tasksOverdueGauge.set(snap.tasks.overdue);
  m.tasksCompletedGauge.set(snap.tasks.completed);

  /* Risk */
  m.legalRiskScoreGauge.set(risk.score);
  m.legalRiskStatusGauge.set(
    risk.status === "CRITICAL" ? 3 :
    risk.status === "HIGH"     ? 2 :
    risk.status === "MEDIUM"   ? 1 : 0
  );
}

/* ── Collection loop (every 2 minutes) ──────────────────── */
async function collect(): Promise<void> {
  try {
    const snap = await buildSnapshot();
    lastSnap   = snap;
    pushMetrics(snap);

    const lawyerLoad = calcLawyerLoad({
      openCases:   snap.cases.active,
      openTasks:   snap.tasks.open,
      overdueCases: snap.cases.overdue,
    });

    log.info({
      risk:    { score: lastRisk?.score, status: lastRisk?.status },
      cases:   { active: snap.cases.active, overdue: snap.cases.overdue },
      tasks:   { open: snap.tasks.open, overdue: snap.tasks.overdue },
      contracts: { pending: snap.contracts.pendingSig, expiring: snap.contracts.expiring30 },
      lawyerLoad,
      recs:    lastRecs.length,
    }, "[CI] snapshot collected");

    /* Forward CRITICAL/HIGH risk to Decision Engine */
    if (lastRisk && (lastRisk.status === "CRITICAL" || lastRisk.status === "HIGH")) {
      const deUrl = process.env.DECISION_ENGINE_URL ?? "http://decision-engine:3002";
      fetch(`${deUrl}/alert`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alerts: [{
            status: "firing",
            labels: { alertname: "LegalOperationsCritical", severity: "critical" },
            annotations: {
              summary: `Legal risk score: ${lastRisk.score} (${lastRisk.status})`,
              description: lastRecs.join(" | "),
            },
          }],
        }),
        signal: AbortSignal.timeout(5_000),
      }).catch(() => {});
    }

  } catch (err: any) {
    log.warn({ err: err?.message }, "[CI] collection error");
  }
}

/* ═══════════════════════════════════════════════════════════
   REST API
═══════════════════════════════════════════════════════════ */

/* GET /status — full snapshot */
app.get("/status", (_req, res) => {
  if (!lastSnap) return void res.json({ ok: true, status: "warming_up" });

  res.json({
    ok:           true,
    ts:           lastSnap.ts,
    legalRisk:    lastRisk,
    cases:        lastSnap.cases,
    contracts:    lastSnap.contracts,
    documents:    lastSnap.documents,
    tasks:        lastSnap.tasks,
    lawyerLoad:   calcLawyerLoad({
      openCases:    lastSnap.cases.active,
      openTasks:    lastSnap.tasks.open,
      overdueCases: lastSnap.cases.overdue,
    }),
    recommendations: lastRecs,
  });
});

/* GET /legal-risk — risk score only */
app.get("/legal-risk", (_req, res) => {
  res.json({
    ok:              !!lastSnap,
    legalRisk:       lastRisk?.score  ?? 0,
    status:          lastRisk?.status ?? "UNKNOWN",
    activeCases:     lastSnap?.cases.active     ?? 0,
    overdueCases:    lastSnap?.cases.overdue    ?? 0,
    pendingContracts: lastSnap?.contracts.pendingSig ?? 0,
    recommendations: lastRecs,
  });
});

/* GET /recommendations — plain list */
app.get("/recommendations", (_req, res) => {
  res.json({ ok: true, count: lastRecs.length, items: lastRecs });
});

/* GET /metrics — Prometheus scrape */
app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

/* GET /health */
app.get("/health", (_req, res) => res.json({ ok: true }));

/* ── Boot ─────────────────────────────────────────────────── */
app.listen(PORT, async () => {
  log.info({ port: PORT }, "✅ Case Intelligence Engine started");
  await collect();                             // immediate first run
  setInterval(collect, 2 * 60 * 1000);        // then every 2 minutes
});
