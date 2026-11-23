---
name: Adala Floating Copilot
description: Floating AI assistant (عدل) embedded in every page via layout.tsx; backend at /api/copilot/*
---

## Architecture
- Backend: `artifacts/api-server/src/routes/copilot.ts`
  - POST /api/copilot/chat — Gemini via callAI(), builds DB snapshot context, parses [ACTION:{...}] from reply
  - GET /api/copilot/snapshot — returns {activeCases, overdueInvoices, upcomingEvents}
- Frontend: `artifacts/adala/src/components/floating-copilot.tsx`
  - Fixed bottom-left (RTL layout), z-[300]
  - Opens 360×560 panel with chat history + quick action cards
  - Executes navigate actions (closes panel + routes)
  - Badge on button when overdueInvoices > 0
- Registered in layout.tsx after </main> — visible on all pages

## Actions AI can trigger
- `navigate` → client-side route + close panel
- `create_reminder` → executed server-side in copilot.ts
- `create_case` → executed server-side in copilot.ts

## CSS
- slideUpIn @keyframe added to index.css (panel open animation)

**Why:** User asked for AI that has full permissions and interacts on every page (not just a separate page).
