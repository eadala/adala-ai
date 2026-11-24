---
name: Adala Client Accounts
description: Client-side account system (separate from Clerk) — login/register/OTP, session management, case linking
---

## DB tables (created in client-auth.ts ensureTables)
- `client_accounts` — id, email UNIQUE, password_hash, name, phone, email_verified, otp, otp_expires
- `client_sessions` — id, client_id FK, token UNIQUE, expires_at (30 days)
- `client_case_links` — client_id, case_id, portal_token_id, portal_token, office_id; UNIQUE(client_id, case_id)

## Auth approach
- Uses Node.js `crypto.scrypt` + `crypto.timingSafeEqual` (bcrypt not installed)
- Session token: 32-byte random hex stored in DB, returned to client
- Client stores token in `localStorage.client_session_token`
- `getClientSession(req)` reads `Authorization: Bearer <token>` header

## API routes (all at /api/client-auth/*)
- POST /register — email+password+name → creates account + session
- POST /login — email+password → returns session token
- POST /logout — deletes session from DB
- GET /me — profile + linked cases (left join cases)
- PATCH /me — update name/phone/password
- POST /request-otp — generates 6-digit OTP, stores in DB, sends email
- POST /verify-otp — verifies OTP, creates session
- POST /link-token — links a portal token to the client account

## Frontend pages
- `/portal/login` — portal-login.tsx; 3 tabs: دخول / تسجيل / رمز سريع
- `/portal/my-cases` — portal-my-cases.tsx; shows all linked cases with open-portal links; profile edit panel; link-new-case via paste portal token/URL

## Integration with portal-view.tsx
- `ClientAccountBanner` component added above unpaid invoice alert
- If logged in: shows "✓ تم ربط القضية بحسابك" with link to /portal/my-cases; auto-links token on mount
- If not logged in: shows "دخول / تسجيل" CTA button → /portal/login

## Route ordering in App.tsx
- `/portal/login` and `/portal/my-cases` MUST be above `/portal/:token` — otherwise `:token` matches "login" and "my-cases"

## getEmailTransporter in client-portal.ts
- Now exported (`export function`) so client-auth.ts can import it for OTP emails
