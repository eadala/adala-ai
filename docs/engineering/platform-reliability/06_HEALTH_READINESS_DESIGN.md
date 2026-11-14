# Health / Readiness / Startup Design

## Endpoints

| Path | Meaning | Dependencies |
|------|---------|--------------|
| `/api/healthz` | Liveness | Process only |
| `/api/startupz` | Startup gate | Initialization flag |
| `/api/readyz` | Readiness | DB connectivity, config presence, startup complete, not shutting down |

Optional AI providers are explicitly excluded from readiness (`optional_providers.excluded_from_readiness`).

## Implementation

- `artifacts/api-server/src/reliability/probes/readiness.ts`
- Wired in `app.ts`; `markStartupComplete` / `markShuttingDown` in `index.ts`
- No credentials or infrastructure details in probe JSON

## Verification

Harness: LIVENESS, STARTUP_BEFORE/AFTER, READINESS_OK, READINESS_SHUTDOWN, HEALTHZ_HTTP.
