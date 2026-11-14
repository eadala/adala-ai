import type { EvidenceState, IncidentRecord, MonitoringObservation } from "./types.js";

export type CheckResult = "healthy" | "degraded" | "failed" | "unknown" | "stale";

export type MonitoringCheck = {
  checkId: string;
  target: string;
  environment: string;
  result: CheckResult;
  severity: "info" | "warning" | "critical";
  source: string;
  observationTimestamp: string;
  freshnessThresholdMs: number;
  errorClassification: string | null;
  detail?: string;
};

export function classifyObservation(
  obs: MonitoringObservation,
  freshnessThresholdMs = 15 * 60 * 1000,
  now = Date.now(),
): MonitoringCheck {
  const age = now - Date.parse(obs.observedAt);
  let result: CheckResult = "unknown";
  if (obs.state === "VERIFIED" && obs.value) {
    const v = obs.value.toLowerCase();
    if (v.includes("fail") || v.includes("down") || v.includes("error")) result = "failed";
    else if (v.includes("degrad") || v.includes("elevated")) result = "degraded";
    else result = "healthy";
  } else if (obs.state === "FAILED") result = "failed";
  else if (obs.state === "DEGRADED") result = "degraded";
  else if (obs.state === "STALE") result = "stale";
  else if (obs.state === "UNAVAILABLE") result = "failed";
  else result = "unknown";

  if (Number.isFinite(age) && age > freshnessThresholdMs && result !== "failed") {
    result = "stale";
  }

  return {
    checkId: obs.id,
    target: obs.metric,
    environment: "observed",
    result,
    severity: result === "failed" ? "critical" : result === "degraded" || result === "stale" ? "warning" : "info",
    source: obs.source,
    observationTimestamp: obs.observedAt,
    freshnessThresholdMs,
    errorClassification: result === "unknown" || result === "stale" ? result : null,
    detail: obs.value ?? undefined,
  };
}

/** Timeouts must never become healthy */
export function resultFromProbe(opts: {
  timedOut: boolean;
  httpStatus?: number;
  okBody?: boolean;
}): CheckResult {
  if (opts.timedOut) return "unknown";
  if (opts.httpStatus == null) return "unknown";
  if (opts.httpStatus >= 500) return "failed";
  if (opts.httpStatus >= 400) return "degraded";
  if (opts.okBody === false) return "degraded";
  return "healthy";
}

export function correlateIncident(
  checks: MonitoringCheck[],
  cooldownMs = 5 * 60 * 1000,
  existing: IncidentRecord[] = [],
  now = Date.now(),
): IncidentRecord | null {
  const bad = checks.filter((c) => c.result === "failed" || c.result === "degraded");
  if (!bad.length) return null;
  const component = bad[0]!.target;
  const recent = existing.find(
    (i) =>
      i.component === component &&
      i.status !== "resolved" &&
      now - Date.parse(i.detectedAt) < cooldownMs,
  );
  if (recent) return null; /* dedupe / cooldown */
  return {
    id: `inc-${Date.now().toString(36)}`,
    severity: bad.some((b) => b.result === "failed") ? "P1" : "P2",
    detectedAt: new Date(now).toISOString(),
    component,
    evidence: bad.map((b) => `${b.checkId}:${b.result}`).join(","),
    status: "open",
    assignedOperator: null,
    resolutionTime: null,
    notes: "auto-correlated from monitoring foundation (no auto-remediation)",
  };
}

export type EvidenceStateAlias = EvidenceState;
