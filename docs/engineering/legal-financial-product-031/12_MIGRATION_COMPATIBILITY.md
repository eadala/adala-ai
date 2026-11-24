# 12 — Migration Compatibility

- Forward-only `061_legal_financial_product_completion.sql`
- Clean install: 55/59 (pre-existing greenfield failures: 010, 037, 049, 053)
- 061 applies successfully; provides credit_notes/portal office_id/expenses.office_id safety nets
- Period-close tables not created
- Historical migrations unmodified
