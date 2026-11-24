# 09 — Encrypted Independent Bundle Plan

**Encryption status:** NOT PERFORMED (planning only)

## Plan (post-approval)

1. Export approved refs to standalone bundles (reference-based).  
2. `sha256sum` each bundle; record separately.  
3. Encrypt with age/gpg: `age -r <recipient> -o bundle.age bundle` (key **never** in repo).  
4. Store ciphertext on approved offline/object storage; store key elsewhere.  
5. Retention: mirror phase checkpoint policy.  
6. Restore: decrypt → `git bundle verify` → disposable bare fetch → SHA asserts.

Existing plaintext local bundles remain local-only until encrypted transfer authorized.
