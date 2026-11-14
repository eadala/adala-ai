# ARC Phase 1 Architecture Review

## Verdict

Architecturally **sound for a Phase 1 read-only MVP**: separate packages, deny-by-default deploy stub, evidence-state vocabulary, provider interface with `executeDeploy: false`.

## Strengths

- Clear separation from customer plane (no shared runtime wiring found).
- Policy engine returns structured gates with `blocksDeployment`.
- Approvals validate SoD + AI exclusion in pure functions.
- Coolify adapter capability detection; refuses to fabricate live SHA.
- Listen address hardcoded loopback.

## Gaps (documented, not blockers for ACCEPT_WITH_CONDITIONS)

- Mock header auth is not production-grade identity.
- In-memory store couples availability to process lifetime.
- `deploymentAllowed` is not consulted by execute handler (execute is unconditionally 403) — safe but incomplete orchestration story for Phase 3+.
- Minimal abstraction debt acceptable; avoid premature Redis/Kafka.

## Dependency map (Phase 1)

```
arc-console --HTTP--> arc-server
                         |-- github.com (optional read)
                         |-- coolify (no live HTTP in Phase 1)
                         \-- in-memory store
```

No dependency on Adalah AI api-server process.
