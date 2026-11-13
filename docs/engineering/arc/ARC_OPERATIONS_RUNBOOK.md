# ARC Operations Runbook (Local Phase 1)

## Start

```bash
# from repo root after pnpm install
pnpm --filter @workspace/arc-server start
# other terminal
pnpm --filter @workspace/arc-console dev
```

- API: http://127.0.0.1:8787/api/arc/healthz  
- UI: http://127.0.0.1:5177  

## Auth headers (local)

```
X-ARC-Token: arc-local-dev-token
X-ARC-Operator: reviewer
X-ARC-Role: independent_reviewer
```

## Verify deploy disabled

```bash
curl -sS -X POST http://127.0.0.1:8787/api/arc/deployments/execute \
  -H 'content-type: application/json' \
  -H 'x-arc-token: arc-local-dev-token' \
  -H 'x-arc-operator: operator' \
  -H 'x-arc-role: production_operator' \
  -d '{"releaseId":"rel-guc-rc"}'
# expect 403 deployment_disabled
```

## Stop conditions

If any process binds beyond localhost or requests production credentials — stop and escalate.
