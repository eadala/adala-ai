---
name: Adala AI integration
description: How AI model calls work in عدالة AI — callAI() architecture, model selection, and env key fallback
---

## Architecture
`artifacts/api-server/src/routes/aiChat.ts` exports:
- `callGeminiAI()`, `callClaudeAI()`, `callOpenAI()` — individual model callers
- `callAI(systemPrompt, userMessage, history?, preferredModel?)` → `{reply, modelUsed}`
  - preferredModel: "auto" | "gemini" | "claude" | "openai"
  - auto falls through: Gemini → Claude → OpenAI → template fallback
- `getAvailableModels()` → `{gemini: bool, claude: bool, openai: bool}`
- `GET /api/ai-models/available` — frontend uses this to show/lock model options

## Models
- gemini-2.5-flash (GEMINI_API_KEY) — free, default
- claude-3-5-haiku-20241022 (ANTHROPIC_API_KEY) — paid
- gpt-4o-mini (OPENAI_API_KEY) — paid
- template fallback — no API key needed

## Frontend (ai-hub.tsx)
- ModelKey type + MODEL_OPTIONS array + MODEL_USED_LABELS map defined at top
- selectedModel state (default "auto") + modelPickerOpen state
- Model picker dropdown shown only for chat/command modes (they use /ai-chat/message)
- Passes body.model = selectedModel to /api/ai-chat/message

## Key rule
Use `db.execute(sql\`...\`)` + `(r as any)?.rows ?? []` for raw SQL — never Drizzle ORM
select/update with integer IDs on TEXT-typed columns (causes TS2769 overload errors).

**Why:** casesTable.id and aiTasksTable.id are TEXT in schema but code passes number IDs.
Raw SQL sidesteps the type mismatch.
