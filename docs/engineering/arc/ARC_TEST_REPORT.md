# ARC Test Report — Phase 1

**Branch:** `cursor/arc-release-control-mvp-da81`  
**When:** 2026-11-14 ~02:27 Asia/Riyadh  

## Commands and exit codes

| Command | Exit |
|---------|------|
| `pnpm --filter @workspace/arc-server run typecheck` | **0** |
| `pnpm --filter @workspace/arc-console run typecheck` | **0** |
| `pnpm --filter @workspace/arc-server run test` | **0** (19/19 pass) |
| `pnpm --filter @workspace/arc-console run build` | **0** |
| `GET /api/arc/healthz` | HTTP 200, `deploymentExecutionEnabled:false` |
| `POST /api/arc/deployments/execute` (authed operator) | HTTP **403** `deployment_disabled` |
| `GET /api/arc/gates/rel-guc-rc` | `deploymentAllowed: false` with mandatory blockers |
| Vite console `http://127.0.0.1:5177/` | HTTP 200 |
| Vite proxy `/api/arc/overview` | HTTP 200 |

## Security tests covered

1 Unauthorized deploy request → 401  
2 Self-approval rejection  
3 Expired approval rejection  
4 Artifact SHA mismatch  
5 Image digest mismatch  
6 Missing backup evidence  
7 Failed restore evidence  
8 Stale/unverified production SHA  
9 Missing independent review  
10 Concurrent deployment requests (202, no execute)  
11–13 Deploy execute disabled (webhook/replay N/A — no mutating webhooks)  
14 Provider typed UNVERIFIED  
15 Partial deploy never starts  
16 Audit append-only  
17 Cross-role forbidden  
18 AI agent privilege escalation blocked  
19 Secret leakage prevention  
20 Deployment execution disabled by default  

## UI preview

Local console served at `http://127.0.0.1:5177` (ARC brand, overview, releases, gates, RTL toggle). Automated browser screenshot not available in this environment; build artifact under `artifacts/arc-console/dist/`.
