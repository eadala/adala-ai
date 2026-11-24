# 10 — Security Regression

**NOT RE-RUN on integrated lineage** (integration blocked).

Phase 031 focused checks remain valid only on recovery+061 tip:

- Test auth gated by `ADALA_HTTP_SECURITY_TEST`
- Portal public reads use single-connection tenant GUC under FORCE RLS
- Live refund forbidden
- RLS on `refund_requests` / fee_* tables

These do **not** prove preservation of Phase 018–030 security invariants (RAG revocation, AI job scope, SA/Developer separation on that chain) because that chain is absent.
