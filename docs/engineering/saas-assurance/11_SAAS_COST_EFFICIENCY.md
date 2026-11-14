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

## Amplification risks ([Async backup cost lifecycle](bc-e224a8ab-4d49-57ca-8df5-870eef796b65))

| ID | Sev | Risk |
|---|---|---|
| F-COST-001 | P1 | Chat soft-deduct: under-balance still allows provider call (`aiChat` deductCredits) |
| F-COST-002 | P1 | `POST /ai-credits/deduct` trusts client `cost` (after tenant bind) |
| F-COST-003 | P1 | `ai_usage_logs` not in logRotationCron → DB growth + retention risk |
| F-COST-004 | P1 | R2 backups: `deleteBackup` never called → unbounded object cost |
| F-COST-005 | P2 | OTEL full sampling without budgets |
| F-COST-006 | P2 | Agent cron Gemini health pings = recurring provider spend |

Recommendations: hard-fail under-balance AI; server-side cost tables; enforce retention jobs; lifecycle on R2.
