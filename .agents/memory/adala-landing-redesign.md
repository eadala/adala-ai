---
name: Adala Landing Page Redesign
description: Modern redesign of landing.tsx — bento features, sticky side nav, tabbed sections
---

## What was done
- `featureItems.slice(0,8)` shown as bento grid (BENTO_SPANS array drives col-span)
- Wide cards (index 0 and 5) get `lg:col-span-2 md:col-span-2` + glow effect + extra badge line
- Side nav dots: `SIDE_DOTS` array, IntersectionObserver sets `activeSection` state, fixed right-5 top-1/2
- Stats (`STATS` array) moved inline to Hero bottom — Trust Strip section removed
- How + Security combined: `howTab` state (0/1), tab switcher renders either steps or secItems
- Removed sections: Urgency Bar, Competitor Table, Referral Banner, Privacy Trust

## Why
Page was 16 sections / 1110 lines — too long for SaaS landing. Modern pattern is fewer focused sections.

## How to apply
- `privacyItems` is still declared in state (used to be in Privacy Trust section) — safe to remove in future
- `XCircle`, `Minus`, `TrendingDown`, `Copy`, `Share2` imports were removed (were only used by deleted sections)
- Side nav only shows on `xl:` breakpoint (1280px+)
