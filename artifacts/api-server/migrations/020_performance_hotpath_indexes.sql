-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 020: High-impact hot-path performance indexes (Stage 10.7)
--
-- CREATE INDEX ONLY — no table/column DDL, no drops, no API changes.
--
-- Evidence sources (repo query patterns, not production EXPLAIN):
--   - GET /conversations CTE list (conversation_id + created_at DESC)
--   - GET /storage/folders batch ACL (folder_permissions.user_id)
--   - HR leave-balances / payroll generate (employees status, leaves, payroll)
--   - Case detail / dashboard event + message lookups (events.case_id,
--     office_messages.case_id / office_id / sender_id)
--   - Conversation membership joins (conversation_members.user_id)
--
-- Formalizes indexes previously created only via Runtime DDL where those
-- names/definitions already match boot-time ensure* helpers (IF NOT EXISTS).
--
-- Apply AFTER: … → 016 → 017 → 018 → 019
-- Idempotent / legacy-safe: each index is guarded by table (+ column) existence.
-- Do NOT apply via Runtime DDL / drizzle-kit push.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- Helper: create index only when relation + required columns exist
CREATE OR REPLACE FUNCTION pg_temp.create_index_020(
  idx_name text,
  ddl text,
  rel text,
  cols text[]
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  missing boolean := false;
  c text;
BEGIN
  IF to_regclass('public.' || rel) IS NULL THEN
    RAISE NOTICE '020_indexes: skipping % — table % missing', idx_name, rel;
    RETURN;
  END IF;

  FOREACH c IN ARRAY cols LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = rel
        AND column_name = c
    ) THEN
      missing := true;
      RAISE NOTICE '020_indexes: skipping % — %.% missing', idx_name, rel, c;
    END IF;
  END LOOP;

  IF missing THEN
    RETURN;
  END IF;

  EXECUTE ddl;
END;
$$;

-- ── office_messages (owned by migration 016) ───────────────────────────────
-- Conversations list DISTINCT ON + thread ORDER BY created_at
SELECT pg_temp.create_index_020(
  'idx_office_messages_conversation_created',
  $ddl$
    CREATE INDEX IF NOT EXISTS idx_office_messages_conversation_created
      ON office_messages (conversation_id, created_at DESC)
      WHERE conversation_id IS NOT NULL
  $ddl$,
  'office_messages',
  ARRAY['conversation_id', 'created_at']
);

-- Dashboard / analytics recent messages by tenant
SELECT pg_temp.create_index_020(
  'idx_msgs_office_date',
  $ddl$
    CREATE INDEX IF NOT EXISTS idx_msgs_office_date
      ON office_messages (office_id, created_at DESC)
  $ddl$,
  'office_messages',
  ARRAY['office_id', 'created_at']
);

-- Sent/draft folder counts by sender
SELECT pg_temp.create_index_020(
  'idx_msgs_sender_date',
  $ddl$
    CREATE INDEX IF NOT EXISTS idx_msgs_sender_date
      ON office_messages (sender_id, created_at DESC)
  $ddl$,
  'office_messages',
  ARRAY['sender_id', 'created_at']
);

-- Case detail message counts / case messaging
SELECT pg_temp.create_index_020(
  'idx_messages_case_id',
  $ddl$
    CREATE INDEX IF NOT EXISTS idx_messages_case_id
      ON office_messages (case_id)
      WHERE case_id IS NOT NULL
  $ddl$,
  'office_messages',
  ARRAY['case_id']
);

-- ── folder_permissions (owned by migration 009) ────────────────────────────
-- GET /storage/folders batch ACL: WHERE user_id = $caller
-- UNIQUE(folder_id, user_id) does not help leading user_id filters.
SELECT pg_temp.create_index_020(
  'idx_folder_permissions_user_id',
  $ddl$
    CREATE INDEX IF NOT EXISTS idx_folder_permissions_user_id
      ON folder_permissions (user_id)
  $ddl$,
  'folder_permissions',
  ARRAY['user_id']
);

-- ── employees / leaves / payroll (baseline 003 + office_id from 001) ───────
-- Active employee filters: WHERE office_id = $tid AND status = 'active'
SELECT pg_temp.create_index_020(
  'idx_employees_office_status',
  $ddl$
    CREATE INDEX IF NOT EXISTS idx_employees_office_status
      ON employees (office_id, status)
  $ddl$,
  'employees',
  ARRAY['office_id', 'status']
);

-- Leave-balance aggregates: approved leaves by employee
SELECT pg_temp.create_index_020(
  'idx_leaves_employee_status',
  $ddl$
    CREATE INDEX IF NOT EXISTS idx_leaves_employee_status
      ON leaves (employee_id, status)
  $ddl$,
  'leaves',
  ARRAY['employee_id', 'status']
);

-- Payroll generate NOT EXISTS (employee_id, month, year)
SELECT pg_temp.create_index_020(
  'idx_payroll_employee_period',
  $ddl$
    CREATE INDEX IF NOT EXISTS idx_payroll_employee_period
      ON payroll (employee_id, month, year)
  $ddl$,
  'payroll',
  ARRAY['employee_id', 'month', 'year']
);

-- ── conversation tables (may exist via Runtime ensureConversationTables) ───
SELECT pg_temp.create_index_020(
  'idx_conv_office',
  $ddl$
    CREATE INDEX IF NOT EXISTS idx_conv_office
      ON message_conversations (office_id)
  $ddl$,
  'message_conversations',
  ARRAY['office_id']
);

SELECT pg_temp.create_index_020(
  'idx_convs_case_id',
  $ddl$
    CREATE INDEX IF NOT EXISTS idx_convs_case_id
      ON message_conversations (case_id)
      WHERE case_id IS NOT NULL
  $ddl$,
  'message_conversations',
  ARRAY['case_id']
);

SELECT pg_temp.create_index_020(
  'idx_conv_members_conv',
  $ddl$
    CREATE INDEX IF NOT EXISTS idx_conv_members_conv
      ON conversation_members (conversation_id)
  $ddl$,
  'conversation_members',
  ARRAY['conversation_id']
);

SELECT pg_temp.create_index_020(
  'idx_conv_members_user',
  $ddl$
    CREATE INDEX IF NOT EXISTS idx_conv_members_user
      ON conversation_members (user_id, office_id)
  $ddl$,
  'conversation_members',
  ARRAY['user_id', 'office_id']
);

-- ── recipients / attachments (Runtime tables; indexes match boot extras) ───
SELECT pg_temp.create_index_020(
  'idx_rcpt_msg',
  $ddl$
    CREATE INDEX IF NOT EXISTS idx_rcpt_msg
      ON office_message_recipients (message_id)
  $ddl$,
  'office_message_recipients',
  ARRAY['message_id']
);

SELECT pg_temp.create_index_020(
  'idx_rcpt_user_unread',
  $ddl$
    CREATE INDEX IF NOT EXISTS idx_rcpt_user_unread
      ON office_message_recipients (user_id, is_read)
      WHERE is_read = FALSE
  $ddl$,
  'office_message_recipients',
  ARRAY['user_id', 'is_read']
);

SELECT pg_temp.create_index_020(
  'idx_attach_msg',
  $ddl$
    CREATE INDEX IF NOT EXISTS idx_attach_msg
      ON office_message_attachments (message_id)
  $ddl$,
  'office_message_attachments',
  ARRAY['message_id']
);

-- ── events (calendar / case detail; table may be Runtime-created) ──────────
SELECT pg_temp.create_index_020(
  'idx_events_case_id',
  $ddl$
    CREATE INDEX IF NOT EXISTS idx_events_case_id
      ON events (case_id)
  $ddl$,
  'events',
  ARRAY['case_id']
);

SELECT pg_temp.create_index_020(
  'idx_events_office_start',
  $ddl$
    CREATE INDEX IF NOT EXISTS idx_events_office_start
      ON events (office_id, start_at)
  $ddl$,
  'events',
  ARRAY['office_id', 'start_at']
);

COMMIT;
