# Frontend Performance & Accessibility

## Observed positives

- Vite 7 + React 19 (`artifacts/adala`)
- Extensive `React.lazy` route splitting in `App.tsx`
- `AppErrorBoundary` + Suspense `PageLoader`
- RTL: `dir="rtl"` widely applied
- Cache headers for hashed assets in vite preview plugin

## Unverified / gaps

| ID | Sev | Finding |
|---|---|---|
| F-FE-001 | P1 | Core Web Vitals / LCP/INP not measured (no browser automation run; no dist stats) |
| F-FE-002 | P2 | Bundle size / manualChunks strategy not analyzed (build not executed here) |
| F-FE-003 | P2 | WCAG 2.2 AA not formally audited; keyboard/screen-reader sampling incomplete |
| F-FE-004 | P2 | Very large route surface → cognitive + maintenance load |

## Criteria for later measurement

Lighthouse CI on staging; bundle visualizer; axe scan on dashboard/cases/documents/billing; Arabic RTL screenshot diffs.

No UI redesign performed.
