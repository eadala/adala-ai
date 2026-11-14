# SaaS Unit Economics (assumptions labeled)

## Cost drivers (architecture-derived)

| Driver | Source | Type |
|---|---|---|
| AI inference / tokens | aiCredits, provider engine | Config/code |
| Object storage | R2/S3 docs | Config |
| PostgreSQL | Hetzner/Coolify | Assumption |
| Background jobs | cron CPU on API box | Observed coupling |
| Logs/traces | pino + optional OTEL/Sentry | Config |
| Backups | object + DB snapshots | Unverified |

## Proposed unit model (NOT measured production cost)

| Unit | Cost components (qualitative) |
|---|---|
| Active tenant | DB rows + storage + AI allowance + seats |
| Active user | Auth + SSE + query fan-out |
| Case | Documents + AI insights + messages |
| Stored document | R2 GB-month + egress |
| AI request / token | Provider $ + credit ledger |
| Subscription month | Plan entitlements vs usage |

## Amplification risks

| ID | Sev | Risk |
|---|---|---|
| F-COST-001 | P1 | Unbounded AI context / agent loops without hard per-tenant circuit |
| F-COST-002 | P1 | Log/trace volume if OTEL full sampling enabled without budgets |
| F-COST-003 | P2 | Backup object retention without lifecycle policy → storage creep |

Recommendations: quotas (partially present via credits/entitlements), budget alerts, model routing, storage lifecycle — implement only after metering baselines.
