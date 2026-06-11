---
name: Adala Messaging & AI Assistant
description: Internal messaging system and AI admin assistant — tables, routes, pages, and critical build constraint
---

# Internal Messaging System + AI Assistant

## Tables Created (raw SQL via executeSql)
- `office_messages` — id(UUID), subject, body, sender_id, sender_name, sender_ip, device_info, folder(sent/draft/archive), tags, created_at
- `office_message_recipients` — id(UUID), message_id→office_messages, user_id, user_name, is_read, reader_ip, read_at
- `office_message_attachments` — id(UUID), message_id→office_messages, file_name, file_url, file_size
- `ai_assistant_logs` — id(UUID), office_id, user_id, question, response, context_used, created_at

## API Routes
- `router.use("/internal-messages", internalMessagesRouter)` in index.ts
- `router.use("/ai-assistant", aiAssistantRouter)` in index.ts
- GET /api/internal-messages?folder=inbox|sent|drafts|archive&search=...
- GET /api/internal-messages/stats/counts
- GET /api/internal-messages/:id (also marks as read with IP)
- POST /api/internal-messages — {subject, body, recipients:[{userId,userName}], attachments, folder, tags}
- PUT /api/internal-messages/:id/archive
- DELETE /api/internal-messages/:id
- POST /api/ai-assistant — {question} → {response, contextUsed}
- GET /api/ai-assistant/history
- GET /api/ai-assistant/suggestions

## Critical Build Constraint
**NEVER import `pg` directly in API route files.** The esbuild build config does NOT mark `pg` as external, causing build failures. Always use `import { db } from "@workspace/db"` + `db.execute(sql\`...\`)` from drizzle-orm.

## Frontend Pages
- `/messages` — full inbox UI: sidebar (Inbox/Sent/Drafts/Archive), message list, detail panel with IP tracking, ComposeDialog with multi-recipient selector
- `/ai-assistant` — chat UI with BrainCircuit icon, capability cards, history panel, Arabic natural language queries
- Both registered in App.tsx routes and layout.tsx sidebar (AI section)

## Client Detail (client-detail.tsx)
- Now has 6 tabs: القضايا, الفواتير, العقود, المواعيد, المراسلات, النشاطات
- Activities tab = Timeline showing all client events sorted newest-first
- Messages tab = office_messages linked to client name
- clients.ts overview API now returns `messages[]` and `activities[]`

**Why:** Direct `pg` Pool was the original approach but fails at build time; Drizzle `db.execute` is the correct pattern consistent with all other routes.
