# Phase 009 Freeze Anchor

**Directive closed (local):** ADALA-PLATFORM-RELIABILITY-GATE-009  
**Decision:** `RELIABILITY_INTEGRATION_PASS_LOCAL`  
**Production / staging:** NO-GO  
**Push / merge / deploy at freeze:** NOT PERFORMED

## Immutable review reference

| Field | Value |
|-------|--------|
| Branch at freeze | `cursor/platform-reliability-gate-009-da81` |
| FULL_HEAD_SHA | `9e9468f78e025129deb8ef5a32c00c5ddabc9598` |
| TREE_SHA | `07abde4530d907d40094bc16bf794d82b53af524` |
| Image (local, not pushed) | `sha256:d79879d0f66a7f5069377ee812ec3ceaf68ca2ff0ed4b5d610d611e06c918319` (`adala-ai:reliability-gate-009`) |

This SHA is the **fixed candidate** for engineering review. Local PASS does **not** prove production safety.

Evidence pack: `docs/engineering/platform-reliability/integration-gate/`

## What 009 demonstrated (do not re-run unless regression suspected)

- Full Docker build (`--frozen-lockfile`)
- Container start / stop / kill-restart
- Readiness transitions (DB down → 503; liveness independent)
- Local backup storage emulator + restore-from-storage
- Existing tenant-isolation gate `GATE_PASS`

## Explicitly out of scope for 009

- Live object storage
- WAL / PITR
- Staging
- Independent security/engineering sign-off of code and raw logs
- Production activation
