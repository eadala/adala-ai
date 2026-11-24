# Production Monitoring Plan (Release Guardian)

## Existing signals

- Docker/Coolify HEALTHCHECK → `/api/healthz`
- Prometheus helpers under `artifacts/api-server/src/observability/`
- App health modules under `modules/monitoring/`

## Required alerts (configure in Coolify / external monitor)

| Signal | Threshold (initial) | Action |
|--------|---------------------|--------|
| Availability `/api/healthz` | fail ≥2 consecutive | page owner; consider rollback if LOW release |
| HTTP 5xx rate | >2% over 5m | investigate; halt promote |
| p95 latency | >2s sustained 15m | investigate |
| Auth failure spike | >3× baseline | security review |
| DB connectivity | any sustained fail | halt; no auto migration rollback |
| Payment webhook errors | rising failures | HIGH — manual |
| AI Gateway errors | >5% | degrade AI; keep core legal ops |
| Tenant isolation alerts | any | P0 — stop promote |

Avoid logging confidential legal record bodies in alert payloads.
