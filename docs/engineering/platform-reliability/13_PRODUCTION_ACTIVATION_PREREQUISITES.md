# Production Activation Prerequisites

Local PASS does **not** authorize staging or production.

Required before any production activation:

1. Authorized private object-storage credentials + SSE/immutability policy
2. Approved RPO/RTO and retention
3. Scheduled non-prod restore drills with evidence retention
4. Alert channel authorization and on-call ownership
5. Secret/IdP/payment recovery runbooks exercised
6. Explicit push/merge/deploy authorization
7. ARC deployment remains DISABLED until separately authorized
