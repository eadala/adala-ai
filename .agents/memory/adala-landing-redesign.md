---
name: Adala Landing Page Redesign
description: Full rewrite of landing.tsx v2 — new design system #0B1F3B + #2563EB, 6 sections, high-conversion SaaS layout
---

## Design Tokens (v2 system)
- PRIMARY / DARK = "#0B1F3B" (dark navy — headings, footer background)
- ACCENT = "#2563EB" (blue — CTAs, badges, highlights)
- ACCENT_D = "#1D4ED8", ACCENT_L = "#EFF6FF", ACCENT_M = "#DBEAFE", ACCENT_T = "#93C5FD"
- SUCCESS = "#16A34A", WARN = "#F59E0B"
- Hero background: WHITE → ACCENT_L gradient + grid dot overlay

## Page Structure (condensed to 5-6 screens)
1. Navbar — transparent → frosted glass on scroll (boxShadow + backdrop-filter)
2. Hero — split layout (copy right RTL, DashboardMock left) + proof strip at bottom
   - Exactly 2 CTAs: "ابدأ مجاناً" (ACCENT solid) + "جرّب المنصة" (outlined)
   - Proof numbers: +500 مكتب | +50,000 قضية | 99.9% uptime | 4 دول الخليج
3. PlatformShowcase (lazy Suspense)
4. 6 Features Grid — SIX_FEATURES const, 3-col desktop / 2 tablet / 1 mobile, hover lift
5. UI Preview — "شاهد المنصة في العمل" — 2-col with DashboardMock + floating badge
6. PaymentShowcase (lazy)
7. Pricing — 3 plans; Popular card uses PRIMARY dark bg + ACCENT CTA button
8. FAQ — accordion (kept)
9. CTA — PRIMARY dark bg, ACCENT glow, 2 CTAs
10. Footer — DARK bg, 4 columns, CMS-aware

## Key Preserved Infrastructure
- Variant routing (bento/stripe/hubspot) at top of component — untouched
- CMS integration via c(section, key, fallback) — all text CMS-editable
- i18n keys unchanged — same translation keys used throughout
- FadeIn / Counter / DashboardMock / FAQItem helpers kept
- Lazy Suspense for PlatformShowcase + PaymentShowcase
- AdoulWidget (WhatsApp) at bottom
- Footer link arrays (platformLinks / companyLinks / supportLinks) CMS-aware

**Why:** Design doc specified 5-6 screen max, #0B1F3B + #2563EB tokens, exactly 6 features, 3 pricing plans, Apple-level conversion
**How to apply:** Always preserve variant routing block at top and CMS c() calls; SIX_FEATURES is hardcoded not i18n (intentional — keeps exactly 6)
