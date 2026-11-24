---
name: Adala Test Offices
description: Two seeded test offices for multi-tenant isolation testing — IDs, users, and data counts
---

## Test Office A — مكتب الشمال للمحاماة
- **office_id**: `aaaabbbb-0001-0001-0001-000000000001`
- **slug**: `test-north`
- **plan**: `professional`
- **Clerk user**: `test-user-north` (email: north@test.com)
- **Data**: 4 cases, 3 clients, 3 contracts, 3 invoices, 2 employees, 2 revenues, 2 arbitrations

## Test Office B — مكتب الجنوب القانوني
- **office_id**: `bbbbcccc-0002-0002-0002-000000000002`
- **slug**: `test-south`
- **plan**: `starter`
- **Clerk user**: `test-user-south` (email: south@test.com)
- **Data**: 4 cases, 3 clients, 2 contracts, 3 invoices, 2 employees, 2 revenues, 2 arbitrations

## Isolation Verified
SQL check confirmed each office sees ONLY its own records via office_id filters.

## Tables present in both test offices
cases, clients, contracts, client_invoices, employees, revenues, arbitration_cases

## How to link a real Clerk user to a test office
```sql
INSERT INTO office_members (id, office_id, user_id, role, status)
VALUES (gen_random_uuid(), 'aaaabbbb-0001-0001-0001-000000000001', '<clerk_user_id>', 'admin', 'active');
```
Then the user's tenant resolves to OA automatically via resolveTenantId().
