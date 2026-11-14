# Frontend Performance & Accessibility

## Observed positives

- Vite 7 + React 19 (`artifacts/adala`)
- Extensive `React.lazy` route splitting in `App.tsx`
- `AppErrorBoundary` + Suspense `PageLoader`
- RTL: `dir="rtl"` widely applied
- Cache headers for hashed assets in vite preview plugin

## Gaps ([Frontend quality inventory](bc-51a53fab-894b-5456-ae2f-9e9af21f83e2))

| ID | Sev | Finding |
|---|---|---|
| F-FE-001 | P1 | Entry chunk ~531KB (`dist4/public/assets/index-*.js`) despite page lazy-load |
| F-FE-002 | P1 | `maximum-scale=1` in `index.html` — WCAG 1.4.4 zoom conflict |
| F-FE-003 | P1 | ~102 pages hardcode `dir="rtl"` without i18n hooks — EN switch incomplete |
| F-FE-004 | P1 | BottomSheet: Escape only, **no focus trap** |
| F-FE-005 | P2 | `EmptyState`/`SkeletonCard` thinly adopted vs AdaptiveDialog |
| F-FE-006 | P2 | `index.html` ships `lang="en"` while i18n default is `ar` |
| F-FE-007 | P2 | QUALITY_GATE “WCAG 2.2 AA ✅” overstates relative to zoom/focus/aria gaps |
| F-FE-008 | P2 | CWV **instrumented** (`web-vitals.ts` → beacon) but Lighthouse CI not run in this assessment |

## Criteria for later measurement

Lighthouse CI; axe on dashboard/cases/documents/billing; remove zoom lock; bind `dir`/`lang` to i18n.

No UI redesign performed.
