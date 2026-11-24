# 11 — Security Conflict Register

No live merge comparison against recovered 030 (object missing).

Deferred conflict themes once 030 is recovered:

| ID | Theme | Note |
|----|-------|------|
| SC-001 | Portal FORCE RLS read (031 transactional GUC) vs any `withPortalBypass` on 030 chain | Do not auto-prefer either |
| SC-002 | `ADALA_HTTP_SECURITY_TEST` harness auth | Must remain test-gated |
| SC-003 | Live refund forbid vs live payment paths on 030 | Preserve fail-closed |
| SC-004 | RAG retrieval auth from 029–030 | Must not be dropped when porting 031 |

No silent resolution performed.
