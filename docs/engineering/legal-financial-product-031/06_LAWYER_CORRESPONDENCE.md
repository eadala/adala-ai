# 06 — Lawyer Correspondence

- Client `POST /portal/:token/message`
- Firm `GET /portal/case/:caseId/messages`
- Firm `POST /portal/case/:caseId/reply` (marks inbound read)
- Portal view returns message history
- Browser E2E same-origin shell verified
