---
name: Adala AI Gateway
description: Unified POST /api/ai/query endpoint — architecture, caching, query types
---

## Rule
All AI calls must go through `POST /api/ai/query`. Never call AI directly from frontend modules.

## Location
`artifacts/api-server/src/modules/ai/aiGateway.ts`

Registered in `routes/index.ts` as `aiGatewayRouter` — first in the AI section (priority).

## Request shape
```json
{ "type": "legal_assistant|document_draft|case_analysis|opponent_sim|legal_research|contract_review|custom", "input": "...", "context": "...", "model": "auto|gemini|claude|openai", "noCache": false }
```

## Response caching
- 10-minute TTL via `cache.set(key, result, 600)`
- Cache key = SHA-256 of `type|input|context` (first 16 chars)
- `noCache: true` bypasses cache
- `GET /api/ai/query/cache-stats` for monitoring

## Supporting endpoints
- `GET /api/ai/query/types` — list all query types with Arabic labels
- `GET /api/ai/query/cache-stats` — live cache stats

**Why:** Spec requires AI to be an isolated Service Layer, not UI-embedded calls. Gateway enables caching, audit logging, credit deduction, and event emission in one place.
