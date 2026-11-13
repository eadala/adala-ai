# ARC Coolify Adapter

## Interface

`DeploymentProviderAdapter` — provider-independent.

## CoolifyAdapter Phase 1

| Capability | Enabled |
|------------|---------|
| listApplications | yes (mock) |
| readConfig / branch / deployments / health | yes (mock → UNVERIFIED) |
| executeDeploy | **false** always |

## Modes

1. **mock** (default) — synthetic app; SHA/digest UNVERIFIED  
2. **live-attempt** — if `ARC_COOLIFY_BASE_URL` + `ARC_COOLIFY_TOKEN` set, Phase 1 still refuses to invent live data (returns UNAVAILABLE note) until topology verified  

## Safety

- No SSH shell endpoint  
- No credentials in browser responses  
- Docs (`DEPLOY.md`) branch `main` shown as UNVERIFIED observation, not VERIFIED live config  
