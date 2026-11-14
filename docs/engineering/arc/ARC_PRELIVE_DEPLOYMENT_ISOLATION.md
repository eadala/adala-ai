# ARC Pre-Live Deployment Isolation

## Penetration results (isolated local)

Evidence: `/tmp/arc-prelive-evidence/arc-prelive-deploy-isolation.json`

Probed paths with anonymous, owner HMAC, and AI JWT + forged `X-ARC-Role`:

- `/api/arc/deployments/execute`
- `/api/arc/webhooks/deploy`
- `/api/arc/jobs/deploy`
- `/api/arc/internal/execute-deploy`

**All returned 401 or 403.** Forged role header did not elevate.

Additional:

| Probe | Result |
|---|---|
| `coolifyAdapter.capabilities().executeDeploy` | `false` |
| `coolifyAdapter.executeDeploy()` | throws `coolify_mutation_forbidden` (suite) |
| `roleHasPermission(ai_agent, deployment:request)` | `false` |
| `roleHasPermission(platform_owner, deployment:execute)` | `false` |
| `harnessDeployTriggerAvailable()` | `false` |
| `DEPLOY_EXECUTION_ENABLED` constant | `false` in routes |

HTTP 403 alone is insufficient; matrix + capability flags + missing executor implementation confirm **execution capability unreachable**.

## Verdict

**PASS** — No CRITICAL deployment-capable path discovered.
