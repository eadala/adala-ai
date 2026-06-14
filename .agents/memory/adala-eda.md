---
name: Adala EDA System
description: Event-Driven Architecture — EventBus, listeners, SSE stream, activity-stream page
---

## Core file
`artifacts/api-server/src/core/eventBus.ts` — singleton EventBus class  
- `emit(payload)` → persist to `system_events` DB table + run listeners + broadcast SSE  
- `on(EventType | "*", handler)` — register listener  
- `addSSEClient(res)` — register SSE response for live broadcasting

## DB tables
- `system_events` — id (uuid), event_type, office_id, actor_id, payload (jsonb), created_at  
- `event_daily_counts` — unique(event_type, office_id, event_date), upserted by analytics wildcard listener

## Listeners (src/core/listeners/)
- `financeListener.ts` — PAYMENT_SUCCESS (wallet snapshot + auto-mark invoice paid), PAYMENT_FAILED, INVOICE_PAID, PAYMENT_SETTLED
- `notificationListener.ts` — writes to `notifications` table for CASE_CREATED/CLOSED, CLIENT_ADDED, INVOICE_CREATED/PAID, PAYMENT_SUCCESS, DOCUMENT_GENERATED
- `analyticsListener.ts` — wildcard `*` → upserts `event_daily_counts`; exports EVENT_LABELS map
- `index.ts` — `registerAllListeners()` called in `src/index.ts` at startup

## API routes (src/routes/events.ts)
- `GET /api/events/stream` — SSE (text/event-stream), keepalive 25s, welcome ping on connect
- `GET /api/events/recent?limit=N&type=X&office=Y` — history from DB
- `GET /api/events/stats` — total30d, byType[], byDay[], liveClients

## Event wiring
| Route file | Events emitted |
|---|---|
| cases.ts | CASE_CREATED, CASE_UPDATED, CASE_CLOSED |
| payments.ts | PAYMENT_SUCCESS (when status==="completed") |
| invoices.ts | INVOICE_CREATED |
| clients.ts | CLIENT_ADDED |

## Frontend
`artifacts/adala/src/pages/activity-stream.tsx` — SSE via EventSource, recharts AreaChart + BarChart, filter by event type, pause/resume feed, stat cards. Route: `/activity-stream` (WorkspaceRoute). Nav: "نبض النظام" in analytics group.

**Why:** All edits must be additive (non-blocking `.catch(() => {})`) so EDA failures never break existing API responses.

**How to apply:** To emit a new event from any route: `import { eventBus } from "../core/eventBus"` then `eventBus.emit({ type: "EVENT_TYPE", data: {...} }).catch(() => {})`. Add matching label to EVENT_LABELS in analyticsListener.ts.
