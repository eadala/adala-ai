# ARC Phase 2C-1 Integration Limitations

1. **Live OIDC BLOCKED** — no authorized test IdP JWKS URL / credentials in this environment.
2. **Live GitHub BLOCKED** — no narrowly scoped GitHub App / token provided; public unauthenticated live reads not claimed as operator-authorized verification.
3. **Coolify production** — explicitly not connected (directive).
4. **Audit** — hash-chain integrity only; **not WORM**.
5. **MFA** — enforcement design validated via ACR claim; live IdP MFA policy untested.
6. **Session revocation** — in-process revocation set; distributed revocation store not yet deployed.
7. **Customer app** — untouched; ARC remains isolated under `artifacts/arc-*`.

These are blockers for claiming live external verification, not blockers for local fixture security acceptance.
