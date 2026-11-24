# Phoenix V — Repository Security & Incident Containment

**Directive:** `ADALA-MASTER-050-055-UNIFIED-EXECUTION`  
**Captured (Asia/Riyadh):** 2026-11-24 ~00:00 AST

## Verified facts (this session)

| Fact | Evidence |
|------|----------|
| Development tip | `cursor/phase-049-engineering-continuity-da81` @ `9eb558cdef98a57ff08a9495b5f6c286b04cfb3f` / tree `bf16e185…` |
| Origin remote | `eadala/adala-ai` |
| Origin visibility | **PUBLIC** (`private=false`) |
| Phase 049 remote branch | Present at same SHA as local tip |
| Contaminated blob in tip **tree** | **NO** (redacted in Phase 049) |
| Contaminated blob **reachable** from tip history | **YES** (`3f1a3e36…` via ancestral `baseline-capture.txt`) |
| Tip working-tree secret heuristic | 0 hits for ghs_/gho_/ghp_/sk_live/PEM/AKIA |
| Reachable-history secret scan | **1** historical `ghs_` hit (same forensic path) |
| CI triggered by public push | **YES** — workflow run on `9eb558cd` (Gate 1 TS failed; Gate 8 tenant success; Docker success; no deploy job observed) |
| Production deploy from push | **NO evidence** of Coolify/prod deploy from this branch |

## Exposure classification

| Scope | Status |
|-------|--------|
| Working tree / tip tree | Clean of live token patterns (post-049 redaction) |
| Local reachable history | Contaminated blob reachable |
| Remote reachable history (public) | Contaminated blob reachable via public branch history |
| Public history | **EXPOSED** — treat credential as compromised |
| Unknown additional tokens | No other pattern hits in reachable blob scan this session |

## Required owner actions (human)

1. **Revoke/rotate** any GitHub token that appeared in forensic `baseline-capture.txt` (assume compromised).
2. Confirm whether that token had org/repo/admin scopes beyond the intended workspace.
3. Decide remediation for public history (BFG/filter-repo + force-push) — **not authorized in this directive**.
4. Prefer future milestone preservation only to **private** `adalahai/adala-ai-private-recovery-2026`.
5. Do **not** push further contaminated-ancestry tips to the public origin until history remediation is approved.

## Engineering controls added this phase

- `remote-backup-push.sh` refuses non-private destinations.
- Public-origin push of new Phoenix V work **deferred** (no push of `cursor/phoenix-v-050-055-unified-da81` in this session unless separately authorized and clean).
- Clean-tree orphan bundles remain the local preservation path.

## Forensic evidence preserved

- Redacted tip-tree capture remains under `docs/engineering/forensic-git-recovery-032r/evidence/`.
- Contaminated OID recorded: `3f1a3e36c8b6ace9e1bf1b6c072951f8a8f6f925`.
- Phase 031 private backup unchanged.
