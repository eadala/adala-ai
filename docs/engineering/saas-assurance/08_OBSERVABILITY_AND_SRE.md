# Observability & SRE

## Present capabilities (code)

| Capability | Location | Runtime in this env |
|---|---|---|
| Structured logs (pino) | `lib/logger`, pino-http in `app.ts` | Assumed when server runs |
| Request/correlation IDs | `middlewares/requestId.ts` | Code review PASS |
| OTEL traces | `observability/tracer.ts` — gated on `OTEL_EXPORTER_OTLP_ENDPOINT` | **Not active here** (endpoint unset) |
| Prometheus middleware | `observability/prometheus` | Code present |
| Sentry | `app.ts` if `SENTRY_DSN` | Env-gated |
| Health score / metrics | `observability/healthcheck.ts`, `metrics.ts` | Used by monitoring cron |
| Liveness `/api/healthz` | `app.ts:52` | Always OK — no DB |
| Deep health | monitoring routes + systemHealthCheck | Not tied to Coolify HEALTHCHECK |

## Gaps

| ID | Sev | Gap | Consequence |
|---|---|---|---|
| F-OBS-001 | P0 | No readiness distinct from liveness | Broken-DB instances stay in pool |
| F-OBS-002 | P1 | OTEL/Sentry optional; no evidence of prod exporter config in repo secrets map | Blind spots |
| F-OBS-003 | P1 | Queue depth / pool wait / event-loop delay SLIs incomplete | Saturation invisible |
| F-OBS-004 | P2 | Alert noise vs actionability of smart.alerts unverified | Fatigue risk |

## Candidate SLIs

Availability, latency p95, 5xx rate, cron completion ratio, AI provider error rate, payment webhook success, backup job success, restore drill freshness.
