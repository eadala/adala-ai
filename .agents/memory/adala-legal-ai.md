---
name: Adala Legal AI Engine
description: Legal document generation engine — DB table, API routes, page structure, and template system
---

## DB Table
`legal_documents` — id(text PK), doc_type, doc_category, title, content, case_id, client_id, variables(jsonb), model_used, created_at(timestamptz)

## API Routes (`legalAI.ts`)
- `GET /api/legal-ai/templates` — all template configs (category, label, fields)
- `POST /api/legal-ai/generate` — body: { docType, variables, caseId?, clientId?, model? } → { content, modelUsed, title }
- `POST /api/legal-ai/:id/refine` — body: { instruction, model? } → { content }
- `GET /api/legal-ai/history` — last 30 documents (with 250-char preview)
- `GET /api/legal-ai/:id` — full document
- `DELETE /api/legal-ai/:id`

## callAI() export
`callAI` in `aiChat.ts` had no `export` keyword — added `export` to line 143. Confirmed working.

## 11 Document Types (6 Categories)
- عقود: employment_contract, lease_contract, service_contract
- مذكرات قانونية: defense_brief, appeal_brief
- ردود قانونية: lawsuit_response
- خطابات قانونية: warning_letter, demand_letter
- وثائق رسمية: power_of_attorney, declaration
- صياغة مخصصة: custom

## Frontend Page (`/legal-ai`)
- 2-column layout: left sidebar (type tree grouped by category) + right panel (form + output)
- History view toggle (Clock button top-right)
- Refine mode: shows instruction textarea + refine button after generation
- Download as .txt via Blob URL
- Nav: Scale icon in AI group, i18n key `nav.items.legal_ai` = "محرك الوثائق القانونية"
- isAI array in layout.tsx includes "/legal-ai" for gold icon color

**Why:** callAI was not exported because it's an internal helper — adding export was the cleanest way to reuse it. No credits deduction for legal AI (routes call callAI directly, not through /api/ai-chat/message).
