# 08 — Isolated Import Verification Plan

**Execute only after transfer authorization.**

1. Place bundle + checksum outside primary repo (e.g. `/tmp/recovery/`).
2. `sha256sum -c adala-phase030-recovery.bundle.sha256`
3. `git bundle list-heads` / `git bundle verify`
4. `git clone --bare /agent/repos/adala-ai /tmp/adala-verify-bare`
5. `cd /tmp/adala-verify-bare && git fetch /tmp/recovery/adala-phase030-recovery.bundle 'refs/*:refs/recovery/*'`
6. Assert:
   - `git rev-parse 4d76a954…^{commit}` succeeds
   - `git rev-parse 4d76a954…^{tree}` == `d568bf7f…`
7. `git fsck --full --connectivity-only` (or equivalent) on recovered tip
8. Inventory migrations under recovered tree
9. Record evidence; **do not** move `main` / 031 / 032 branches

**ISOLATED_VERIFICATION:** NOT_PERFORMED (no transfer)
