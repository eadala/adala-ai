---
name: Adala Messaging & AI Assistant
description: Internal messaging system, group conversations, and AI assistant — tables, routes, pages, and critical build constraint
---

# Internal Messaging System + AI Assistant

## Tables Created (raw SQL via executeSql)
- `office_messages` — id(UUID), subject, body, sender_id, sender_name, sender_ip, device_info, folder(sent/draft/archive), tags, created_at, conversation_id (nullable FK)
- `office_message_recipients` — id(UUID), message_id→office_messages, user_id, user_name, is_read, reader_ip, read_at
- `office_message_attachments` — id(UUID), message_id→office_messages, file_name, file_url, file_size
- `ai_assistant_logs` — id(UUID), office_id, user_id, question, response, context_used, created_at
- `message_conversations` — id(UUID), office_id, title, type('direct'|'group'), created_by, created_at, updated_at
- `conversation_members` — id(UUID), conversation_id→message_conversations(CASCADE), office_id, user_id, user_name, role('admin'|'member'), joined_at; UNIQUE(conversation_id, user_id)
- FTS: `search_vector tsvector GENERATED ALWAYS AS STORED` on office_messages, GIN index, 'arabic' FTS config

## API Routes — Internal Messages
- `router.use("/internal-messages", internalMessagesRouter)` in routes/index.ts
- GET /api/internal-messages?folder=inbox|sent|drafts|archive&search=...
- GET /api/internal-messages/stats/counts
- GET /api/internal-messages/:id (also marks as read with IP)
- POST /api/internal-messages — {subject, body, recipients:[{userId,userName}], attachments, folder, tags}
- PUT /api/internal-messages/:id/archive
- DELETE /api/internal-messages/:id

## API Routes — Group Conversations
- `router.use("/conversations", conversationsRouter)` in routes/index.ts → `src/modules/operations/conversations.ts`
- POST /api/conversations — create; validates memberIds against office_members; creator=admin
- GET /api/conversations — list only user's conversations (JOIN conversation_members)
- GET /api/conversations/:id/messages — paginated thread; mandatory isMember() security check
- POST /api/conversations/:id/messages — send; isMember guard; sendToUsers() SSE to other members
- POST /api/conversations/:id/members — add member; isAdmin() guard; office isolation check
- UUID regex `/[0-9a-f-]{36}/` validated on all /:id routes

## AI Assistant Routes
- POST /api/ai-assistant — {question} → {response, contextUsed}
- GET /api/ai-assistant/history
- GET /api/ai-assistant/suggestions

## Critical Build Constraint
**NEVER import `pg` directly in API route files.** esbuild does NOT mark `pg` as external. Always use `import { db } from "@workspace/db"` + `db.execute(sql\`...\`)` from drizzle-orm.

## SSE Event Bridge Pattern
- `notifications-panel.tsx` dispatches `window.dispatchEvent(new CustomEvent("sse:NEW_MESSAGE", { detail: ev }))` on every NEW_MESSAGE
- Page components listen with `window.addEventListener("sse:NEW_MESSAGE", handler)` — no shared store needed
- **Why:** decouples page-level consumers from the notification component singleton

## Frontend messages.tsx Structure
- Mode switcher tabs: "البريد الداخلي" (MailPanel) | "المحادثات" (ConversationsPanel)
- MailPanel: existing folder/compose/detail system — fully preserved
- ConversationsPanel: left=conversation list (type badge, last message, timeAgo), right=chat-bubble thread + reply box
- "محادثة جديدة" dialog: type (direct/group), group title, member picker with search dropdown
- AddMemberButton: visible only to admins; calls POST /:id/members
- lucide-react: `MessagesSquare` does NOT exist — use `MessageSquareDot` for multi-message icon

## Client Detail (client-detail.tsx)
- 6 tabs: القضايا, الفواتير, العقود, المواعيد, المراسلات, النشاطات
- clients.ts overview API returns `messages[]` and `activities[]`

**Why:** Direct `pg` Pool fails at build time; Drizzle `db.execute` is correct and consistent with all other routes.
