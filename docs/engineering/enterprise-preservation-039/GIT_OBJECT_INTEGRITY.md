# Git Object Integrity

| Ref | SHA | Class |
|-----|-----|-------|
| `refs/backup/phase-031-8685f64a` | `8685f64a…` | VERIFIED |
| `refs/backup/master-032r-checkpoint` | `830091d9…` | VERIFIED |
| `refs/backup/secure-recovery-038` | `830091d9…` | VERIFIED |

Phase 031 tree **does not** contain `baseline-capture.txt` (VERIFIED).  
Master checkpoint / HEAD **does** contain it (VERIFIED).

Local restore from phase-031-only bundle → commit/tree exact match (VERIFIED).  
`git bundle verify` → complete history (VERIFIED).
