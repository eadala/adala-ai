# Proposed Exact Commands (DO NOT RUN until approved)

Credentials must use credential helper / prompt — never paste tokens into shell history.

## A. Create private backup remote (human)

```bash
# On GitHub UI: create PRIVATE empty repo eadala/adala-ai-engineering-backup
git remote add backup-origin git@github.com:eadala/adala-ai-engineering-backup.git
```

## B. Push isolated backup refs only

```bash
git push backup-origin refs/backup/phase-031-8685f64a:refs/backup/phase-031-8685f64a
git push backup-origin refs/backup/master-032r-checkpoint:refs/backup/master-032r-checkpoint
# Optional UI branches (non-cursor):
git push backup-origin 8685f64a6ddb4d983f030b8c1b7b6e1607c6dc6b:refs/heads/backup/phase-031-8685f64a
git push backup-origin 9f63149069a032aec8f4e95d71a10359fe880fb8:refs/heads/backup/master-032r-checkpoint
```

## C. Do NOT (unless separately approved)

```bash
# git push origin ...          # public repo / CI / unknown Coolify
# git push --tags
# git push origin main
# gh pr create ...
```

## D. Offline bundle transfer (preferred for large blobs)

```bash
# After approval — encrypt then copy off-VM
sha256sum -c docs/engineering/forensic-git-recovery-032r/evidence/bundles/phase-031-8685f64a.bundle.sha256
sha256sum -c docs/engineering/master-program-032r-037/evidence/bundles/master-032r-checkpoint.bundle.sha256
```

## E. Disposable restore test (post-transfer)

```bash
rm -rf /tmp/adala-backup-verify.git
git init --bare /tmp/adala-backup-verify.git
git --git-dir=/tmp/adala-backup-verify.git fetch <bundle-or-remote> 'refs/backup/*:refs/backup/*'
git --git-dir=/tmp/adala-backup-verify.git rev-parse 8685f64a6ddb4d983f030b8c1b7b6e1607c6dc6b^{tree}
# expect: ea8b8e85510bf68787b64a5de29f079f443f0a1a
```
