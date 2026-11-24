# 05 — Repository Integrity Report

| Check | Result |
|-------|--------|
| `git rev-parse --is-shallow-repository` | false |
| Promisor / partial clone | not configured |
| Alternates | absent |
| `git fsck --no-dangling` | completed (see `evidence/fsck-no-dangling.txt`) |
| Object format | sha1 |
| Missing required objects | Phase 030 commit + tree; phases 017–029 expected tips |
| Corruption of present objects | not indicated for required present tips (031/032/recovery/main) |
| Classification | **Missing reachable objects for LOCAL-ONLY lineage** — not shallow/promisor artifact of this clone for those SHAs |

Distinction: repository is intact for its **present** history; the LOCAL-ONLY 018–030 history was never imported into this object store.
