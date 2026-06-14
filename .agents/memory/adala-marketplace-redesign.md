---
name: Adala Marketplace Redesign
description: Legal Marketplace concept — Khamsat×Upwork, Deal Room, auto-flow
---

## New DB Tables (marketplace.ts)
- `marketplace_orders` — direct purchases (buyer_name/email/phone, amount, status, case_id)
- `marketplace_deals` — negotiation sessions (initial_price, final_price, status: open/accepted/rejected)
- `marketplace_deal_offers` — offer thread per deal (from_role: buyer/seller, price, message)

## Key Routes
- POST /marketplace/orders → creates order, increments service total_orders
- POST /marketplace/deals → creates deal + first buyer offer
- POST /marketplace/deals/:id/offer → seller counter-offer (must be authenticated)
- POST /marketplace/deals/:id/accept → closes deal, auto-creates case in `cases` table
- PATCH /marketplace/orders/:id → status update; if "completed" → auto-creates case

## Auto-case Flow
On deal accept OR order marked completed:
```sql
INSERT INTO cases (id, title, case_type, client_name, status, notes, created_at, updated_at)
VALUES (newId, 'صفقة/خدمة: '+service_title, 'other', buyer_name, 'open', contact_info, NOW(), NOW())
```

## Frontend Architecture (marketplace.tsx)
- `ServiceCard` — category color strip, office avatar (initials+color hash), dual CTAs
- `BuyNowDialog` — direct order form, no auth required
- `DealRoomDialog` — 2-step: form → offer timeline (5s polling via refetchInterval)
- `DealsDashboard` — seller's deals+orders manager, inline counter-offer input
- Stats from GET /marketplace/stats (totalServices, totalOffices, completedOrders)

**Why:** Transforms marketplace from basic service listing to full legal commerce platform.
**How to apply:** When building order/deal flows, always check if case auto-creation succeeded via case_id field on response.
