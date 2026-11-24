# 🔴 CASE_ERRORS_REPORT.md
### Case Management — تقرير الأخطاء الكاملة
**تاريخ الفحص:** 15 يونيو 2026  
**المنهجية:** Static analysis + DB schema inspection + runtime log analysis + API route tracing

---

## ERROR-01: Documents Tab — 500 Server Error

| الحقل | التفاصيل |
|-------|---------|
| **URL** | `GET /api/cases/:id/documents` |
| **Component** | `CaseDocuments.getDocuments()` — `src/case/modules/documents.ts:12` |
| **HTTP Status** | 500 Internal Server Error |

**Stack Trace (Server):**
```
PostgreSQL ERROR: column "file_size" does not exist
  at CaseDocuments.getDocuments()
  SQL: SELECT id, file_name, file_type, file_url, file_size, created_at FROM documents WHERE ...
```

**Console Error (Frontend):**
```
GET /api/cases/c1/documents 500 (Internal Server Error)
Uncaught (in promise): SyntaxError — Unexpected token '<', "<!DOCTYPE" is not valid JSON
```

**Network Error:**
```
Request: GET /api/cases/c1/documents
Response: 500 { "error": "column \"file_size\" does not exist" }
```

**Root Cause:**
`documents` table в PostgreSQL was created without the `file_size` column. `getDocuments()` attempts to SELECT it:
```sql
-- Broken:
SELECT id, file_name, file_type, file_url, file_size, created_at FROM documents
--                                          ^^^^^^^^^ column does not exist
```

**API Response:**
```json
{ "error": "column \"file_size\" does not exist" }
```

---

## ERROR-02: Documents Tab — INSERT fails (Add Document)

| الحقل | التفاصيل |
|-------|---------|
| **URL** | `POST /api/cases/:id/documents` (via storage upload flow) |
| **Component** | `CaseDocuments.addDocument()` — `src/case/modules/documents.ts:27` |
| **HTTP Status** | 500 Internal Server Error |

**Stack Trace (Server):**
```
PostgreSQL ERROR: column "file_size" of relation "documents" does not exist
  at CaseDocuments.addDocument()
  SQL: INSERT INTO documents (case_id, office_id, file_name, file_type, file_url, file_size) VALUES (...)
```

**Root Cause:**
Same missing `file_size` column — INSERT explicitly names it in the column list, causing a schema error.

---

## ERROR-03: Tasks Tab — Silent Empty (GET) + 500 on CREATE

| الحقل | التفاصيل |
|-------|---------|
| **URL (GET)** | `GET /api/cases/:id/tasks` |
| **URL (POST)** | `POST /api/cases/:id/tasks` |
| **Component** | `CaseTasks` — `src/case/modules/tasks.ts` |
| **HTTP Status GET** | 200 (but always empty `[]`) |
| **HTTP Status POST** | 500 Internal Server Error |

**Stack Trace — GET (silent failure via .catch):**
```
PostgreSQL ERROR: invalid input syntax for type uuid: "c1"
  Caught by .catch(() => ({ rows: [] })) → returns []
  User sees: empty tasks list
```

**Stack Trace — POST (uncaught):**
```
PostgreSQL ERROR: invalid input syntax for type uuid: "c1"
  at CaseTasks.createTask()
  SQL: INSERT INTO tasks (..., case_id, ...) VALUES (..., 'c1'::uuid, ...)
```

**Root Cause:**
`cases.id` is type `TEXT` (seed values: "c1", "c2", etc.).  
`tasks.case_id` is type `UUID`.  
The module explicitly casts: `${caseId}::uuid` — this fails for non-UUID case IDs.

```sql
-- Broken:
WHERE case_id = 'c1'::uuid   -- ERROR: invalid input for uuid
INSERT INTO tasks (case_id) VALUES ('c1'::uuid)  -- ERROR: same
```

**API Response (POST):**
```json
{ "error": "invalid input syntax for type uuid: \"c1\"" }
```

---

## ERROR-04: Task Toggle — 404 Not Found

| الحقل | التفاصيل |
|-------|---------|
| **URL** | `PATCH /api/tasks/:id` |
| **Component** | `TasksMini.toggle()` — `src/pages/case-detail.tsx:678` |
| **HTTP Status** | 404 Not Found |

**Console Error (Frontend):**
```
PATCH /api/tasks/<uuid> 404 (Not Found)
```

**Root Cause:**
Frontend calls `PATCH /api/tasks/${id}` but the actual registered route is:
```
PATCH /api/office-tasks/:id   ← actual route (tasks.ts:117)
PATCH /api/tasks/:id          ← does NOT exist → 404
```
Route URL mismatch: `tasks` vs `office-tasks`.

**API Response:**
```json
{ "error": "Cannot PATCH /api/tasks/<uuid>" }
```

---

## ERROR-05: AI Copilot Snapshot — 500 Server Error

| الحقل | التفاصيل |
|-------|---------|
| **URL** | `GET /api/copilot/snapshot` |
| **Component** | `copilot.ts:53` — called from AI Copilot widget |
| **HTTP Status** | 500 Internal Server Error (persistent, in every login) |

**Server Log:**
```
[22:31:41.257] INFO: request errored
  req: { "method": "GET", "url": "/api/copilot/snapshot" }
  res: { "statusCode": 500 }
  err: { "type": "Error", "message": "failed with status code 500" }
```

**Root Cause:**
Route uses `requireAuth` (not `requireAuthWithTenant`) → `getTenantSafe()` returns `null` → `officeId = "default"`.  
The query `WHERE office_id = 'default'` then fails because `tasks.office_id` is UUID type:

```sql
-- Broken:
SELECT COUNT(*) FROM tasks WHERE office_id = 'default' AND status != 'done'
-- ERROR: invalid input syntax for type uuid: "default"
```

**API Response:**
```json
{ "error": "invalid input syntax for type uuid: \"default\"" }
```

---

## ERROR-06: AI Insights Table — Missing on First Call (non-critical)

| الحقل | التفاصيل |
|-------|---------|
| **URL** | `GET /api/cases/:id/ai-insights` |
| **Component** | `case.ai.ts:263` — `getLatestInsight()` |
| **HTTP Status** | Handled gracefully — 200 null |

**Root Cause:**
`case_ai_insights` table was not created at server startup — it's lazy-created only when first called. On a fresh database, the table doesn't exist, causing the route to return `null` instead of insight data. This is non-crashing but means AI sidebar shows "لم يتم التحليل بعد" correctly.

**Pre-fix:** Table needed to exist before any queries ran.

---

## Summary Table

| # | Error | URL | Component | Severity | Type |
|---|-------|-----|-----------|----------|------|
| 1 | Missing `file_size` column (SELECT) | GET /cases/:id/documents | `documents.ts:12` | 🔴 Critical | DB Schema |
| 2 | Missing `file_size` column (INSERT) | POST /cases/:id/documents | `documents.ts:27` | 🔴 Critical | DB Schema |
| 3a | UUID cast failure — silent empty | GET /cases/:id/tasks | `tasks.ts:16` | 🔴 Critical | Type mismatch |
| 3b | UUID cast failure — 500 on create | POST /cases/:id/tasks | `tasks.ts:34` | 🔴 Critical | Type mismatch |
| 4 | Wrong PATCH URL | PATCH /api/tasks/:id | `case-detail.tsx:678` | 🔴 Critical | Route mismatch |
| 5 | Tenant resolution failure | GET /api/copilot/snapshot | `copilot.ts:56` | 🔴 Critical | Auth middleware |
| 6 | AI table lazy-created | GET /cases/:id/ai-insights | `case.ai.ts:264` | 🟡 Minor | DB init order |

---

*تم إنشاء هذا التقرير بناءً على: Static code analysis + PostgreSQL schema inspection + runtime log analysis*
