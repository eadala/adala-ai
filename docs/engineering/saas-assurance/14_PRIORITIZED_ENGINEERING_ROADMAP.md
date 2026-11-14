# Prioritized Engineering Roadmap

## Phase 0 — Stop-ship ops (before any GO discussion)

1. Isolated PostgreSQL restore drill + evidence (F-DR-001)
2. Replace/disable stats-only “full backup” and fake `simulateRestoreTest` (F-DR-002/003)
3. Readiness probe + orchestrator wiring (F-REL-003)
4. Explicit pool sizing + timeouts + saturation metrics (F-PERF-001)

## Phase 1 — Reliability foundation

1. Distributed cron locks or worker split (F-ASYNC-001, F-ARCH-001)
2. Retry jitter + idempotency policy (F-REL-001)
3. Provider circuit breakers (F-REL-002)
4. Enable bounded OTEL/Sentry with runbooks (F-OBS-002)
5. Full-app Profile B/C load on non-prod (F-PERF-002)

## Phase 2 — Efficiency & lifecycle

1. Dashboard query consolidation (F-DBPERF-002)
2. CI: DR checklist + optional security gate (F-RELENG-*)
3. Tenant offboarding + legal hold state machine (F-LIFE-*)
4. AI hard quotas / budget alerts (F-COST-001)
5. Frontend CWV measurement (F-FE-001)

## Phase 3 — Optional optimization

Modular packaging, caching where safe, storage lifecycle, WCAG formal audit.

## Ordering principle

Measure → restore proof → readiness → capacity → then features.
