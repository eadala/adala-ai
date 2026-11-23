---
name: Adala legal pages
description: Terms, privacy, security pages; DB consent tracking fields
---

## Pages
- `/terms` → `artifacts/adala/src/pages/terms.tsx` (8 sections, Arabic, RTL, deep navy/gold)
- `/privacy` → `artifacts/adala/src/pages/privacy.tsx` (8 sections, emerald accent)
- `/security` → `artifacts/adala/src/pages/security.tsx` (6 pillars, certifications, incident response)

## DB columns added (via executeSql)
- `users`: `accepted_terms` (bool), `accepted_terms_at` (ts), `accepted_privacy_at` (ts)
- `subscriptions`: `accepted_terms` (bool), `accepted_terms_at` (ts), `ip_address` (varchar 100), `user_agent` (text)

## Drizzle schema updated
- `lib/db/src/schema/users.ts` — acceptedTerms, acceptedTermsAt, acceptedPrivacyAt
- `lib/db/src/schema/billing.ts` — acceptedTerms, acceptedTermsAt, ipAddress, userAgent

## UI consent gates
- `pricing.tsx` Final CTA — checkbox required before "ابدأ مجاناً" button becomes active
- `landing.tsx` — trust/security section added before footer; footer links point to real routes
- `pricing.tsx` footer — links to /terms /privacy /security

**Why:** Saudi PDPL requires explicit consent logging with timestamp + IP + UA for legal enforceability.
