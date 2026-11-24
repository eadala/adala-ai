# Owner / authorized session — exact Phase 031 push

Run from a machine authenticated as `adalahai` with access to the private recovery repo:

```bash
# From a clone that contains object 8685f64a… (or after fetching the clean local bundle)
git remote add backup-origin https://github.com/adalahai/adala-ai-private-recovery-2026.git
# Explicit single-refspec ONLY:
git push backup-origin 8685f64a6ddb4d983f030b8c1b7b6e1607c6dc6b:refs/heads/backup/phase-031-clean
```

Then independent restore:

```bash
git clone --branch backup/phase-031-clean https://github.com/adalahai/adala-ai-private-recovery-2026.git /tmp/adala-031-dr
cd /tmp/adala-031-dr
git rev-parse HEAD   # expect 8685f64a6ddb4d983f030b8c1b7b6e1607c6dc6b
git rev-parse HEAD^{tree}  # expect ea8b8e85510bf68787b64a5de29f079f443f0a1a
git fsck --full
```

Do **not** push contaminated lineage tips or use `--mirror` / `--force` / `--all`.
