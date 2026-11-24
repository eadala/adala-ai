# 06 — Recovery Authorization Request

**STATUS:** AWAITING EXPLICIT AUTHORIZATION  
**This directive does NOT grant Gate B.**

## Proposal

| Field | Value |
|-------|-------|
| SOURCE_REPOSITORY | Original LOCAL-ONLY Cursor environment / any host holding commit `4d76a954944e17ae920346dd80ae484a3400d310` |
| SOURCE_LOCATION | TBD by custodian (prior agent VM, operator laptop, backup disk) |
| SOURCE_OWNER_OR_CUSTODIAN | Adala AI engineering owner / Cursor run that closed Phase 030 |
| SOURCE_VERIFICATION_EVIDENCE | On source host: `git cat-file -t 4d76a954…` → `commit`; `git rev-parse 4d76a954^{tree}` → `d568bf7f…` |
| PROPOSED_TRANSFER_METHOD | **Preferred:** `git bundle create phase-030-lineage.bundle <030-tip> --branches` (or ancestry-complete bundle including 018–030) then copy bundle into this environment for isolated verify |
| Alternate method | Authorized `git fetch` of never-pushed branches **only if** they exist on a trusted remote the custodian creates for recovery |
| EXPECTED_OBJECT_SCOPE | Exact `4d76a954…` + full ancestry through documented 018–029 tips + all trees/blobs required for connectivity |
| DESTINATION_REPOSITORY | Disposable verify clone first; then primary `/agent/repos/adala-ai` only after SHA/tree match |
| EXPECTED_DATA_VOLUME | Unknown until source `count-objects`; Phase 031 preservation bundle alone ≈40MB |
| SECURITY_RISKS | Accidental inclusion of `.env`/secrets in working-tree copy; prefer **bundle of commits only** |
| ROLLBACK_AND_PRESERVATION_PLAN | Phase 031 already preserved via `refs/backup/phase-031-8685f64a` + verified bundle; no force-push; no GC |
| EXACT_COMMANDS_PROPOSED (source) | See below |
| EXACT_COMMANDS_PROPOSED (destination, after approval) | See below |

### Proposed source commands (custodian)

```bash
git cat-file -t 4d76a954944e17ae920346dd80ae484a3400d310
git rev-parse 4d76a954944e17ae920346dd80ae484a3400d310^{tree}  # must be d568bf7f…
git bundle create /tmp/adala-018-030.bundle 4d76a954944e17ae920346dd80ae484a3400d310
# or include named LOCAL-ONLY branches if present
```

### Proposed destination commands (**AFTER APPROVAL ONLY**)

```bash
git clone --bare /agent/repos/adala-ai /tmp/adala-verify-bare
cd /tmp/adala-verify-bare
git bundle verify /path/to/adala-018-030.bundle
git fetch /path/to/adala-018-030.bundle 'refs/*:refs/recovery/*'
git rev-parse 4d76a954944e17ae920346dd80ae484a3400d310^{tree}
# only if exact match, then import into primary under refs/recovery/* without moving existing branches
```

**STOP_EXECUTION_AND_REQUEST_EXPLICIT_AUTHORIZATION**
