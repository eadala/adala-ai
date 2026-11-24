# 05 — Source-Side Verification Commands

Run **on the candidate host** that may hold Phase 030 (Linux/macOS Git). Read-only. No network. No secrets in output.

```bash
cd /path/to/adala-ai   # or wherever the original LOCAL-ONLY repo lived
git rev-parse --show-toplevel
git rev-parse --is-shallow-repository
git rev-parse --show-object-format
git cat-file -t 4d76a954944e17ae920346dd80ae484a3400d310
git rev-parse 4d76a954944e17ae920346dd80ae484a3400d310^{commit}
git rev-parse 4d76a954944e17ae920346dd80ae484a3400d310^{tree}
# MUST print: d568bf7f7ccd778643528d8eba2a41be2e6a5152
git log --format='%H %P %T %s' -1 4d76a954944e17ae920346dd80ae484a3400d310
git branch -a --contains 4d76a954944e17ae920346dd80ae484a3400d310
git fsck --full --no-reflogs
# Optional inventory (read-only)
git show --stat --oneline -1 4d76a954944e17ae920346dd80ae484a3400d310
git ls-tree -r --name-only 4d76a954944e17ae920346dd80ae484a3400d310 | grep -E 'migrations/07[2-6]_|rag|embedding' | head
```

Nonzero exit / missing object = evidence the host is **not** a recovery source.
