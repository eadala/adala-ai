# ARC Architecture Decision Record

**System:** Adalah Release Control (ARC)  
**Phase:** 0 design + 1 read-only MVP  
**Date:** 2026-11-14 (Asia/Riyadh)

## Context

Adalah AI runs on Hetzner + Coolify with GitHub Actions. Production identity (SHA, digest, Auto Deploy) is frequently UNVERIFIED. Operators need a control plane that is **independent** of the customer-facing app, evidence-driven, and deny-by-default for production changes.

## Decision

Implement ARC as **isolated monorepo packages**:

| Package | Role |
|---------|------|
| `@workspace/arc-server` | Dedicated Express control-plane API |
| `@workspace/arc-console` | Operator web UI (Vite + React) |

Customer app (`artifacts/adala`, `artifacts/api-server`) is **unchanged**.

## Principles applied

1. Separation of control vs application planes  
2. Security by default — deploy execution kill-switch OFF  
3. Evidence states: VERIFIED / UNVERIFIED / … — never promote inference to VERIFIED  
4. Minimal stack — in-memory store Phase 1; no Redis/Kafka/K8s  
5. Provider adapters — `CoolifyAdapter` only; future providers via interface  

## Component map

```
arc-console → HTTP → arc-server
                        ├─ GitHubReadAdapter (read-only)
                        ├─ CoolifyAdapter (mock; live gated)
                        ├─ Release Policy Engine
                        ├─ Approval workflow (SoD)
                        ├─ Monitoring/incident fixtures + public probe evidence
                        └─ Append-only audit log (in-memory; not claiming ledger immutability)
```

## Alternatives considered

| Option | Rejected because |
|--------|------------------|
| Embed in api-server | Mixes tenant app blast radius with deploy privileges |
| Direct Coolify UI only | No unified gates/approvals/audit |
| Full microservices | Violates minimal complexity |

## Consequences

- Phase 1 runs locally without production secrets.  
- Production enablement is Phase 5 planning only.  
- Push of this branch requires separate authorization (this directive forbids push).
