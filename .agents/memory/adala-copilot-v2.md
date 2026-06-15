---
name: Adala Legal Copilot v2
description: AI Legal Copilot Architecture — Intent Engine, Tool Registry, Long-term Memory, Case Intelligence Engine
---

# Architecture

Files live in `artifacts/api-server/src/copilot/`:
- `intent.engine.ts` — Gemini classifies Arabic text → 12 IntentType values; returns {type, confidence, entities}
- `context.engine.ts` — buildRichContext(officeId) queries 6 tables; formatContextForPrompt() merges with memory string
- `memory.ts` — rememberFact/recallMemory via copilot_memory table; buildMemoryContext() for prompt injection
- `case.intelligence.ts` — analyzeCaseIntelligence(caseId): Gemini → {probabilityOfWin, riskLevel, keyStrengths, keyWeakPoints, strategy}; cached 6h in case_intelligence_cache
- `tool.registry.ts` — TOOL_REGISTRY map: 7 tools (CREATE_CASE, CREATE_CLIENT, CREATE_REMINDER, SCHEDULE_EVENT, DRAFT_DOCUMENT, FINANCIAL_SUMMARY, SEARCH_DATA)
- `legal.orchestrator.ts` — orchestrate(): detect intent → if confidence>0.75 run tool/intelligence → else fallback to callAI() with full context

# API Endpoints (routes/copilot.ts)
- POST /api/copilot/chat — main entry, now uses orchestrate()
- GET /api/copilot/snapshot — activeCases + overdueInvoices + upcomingEvents + pendingTasks
- GET /api/copilot/intelligence/:caseId — Case Intelligence (prob + risk + strategy)
- POST /api/copilot/intent — standalone intent detection
- GET /api/copilot/memory — recall user memory
- POST /api/copilot/memory — save user memory {type, key, value}

# DB Tables
- copilot_memory(id, office_id, user_id, memory_type, key, value, updated_at) — UNIQUE(office_id, user_id, memory_type, key)
- case_intelligence_cache(id, case_id, probability_win, risk_level, weak_points[], strategy, analysis_text, generated_at)

# Frontend
- /ai-copilot page: full-screen chat, 6 quick commands, intent badges, ProbabilityRing SVG, IntelligenceCard
- Nav item in layout.tsx AI center (first item), icon BrainCircuit, labelKey nav.items.ai_copilot
- i18n: ar="عدل — المساعد الذكي", en="Adl — AI Copilot"

**Why:** Turns عدالة from CRUD SaaS into AI Operating System — user asks, system executes end-to-end.

**How to apply:** All AI chat should go through orchestrate() not callAI() directly; tool additions go in tool.registry.ts; new intent types go in intent.engine.ts IntentType union.
