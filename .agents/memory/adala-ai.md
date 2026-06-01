---
name: Adala AI integration approach
description: AI integration strategy for عدالة AI — Replit AI unavailable, using direct API calls
---

Replit AI integrations (OpenAI, Anthropic) require phone number verification and cannot be used on this account.

**Solution:** Direct HTTP fetch to Anthropic/OpenAI APIs using env vars:
- `ANTHROPIC_API_KEY` → Claude 3.5 Haiku
- `OPENAI_API_KEY` → GPT-4o-mini (fallback)
- Neither set → Smart Arabic legal template responses (keyword matching)

**Why:** Provides real AI when user adds their own API key, gracefully degrades to template-based Arabic legal responses otherwise. Templates cover major legal topics: تقادم, عقود, أسرة, جرائم, تجارة.

**How to apply:** Route is `/api/ai-chat/message` (POST). `/api/ai-tasks/:id/process` processes AI tasks in DB. `/api/ai-search` for document/case search with AI analysis.
