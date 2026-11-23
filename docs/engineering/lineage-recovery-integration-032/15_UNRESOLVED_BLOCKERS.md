# 15 — Unresolved Blockers / Recovery Requirements

## P0 — Release blocking

1. **Exact Phase 030 commit unavailable** (`4d76a954…` / tree `d568bf7f…`).
2. **Phases 018–029 LOCAL-ONLY tips unavailable** in this Git object store.
3. **G1/G2 fail** → integration closure forbidden.

## Recovery requirements (PATH C)

To unblock PATH A:

1. Authorize **read-only** acquisition of the exact Git objects (bundle, worktree export, or authorized fetch of the never-pushed LOCAL-ONLY branches).
2. Deliver objects containing at minimum:
   - `4d76a954944e17ae920346dd80ae484a3400d310`
   - its full ancestry through Phase 018 as claimed by prior trackers
3. Re-run Phase 032 from G0 with object verification (SHA + tree + parents).
4. Remap Phase 031 migration `061` if recovered chain already owns 061+.
5. Selectively port Phase 031 product delta (see `05_PHASE_031_CHANGE_INVENTORY.md`).
6. Re-run clean install, upgrade, security, financial, RAG, API/browser gates.

## Explicit non-actions taken

- No fabricated “equivalent” commits.
- No undocumented fetch.
- No force-push / prune / GC.
- No merge of 031 onto a guessed baseline.
- Phase 031 branch left at `8685f64a` unchanged.
