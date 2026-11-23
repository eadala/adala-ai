# 06 — Recovery Bundle Specification

**Only after** source-side verification proves exact commit + tree.

## Preferred export (reference-based)

On verified source, create a durable ref then bundle (avoids bare-SHA portability issues):

```bash
git update-ref refs/recovery/phase-030 4d76a954944e17ae920346dd80ae484a3400d310
git bundle create /tmp/adala-phase030-recovery.bundle refs/recovery/phase-030
git bundle list-heads /tmp/adala-phase030-recovery.bundle
git bundle verify /tmp/adala-phase030-recovery.bundle
sha256sum /tmp/adala-phase030-recovery.bundle | tee /tmp/adala-phase030-recovery.bundle.sha256
ls -lh /tmp/adala-phase030-recovery.bundle
```

Requirements:

- Exported ref **must** resolve to `4d76a954…`
- Bundle must be **standalone** (no thin prerequisites missing on destination)
- Record: size, SHA-256 of **file**, source hostname, Git version
- Do **not** confuse file checksum with Git commit SHA
- Prefer omitting unrelated remotes/secrets; bundle commits only

## Destination (authorized only)

Isolated bare clone verify first — see `08_ISOLATED_IMPORT_VERIFICATION_PLAN.md`.
