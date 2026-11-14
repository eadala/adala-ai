# Performance & Capacity

## Provisional SLOs (proposed — NOT approved business SLOs)

| SLI | Provisional target | Status |
|---|---|---|
| API availability | 99.9% monthly | UNAPPROVED |
| Authenticated p95 | < 500ms exclude AI | UNAPPROVED |
| AI orchestration p95 | < 8s | UNAPPROVED |
| Error rate (5xx) | < 0.1% | UNAPPROVED |

## Load profiles

| Profile | Intent | Executed? |
|---|---|---|
| A Baseline | Low concurrency synthetic | **YES** — `evidence/perf-baseline-local.json` |
| B Expected | Representative concurrent users | NO — needs capacity assumptions + full app |
| C Peak | Burst | NO |
| D Saturation | First bottleneck | NO (pool max=10 is hypothesized bottleneck) |
| E Soak | Leak/queue growth | NO |

## Profile A measurements (isolated synthetic)

Assumptions: local Node HTTP mimicking healthz/readyz + `SELECT 1` on `adala_rls_repro`; **not** full Express/Clerk stack.

| Path | n | conc | p50 ms | p95 ms | p99 ms | errors |
|---|---|---|---|---|---|---|
| /api/healthz | 100 | 10 | 2.3 | 18.3 | 20.4 | 0 |
| /api/readyz (DB ping) | 50 | 5 | 1.5 | 34.8 | 35.1 | 0 |

Pool `options.max` observed: **10** (pg default). App pool config does not set max/idle/connectionTimeout (`lib/db/src/index.ts:14`).

## Findings

| ID | Sev | Finding |
|---|---|---|
| F-PERF-001 | P1 | No explicit pool capacity → saturation risk under modest concurrency |
| F-PERF-002 | P1 | Profiles B–E not executed against real app; capacity unknown |
| F-PERF-003 | P2 | Finance monthly charts use `Promise.all(MONTHS.map(async …))` (12 parallel queries) — `finance-center.ts`, `accounting.ts`, `admin.ts` |
| F-PERF-004 | P2 | Frontend CWV/bundle size unmeasured (no `adala/dist` build artifact in env) |

## Verification criteria for remediation

Re-run Profile A–D against full app with test auth; record pool wait count, event-loop delay, p95.
