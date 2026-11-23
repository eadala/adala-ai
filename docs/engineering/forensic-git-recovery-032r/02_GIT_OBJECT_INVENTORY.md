# 02 — Git Object Inventory

| Metric | Value |
|--------|-------|
| Loose objects | ~105 |
| Packed objects | 17906 |
| Packs | 1 |
| Garbage | 0 |
| Required Phase 030 commit | **ABSENT** |
| Required Phase 030 tree | **ABSENT** |
| Phase 031 commit | PRESENT |
| Recovery base `b3d9a0af` | PRESENT |

Commands: `git count-objects -v`, `git cat-file -t <sha>`, `git show-ref`.

No LOCAL-ONLY phase branches (018–030) in local or already-present remote-tracking refs.
Numeric-looking remotes such as `cursor/analytics-schema-027-da81` / `fts-readiness-migration-029-da81` are **schema-authority** branches, not the LOCAL-ONLY assurance chain tips.

Raw: `evidence/discovery-scan.txt`, `evidence/phase-sha-probe.csv`
