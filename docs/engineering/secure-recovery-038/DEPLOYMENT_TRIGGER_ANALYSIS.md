# 06 — Deployment Trigger Analysis

Sole workflow: `.github/workflows/ci.yml`

| Trigger | Matches | Deploy effect |
|---------|---------|---------------|
| push | main, develop, feature/**, hotfix/**, release/**, cursor/** | CI only (VERIFIED) |
| pull_request | base main/develop | CI only |
| workflow_dispatch | manual | CI only |
| tags | not configured | none observed |
| docker-production job | builds Dockerfile on runner | **not** a registry/Coolify deploy (VERIFIED text) |

**COOLIFY_AUTODEPLOY_STATUS:** UNKNOWN  
**DEPLOYMENT_TRIGGER_RISK:** MEDIUM — CI safe for non-`cursor/**` backup branches; Coolify external hooks unverified → do not assume push safety to any remote wired to Coolify.
