# 10 — Restore Verification Plan

## Local (already demonstrated for prior checkpoint tip)

Disposable bare fetch of master checkpoint bundle matched tip SHA/tree (prior 032R evidence).

## Off-environment (Gate 4 — not executed)

1. Retrieve approved backup (private remote or decrypted bundle).  
2. Verify SHA-256.  
3. Isolated bare repo restore.  
4. Assert `8685f64a^{tree} == ea8b8e85…`.  
5. Assert master checkpoint tip SHA.  
6. `git fsck` connectivity.  
7. Spot-check migrations `061` + fee-agreement paths.  
8. Write restore evidence report.

**OFF_ENVIRONMENT_RESTORE_TEST:** NOT_PERFORMED  
Label: local restore ≠ disaster recovery.
