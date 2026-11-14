# Regression and Build Results

| Check | Result |
|---|---|
| ARC 129 | PASS |
| P0 static + Moyasar | PASS (13) |
| Pool adversarial | PASS |
| `tsc` api-server | FAIL — pre-existing `rbac.ts` invitations.officeId schema drift (3 errors); **not introduced by P0 files** |
| Production migrate 061 | NOT RUN (authorized: none) |
