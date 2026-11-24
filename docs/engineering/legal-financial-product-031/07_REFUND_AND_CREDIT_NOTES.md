# 07 — Refund & Credit Notes

- `refund_requests` + duplicate_key unique
- request → authorize → execute via FakePaymentTransport
- Fail path 502; success not inferred from local state
- Credit note linked on success when invoice present
- `/fincore/refund` refuses live without ADALA_ALLOW_LIVE_REFUNDS
