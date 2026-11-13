# ARC Monitoring Design

## Phase 1 sources

- Seeded observations from prior public probes (apex health, www 503, payments outage)  
- Production SHA metric forced **UNVERIFIED**  
- Infra CPU/memory **UNAVAILABLE** without Coolify metrics  

## Future

- Configurable thresholds, dedup/cooldown  
- Alert routing via existing notification infra  
- No auto-remediation / auto-deploy  

## Incident model

id, severity P0–P3, detection time, component, evidence, status, assignee, resolution, notes.
