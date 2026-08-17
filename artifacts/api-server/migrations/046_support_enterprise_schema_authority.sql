-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 046: Support Enterprise Runtime DDL schema authority (Stage 7)
--
-- Owns the still-executable Runtime DDL from
-- support-enterprise.ensureEnterpriseSchema:
--   A) support_tickets EXTENSIONS (office_id, case_id, invoice_id,
--      conversation_id, visitor_id, visitor_phone, department,
--      assigned_to_name, internal_notes, source, sla_response_deadline,
--      sla_resolution_deadline, first_response_at, closed_at, reopened_at,
--      waiting_since, tags, satisfaction_score, ai_score) — all nullable,
--      base table itself owned by Migration 003 (never recreated here)
--   B) support_ticket_attachments — satellite (+ FK CASCADE to
--      support_tickets(id))
--   C) support_ticket_audit — satellite (no invented FK/UNIQUE)
--   D) support_visitor_profiles — satellite (+ UNIQUE(email), nullable —
--      allows multiple NULLs)
--   E) Indexes (7): idx_st_user, idx_st_status, idx_st_office,
--      idx_st_sla_res (partial), idx_sta_ticket, idx_stau_ticket,
--      idx_sm_ticket (on support_messages, owned by Migration 003)
--
-- Does NOT CREATE / own: support_tickets or support_messages base tables
-- (Migration 003), support_ai_analysis / support_knowledge_base (Migration
-- 045 — analysis/KB surface). No DROP TABLE, no DELETE, no office_id
-- backfill, no invented UNIQUE/FK beyond this exact contract.
--
-- ticket_id (TEXT) is never UUID-validated — it is a business key shared
-- with the 003 support_tickets.id shape.
--
-- Idempotent. No DROP TABLE / DROP INDEX. Fail-closed on orphans and on
-- wrong-shape existing constraints/indexes (never silently repaired).
-- Post-apply readiness must pass before COMMIT.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── A) CREATE satellites (idempotent skeletons; FK/UNIQUE added later) ─────
-- ticket_id is NOT NULL but intentionally has NO inline REFERENCES here —
-- the FK is probed for orphans/wrong-shape and added explicitly further
-- below (schema-authority precedent: 038's client_sessions/client_case_links).
CREATE TABLE IF NOT EXISTS support_ticket_attachments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   TEXT NOT NULL,
  file_name   TEXT NOT NULL,
  file_url    TEXT NOT NULL,
  file_size   INTEGER DEFAULT 0,
  file_type   TEXT,
  uploaded_by TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_ticket_audit (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  TEXT NOT NULL,
  user_id    TEXT,
  user_name  TEXT,
  action     TEXT NOT NULL,
  old_value  TEXT,
  new_value  TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_visitor_profiles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT UNIQUE,
  phone        TEXT,
  name         TEXT NOT NULL,
  first_visit  TIMESTAMPTZ DEFAULT NOW(),
  last_visit   TIMESTAMPTZ DEFAULT NOW(),
  ticket_count INTEGER DEFAULT 1
);

-- ── B) ALTER ADD columns — support_tickets EXTENSIONS ───────────────────────
-- Base table guard: 003 owns support_tickets; 046 cannot invent it.
DO $$
BEGIN
  IF to_regclass('public.support_tickets') IS NULL THEN
    RAISE EXCEPTION
      '046_support_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=MISSING_BASE_TABLE) — support_tickets missing (owned by Migration 003; 046 cannot invent it)';
  END IF;
END $$;

ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS case_id TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS invoice_id TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS conversation_id TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS visitor_id TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS visitor_phone TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS assigned_to_name TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS sla_response_deadline TIMESTAMPTZ;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS sla_resolution_deadline TIMESTAMPTZ;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMPTZ;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS waiting_since TIMESTAMPTZ;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS satisfaction_score INTEGER;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS ai_score NUMERIC(4,2);

-- ── C) ALTER ADD columns — satellites (partial-schema repair) ──────────────
ALTER TABLE support_ticket_attachments ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE support_ticket_attachments ADD COLUMN IF NOT EXISTS ticket_id TEXT;
ALTER TABLE support_ticket_attachments ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE support_ticket_attachments ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE support_ticket_attachments ADD COLUMN IF NOT EXISTS file_size INTEGER;
ALTER TABLE support_ticket_attachments ADD COLUMN IF NOT EXISTS file_type TEXT;
ALTER TABLE support_ticket_attachments ADD COLUMN IF NOT EXISTS uploaded_by TEXT;
ALTER TABLE support_ticket_attachments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE support_ticket_audit ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE support_ticket_audit ADD COLUMN IF NOT EXISTS ticket_id TEXT;
ALTER TABLE support_ticket_audit ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE support_ticket_audit ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE support_ticket_audit ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE support_ticket_audit ADD COLUMN IF NOT EXISTS old_value TEXT;
ALTER TABLE support_ticket_audit ADD COLUMN IF NOT EXISTS new_value TEXT;
ALTER TABLE support_ticket_audit ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE support_ticket_audit ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE support_visitor_profiles ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE support_visitor_profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE support_visitor_profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE support_visitor_profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE support_visitor_profiles ADD COLUMN IF NOT EXISTS first_visit TIMESTAMPTZ;
ALTER TABLE support_visitor_profiles ADD COLUMN IF NOT EXISTS last_visit TIMESTAMPTZ;
ALTER TABLE support_visitor_profiles ADD COLUMN IF NOT EXISTS ticket_count INTEGER;

-- ═══════════════════════════════════════════════════════════════════════════
-- Type validation + NULL required probes
-- support_tickets EXTENSIONS are all nullable (never SET NOT NULL below);
-- only satellite required columns are probed for NULLs here.
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  spec RECORD;
  actual_udt TEXT;
  null_cnt BIGINT;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('support_tickets','office_id','text'),
      ('support_tickets','case_id','text'),
      ('support_tickets','invoice_id','text'),
      ('support_tickets','conversation_id','text'),
      ('support_tickets','visitor_id','text'),
      ('support_tickets','visitor_phone','text'),
      ('support_tickets','department','text'),
      ('support_tickets','assigned_to_name','text'),
      ('support_tickets','internal_notes','text'),
      ('support_tickets','source','text'),
      ('support_tickets','sla_response_deadline','timestamptz'),
      ('support_tickets','sla_resolution_deadline','timestamptz'),
      ('support_tickets','first_response_at','timestamptz'),
      ('support_tickets','closed_at','timestamptz'),
      ('support_tickets','reopened_at','timestamptz'),
      ('support_tickets','waiting_since','timestamptz'),
      ('support_tickets','tags','_text'),
      ('support_tickets','satisfaction_score','int4'),
      ('support_tickets','ai_score','numeric'),
      ('support_ticket_attachments','id','uuid'),
      ('support_ticket_attachments','ticket_id','text'),
      ('support_ticket_attachments','file_name','text'),
      ('support_ticket_attachments','file_url','text'),
      ('support_ticket_attachments','file_size','int4'),
      ('support_ticket_attachments','file_type','text'),
      ('support_ticket_attachments','uploaded_by','text'),
      ('support_ticket_attachments','created_at','timestamptz'),
      ('support_ticket_audit','id','uuid'),
      ('support_ticket_audit','ticket_id','text'),
      ('support_ticket_audit','user_id','text'),
      ('support_ticket_audit','user_name','text'),
      ('support_ticket_audit','action','text'),
      ('support_ticket_audit','old_value','text'),
      ('support_ticket_audit','new_value','text'),
      ('support_ticket_audit','ip_address','text'),
      ('support_ticket_audit','created_at','timestamptz'),
      ('support_visitor_profiles','id','uuid'),
      ('support_visitor_profiles','email','text'),
      ('support_visitor_profiles','phone','text'),
      ('support_visitor_profiles','name','text'),
      ('support_visitor_profiles','first_visit','timestamptz'),
      ('support_visitor_profiles','last_visit','timestamptz'),
      ('support_visitor_profiles','ticket_count','int4')
    ) AS t(table_name, column_name, udt_name)
  LOOP
    SELECT c.udt_name INTO actual_udt
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = spec.table_name
      AND c.column_name = spec.column_name;
    IF actual_udt IS NULL OR actual_udt IS DISTINCT FROM spec.udt_name THEN
      RAISE EXCEPTION
        '046_support_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — %.% has udt %, expected %',
        spec.table_name, spec.column_name, coalesce(actual_udt, '<missing>'), spec.udt_name;
    END IF;
  END LOOP;

  SELECT COUNT(*) INTO null_cnt FROM support_ticket_attachments
  WHERE id IS NULL OR ticket_id IS NULL OR file_name IS NULL
    OR file_url IS NULL OR uploaded_by IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION
      '046_support_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — support_ticket_attachments has % NULL required row(s)',
      null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM support_ticket_audit
  WHERE id IS NULL OR ticket_id IS NULL OR action IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION
      '046_support_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — support_ticket_audit has % NULL required row(s)',
      null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM support_visitor_profiles
  WHERE id IS NULL OR name IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION
      '046_support_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — support_visitor_profiles has % NULL required row(s)',
      null_cnt;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Orphan FK probe (support_ticket_attachments.ticket_id → support_tickets.id)
-- BLOCK on orphans or wrong-shape existing constraint. Rows are preserved —
-- never deleted. The actual ADD CONSTRAINT happens later (FK CASCADE
-- section) once every other blocker has also been cleared.
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  child_attnum INT2;
  ref_attnum INT2;
  orphan_cnt BIGINT;
BEGIN
  SELECT a.attnum INTO child_attnum
  FROM pg_attribute a
  WHERE a.attrelid = 'public.support_ticket_attachments'::regclass
    AND a.attname = 'ticket_id' AND NOT a.attisdropped;
  SELECT a.attnum INTO ref_attnum
  FROM pg_attribute a
  WHERE a.attrelid = 'public.support_tickets'::regclass
    AND a.attname = 'id' AND NOT a.attisdropped;

  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.support_ticket_attachments'::regclass
      AND c.contype = 'f'
      AND c.conname = 'support_ticket_attachments_ticket_id_fkey'
      AND NOT (
        EXISTS (SELECT 1 FROM pg_class ref WHERE ref.oid = c.confrelid AND ref.relname = 'support_tickets')
        AND c.confdeltype = 'c'
        AND array_length(c.conkey, 1) = 1 AND c.conkey[1] = child_attnum
        AND array_length(c.confkey, 1) = 1 AND c.confkey[1] = ref_attnum
      )
  ) THEN
    RAISE EXCEPTION
      '046_support_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_FK) — support_ticket_attachments_ticket_id_fkey wrong shape (expected CASCADE to support_tickets(id))';
  END IF;

  SELECT COUNT(*) INTO orphan_cnt FROM support_ticket_attachments a
  WHERE a.ticket_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM support_tickets t WHERE t.id = a.ticket_id);
  IF orphan_cnt > 0 THEN
    RAISE EXCEPTION
      '046_support_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=ORPHAN_FK) — support_ticket_attachments has % orphan ticket_id row(s) referencing support_tickets (rows preserved, no delete)',
      orphan_cnt;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Duplicate email probe (support_visitor_profiles) — non-null groups only.
-- NULL email is allowed multiple times (WHERE email IS NOT NULL excludes them).
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  dup_cnt BIGINT;
BEGIN
  SELECT COUNT(*) INTO dup_cnt FROM (
    SELECT email FROM support_visitor_profiles
    WHERE email IS NOT NULL
    GROUP BY email HAVING COUNT(*) > 1
  ) d;
  IF dup_cnt > 0 THEN
    RAISE EXCEPTION
      '046_support_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=DUPLICATE_UNIQUE_KEY) — % duplicate non-null email group(s) on support_visitor_profiles',
      dup_cnt;
  END IF;
END $$;

-- Safe defaults (exact Runtime)
ALTER TABLE support_tickets ALTER COLUMN source SET DEFAULT 'user';
ALTER TABLE support_tickets ALTER COLUMN tags SET DEFAULT '{}';

ALTER TABLE support_ticket_attachments ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE support_ticket_attachments ALTER COLUMN file_size SET DEFAULT 0;
ALTER TABLE support_ticket_attachments ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE support_ticket_audit ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE support_ticket_audit ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE support_visitor_profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE support_visitor_profiles ALTER COLUMN first_visit SET DEFAULT NOW();
ALTER TABLE support_visitor_profiles ALTER COLUMN last_visit SET DEFAULT NOW();
ALTER TABLE support_visitor_profiles ALTER COLUMN ticket_count SET DEFAULT 1;

-- SET NOT NULL after NULL probes above (satellites only — support_tickets
-- EXTENSIONS remain nullable per Runtime contract; never SET NOT NULL here).
DO $$
BEGIN
  ALTER TABLE support_ticket_attachments ALTER COLUMN id SET NOT NULL;
  ALTER TABLE support_ticket_attachments ALTER COLUMN ticket_id SET NOT NULL;
  ALTER TABLE support_ticket_attachments ALTER COLUMN file_name SET NOT NULL;
  ALTER TABLE support_ticket_attachments ALTER COLUMN file_url SET NOT NULL;
  ALTER TABLE support_ticket_attachments ALTER COLUMN uploaded_by SET NOT NULL;

  ALTER TABLE support_ticket_audit ALTER COLUMN id SET NOT NULL;
  ALTER TABLE support_ticket_audit ALTER COLUMN ticket_id SET NOT NULL;
  ALTER TABLE support_ticket_audit ALTER COLUMN action SET NOT NULL;

  ALTER TABLE support_visitor_profiles ALTER COLUMN id SET NOT NULL;
  ALTER TABLE support_visitor_profiles ALTER COLUMN name SET NOT NULL;
END $$;

-- PK (id) repair for all three owned satellites
DO $$
DECLARE
  has_pk BOOLEAN;
  null_cnt BIGINT;
  dup_cnt BIGINT;
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'support_ticket_attachments','support_ticket_audit','support_visitor_profiles'
  ]
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = format('public.%I', tbl)::regclass AND c.contype = 'p'
    ) INTO has_pk;
    IF NOT has_pk THEN
      EXECUTE format('SELECT COUNT(*) FROM %I WHERE id IS NULL', tbl) INTO null_cnt;
      IF null_cnt > 0 THEN
        RAISE EXCEPTION '046_support_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — NULL id blocks PK on %', tbl;
      END IF;
      EXECUTE format('SELECT COUNT(*) FROM (SELECT id FROM %I GROUP BY id HAVING COUNT(*) > 1) d', tbl)
        INTO dup_cnt;
      IF dup_cnt > 0 THEN
        RAISE EXCEPTION '046_support_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — duplicate id blocks PK on %', tbl;
      END IF;
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I PRIMARY KEY (id)', tbl, tbl || '_pkey');
    ELSIF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = format('public.%I', tbl)::regclass AND c.contype = 'p'
        AND pg_get_constraintdef(c.oid) ~* '\(id\)'
        AND pg_get_constraintdef(c.oid) !~* ','
    ) THEN
      RAISE EXCEPTION '046_support_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — % PK is not solely (id)', tbl;
    END IF;
  END LOOP;
END $$;

-- ── UNIQUE(email) on support_visitor_profiles ───────────────────────────────
-- Exact single-column UNIQUE only. Same-name wrong shape, wider/near-miss,
-- expression, or invalid/not-ready/partial index → BLOCK. NULL emails are
-- never counted (standard UNIQUE semantics allow multiple NULLs).
DO $$
DECLARE
  has_uq BOOLEAN;
  near_miss_uq BOOLEAN := false;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.support_visitor_profiles'::regclass AND c.contype = 'u'
      AND c.conname = 'support_visitor_profiles_email_key'
      AND (
        pg_get_constraintdef(c.oid) !~* 'UNIQUE\s*\(\s*email\s*\)'
        OR pg_get_constraintdef(c.oid) ~* ','
      )
  ) THEN
    RAISE EXCEPTION '046_support_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — support_visitor_profiles_email_key wrong shape';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.support_visitor_profiles'::regclass AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*email\s*\)'
      AND pg_get_constraintdef(c.oid) !~* ','
  ) OR EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid = 'public.support_visitor_profiles'::regclass
      AND x.indisunique AND NOT x.indisprimary
      AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
      AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
           FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
           JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
          = ARRAY['email']::text[]
  ) INTO has_uq;

  IF EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid = 'public.support_visitor_profiles'::regclass
      AND x.indisunique AND NOT x.indisprimary
      AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
           FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
           JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
          = ARRAY['email']::text[]
      AND (
        x.indisvalid IS DISTINCT FROM TRUE OR x.indisready IS DISTINCT FROM TRUE
        OR x.indpred IS NOT NULL OR x.indexprs IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION '046_support_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — support_visitor_profiles UNIQUE(email) index invalid/not-ready/partial/expression';
  END IF;

  IF NOT has_uq THEN
    SELECT EXISTS (
      SELECT 1
      FROM pg_index x
      CROSS JOIN LATERAL (
        SELECT array_agg(a.attname::text ORDER BY k.ordinality) AS cols
        FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
        JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped
      ) c
      WHERE x.indrelid = 'public.support_visitor_profiles'::regclass
        AND x.indisunique AND NOT x.indisprimary
        AND cardinality(c.cols) > 1
        AND ARRAY['email']::text[] <@ c.cols
    ) INTO near_miss_uq;
    IF near_miss_uq THEN
      RAISE EXCEPTION '046_support_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — support_visitor_profiles has wider UNIQUE containing email; exact UNIQUE(email) required';
    END IF;
  END IF;

  IF NOT has_uq AND EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid = 'public.support_visitor_profiles'::regclass
      AND x.indisunique AND NOT x.indisprimary
      AND x.indexprs IS NOT NULL
      AND pg_get_indexdef(x.indexrelid) ~* 'email'
  ) THEN
    RAISE EXCEPTION '046_support_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — support_visitor_profiles has expression UNIQUE involving email; exact UNIQUE(email) required';
  END IF;

  IF NOT has_uq THEN
    ALTER TABLE support_visitor_profiles ADD CONSTRAINT support_visitor_profiles_email_key UNIQUE (email);
  END IF;
END $$;

-- ── FK CASCADE (support_ticket_attachments.ticket_id → support_tickets.id) ─
-- Orphans/wrong-shape were already probed above (fail-closed); this section
-- performs the actual ADD CONSTRAINT (or VALIDATE CONSTRAINT if a correct
-- but not-yet-validated constraint already exists). Exact CASCADE required.
DO $$
DECLARE
  fk_ok BOOLEAN;
  orphan_cnt BIGINT;
  child_attnum INT2;
  ref_attnum INT2;
BEGIN
  SELECT a.attnum INTO child_attnum
  FROM pg_attribute a
  WHERE a.attrelid = 'public.support_ticket_attachments'::regclass
    AND a.attname = 'ticket_id' AND NOT a.attisdropped;
  SELECT a.attnum INTO ref_attnum
  FROM pg_attribute a
  WHERE a.attrelid = 'public.support_tickets'::regclass
    AND a.attname = 'id' AND NOT a.attisdropped;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class ref ON ref.oid = c.confrelid
    WHERE c.conrelid = 'public.support_ticket_attachments'::regclass
      AND c.contype = 'f'
      AND c.conname = 'support_ticket_attachments_ticket_id_fkey'
      AND ref.relname = 'support_tickets'
      AND c.confdeltype = 'c'
      AND c.convalidated
      AND array_length(c.conkey, 1) = 1 AND c.conkey[1] = child_attnum
      AND array_length(c.confkey, 1) = 1 AND c.confkey[1] = ref_attnum
  ) INTO fk_ok;

  IF fk_ok THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.support_ticket_attachments'::regclass
      AND c.contype = 'f'
      AND c.conname = 'support_ticket_attachments_ticket_id_fkey'
      AND NOT (
        EXISTS (SELECT 1 FROM pg_class ref WHERE ref.oid = c.confrelid AND ref.relname = 'support_tickets')
        AND c.confdeltype = 'c'
        AND array_length(c.conkey, 1) = 1 AND c.conkey[1] = child_attnum
        AND array_length(c.confkey, 1) = 1 AND c.confkey[1] = ref_attnum
      )
  ) THEN
    RAISE EXCEPTION
      '046_support_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_FK) — support_ticket_attachments_ticket_id_fkey wrong shape';
  END IF;

  SELECT COUNT(*) INTO orphan_cnt FROM support_ticket_attachments c
  WHERE c.ticket_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM support_tickets p WHERE p.id = c.ticket_id);
  IF orphan_cnt > 0 THEN
    RAISE EXCEPTION
      '046_support_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=ORPHAN_FK) — support_ticket_attachments has % orphan ticket_id row(s) referencing support_tickets',
      orphan_cnt;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.support_ticket_attachments'::regclass
      AND c.contype = 'f'
      AND c.conname = 'support_ticket_attachments_ticket_id_fkey'
  ) THEN
    ALTER TABLE support_ticket_attachments
      ADD CONSTRAINT support_ticket_attachments_ticket_id_fkey
      FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE;
  ELSE
    ALTER TABLE support_ticket_attachments VALIDATE CONSTRAINT support_ticket_attachments_ticket_id_fkey;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Indexes (7) — global name probe (039/037 pattern). Stolen name on another
-- relation / wrong columns / wrong DESC bits / wrong partial predicate →
-- INCOMPATIBLE_INDEX BLOCK before any CREATE attempt. No DROP INDEX ever.
-- desc_bits[i] = 1 means DESC (indoption bit0=1); 0 means ASC (bit0=0).
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  spec RECORD;
  expected_table_oid OID;
  actual_table_oid OID;
  index_unique BOOLEAN;
  index_partial BOOLEAN;
  index_expression BOOLEAN;
  index_valid BOOLEAN;
  index_ready BOOLEAN;
  index_columns TEXT[];
  index_options INT[];
  index_pred TEXT;
  desc_ok BOOLEAN;
  pred_ok BOOLEAN;
  opt_i INT;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('idx_st_user','support_tickets',ARRAY['user_id']::text[],ARRAY[0]::int[],FALSE,NULL::text,
        'CREATE INDEX IF NOT EXISTS idx_st_user ON support_tickets (user_id)'),
      ('idx_st_status','support_tickets',ARRAY['status','created_at']::text[],ARRAY[0,1]::int[],FALSE,NULL::text,
        'CREATE INDEX IF NOT EXISTS idx_st_status ON support_tickets (status, created_at DESC)'),
      ('idx_st_office','support_tickets',ARRAY['office_id','status']::text[],ARRAY[0,0]::int[],FALSE,NULL::text,
        'CREATE INDEX IF NOT EXISTS idx_st_office ON support_tickets (office_id, status)'),
      ('idx_st_sla_res','support_tickets',ARRAY['sla_resolution_deadline']::text[],ARRAY[0]::int[],TRUE,'closed_resolved',
        $c$CREATE INDEX IF NOT EXISTS idx_st_sla_res ON support_tickets (sla_resolution_deadline) WHERE status NOT IN ('closed','resolved')$c$),
      ('idx_sta_ticket','support_ticket_attachments',ARRAY['ticket_id']::text[],ARRAY[0]::int[],FALSE,NULL::text,
        'CREATE INDEX IF NOT EXISTS idx_sta_ticket ON support_ticket_attachments (ticket_id)'),
      ('idx_stau_ticket','support_ticket_audit',ARRAY['ticket_id','created_at']::text[],ARRAY[0,1]::int[],FALSE,NULL::text,
        'CREATE INDEX IF NOT EXISTS idx_stau_ticket ON support_ticket_audit (ticket_id, created_at DESC)'),
      ('idx_sm_ticket','support_messages',ARRAY['ticket_id','created_at']::text[],ARRAY[0,0]::int[],FALSE,NULL::text,
        'CREATE INDEX IF NOT EXISTS idx_sm_ticket ON support_messages (ticket_id, created_at ASC)')
    ) AS t(index_name, table_name, columns, desc_bits, expect_partial, partial_kind, create_sql)
  LOOP
    expected_table_oid := to_regclass(format('public.%I', spec.table_name));

    SELECT x.indrelid, x.indisunique, x.indpred IS NOT NULL, x.indexprs IS NOT NULL,
      x.indisvalid, x.indisready,
      (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
       FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
       LEFT JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped),
      (SELECT array_agg(o::int ORDER BY k.ordinality)
       FROM unnest(x.indoption) WITH ORDINALITY AS k(o, ordinality)),
      pg_get_expr(x.indpred, x.indrelid)
    INTO actual_table_oid, index_unique, index_partial, index_expression,
      index_valid, index_ready, index_columns, index_options, index_pred
    FROM pg_class i
    JOIN pg_namespace n ON n.oid=i.relnamespace
    LEFT JOIN pg_index x ON x.indexrelid=i.oid
    WHERE n.nspname='public' AND i.relname=spec.index_name;

    IF FOUND THEN
      desc_ok := true;
      IF index_options IS NULL OR cardinality(index_options) IS DISTINCT FROM cardinality(spec.desc_bits) THEN
        desc_ok := false;
      ELSE
        FOR opt_i IN 1 .. cardinality(spec.desc_bits) LOOP
          IF (index_options[opt_i] & 1) IS DISTINCT FROM spec.desc_bits[opt_i] THEN
            desc_ok := false;
          END IF;
        END LOOP;
      END IF;

      pred_ok := true;
      IF spec.expect_partial AND spec.partial_kind = 'closed_resolved' THEN
        -- Postgres canonicalizes "status NOT IN ('closed','resolved')" to
        -- "status <> ALL (ARRAY['closed','resolved'])" internally — accept
        -- either surface form as long as both literals are negated on status.
        pred_ok := coalesce(index_pred,'') ~* 'status'
          AND coalesce(index_pred,'') ~* 'closed'
          AND coalesce(index_pred,'') ~* 'resolved'
          AND (coalesce(index_pred,'') ~* 'not\s+in' OR coalesce(index_pred,'') ~* '<>\s*all');
      END IF;

      IF actual_table_oid IS DISTINCT FROM expected_table_oid
         OR index_unique IS DISTINCT FROM FALSE
         OR index_partial IS DISTINCT FROM spec.expect_partial
         OR index_expression IS DISTINCT FROM FALSE
         OR index_valid IS DISTINCT FROM TRUE
         OR index_ready IS DISTINCT FROM TRUE
         OR index_columns IS DISTINCT FROM spec.columns
         OR desc_ok IS NOT TRUE
         OR pred_ok IS NOT TRUE THEN
        RAISE EXCEPTION
          '046_support_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_INDEX) — % incompatible (table_oid=% expected_oid=% cols=% opts=% partial=% pred=%). No DROP INDEX.',
          spec.index_name, actual_table_oid, expected_table_oid, index_columns,
          index_options, index_partial, coalesce(index_pred,'<none>');
      END IF;
      -- Exact match already present — leave alone.
    ELSE
      IF expected_table_oid IS NULL THEN
        RAISE EXCEPTION
          '046_support_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=MISSING_BASE_TABLE) — index % needs table %',
          spec.index_name, spec.table_name;
      END IF;
      EXECUTE spec.create_sql;
    END IF;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Post-apply readiness — must pass before COMMIT
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  tbl TEXT;
  child_attnum INT2;
  ref_attnum INT2;
  spec RECORD;
  index_columns TEXT[];
  index_options INT[];
  index_partial BOOLEAN;
  index_pred TEXT;
  desc_ok BOOLEAN;
  pred_ok BOOLEAN;
  opt_i INT;
BEGIN
  IF to_regclass('public.support_tickets') IS NULL THEN
    RAISE EXCEPTION '046_support_enterprise: POST_APPLY_READINESS_FAILED — missing base table support_tickets';
  END IF;

  FOREACH tbl IN ARRAY ARRAY[
    'support_ticket_attachments','support_ticket_audit','support_visitor_profiles'
  ]
  LOOP
    IF to_regclass(format('public.%I', tbl)) IS NULL THEN
      RAISE EXCEPTION '046_support_enterprise: POST_APPLY_READINESS_FAILED — missing table %', tbl;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid=format('public.%I',tbl)::regclass AND c.contype='p'
        AND pg_get_constraintdef(c.oid) ~* '\(id\)' AND pg_get_constraintdef(c.oid) !~* ','
    ) THEN
      RAISE EXCEPTION '046_support_enterprise: POST_APPLY_READINESS_FAILED — % PK (id) missing or incompatible', tbl;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='support_tickets' AND column_name='office_id'
      AND udt_name='text'
  ) THEN
    RAISE EXCEPTION '046_support_enterprise: POST_APPLY_READINESS_FAILED — support_tickets.office_id TEXT missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='support_tickets' AND column_name='tags'
      AND udt_name='_text'
  ) THEN
    RAISE EXCEPTION '046_support_enterprise: POST_APPLY_READINESS_FAILED — support_tickets.tags TEXT[] missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='support_tickets' AND column_name='ai_score'
      AND udt_name='numeric'
  ) THEN
    RAISE EXCEPTION '046_support_enterprise: POST_APPLY_READINESS_FAILED — support_tickets.ai_score NUMERIC missing';
  END IF;

  -- UNIQUE(email)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.support_visitor_profiles'::regclass AND c.contype='u'
      AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*email\s*\)'
      AND pg_get_constraintdef(c.oid) !~* ','
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid='public.support_visitor_profiles'::regclass
      AND x.indisunique AND NOT x.indisprimary
      AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
      AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
           FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
           JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
          = ARRAY['email']::text[]
  ) THEN
    RAISE EXCEPTION '046_support_enterprise: POST_APPLY_READINESS_FAILED — support_visitor_profiles UNIQUE(email) missing';
  END IF;

  -- FK CASCADE validated
  SELECT a.attnum INTO child_attnum
  FROM pg_attribute a
  WHERE a.attrelid = 'public.support_ticket_attachments'::regclass
    AND a.attname = 'ticket_id' AND NOT a.attisdropped;
  SELECT a.attnum INTO ref_attnum
  FROM pg_attribute a
  WHERE a.attrelid = 'public.support_tickets'::regclass
    AND a.attname = 'id' AND NOT a.attisdropped;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class ref ON ref.oid = c.confrelid
    WHERE c.conrelid = 'public.support_ticket_attachments'::regclass
      AND c.contype = 'f'
      AND c.conname = 'support_ticket_attachments_ticket_id_fkey'
      AND ref.relname = 'support_tickets'
      AND c.confdeltype = 'c'
      AND c.convalidated
      AND array_length(c.conkey, 1) = 1 AND c.conkey[1] = child_attnum
      AND array_length(c.confkey, 1) = 1 AND c.confkey[1] = ref_attnum
  ) THEN
    RAISE EXCEPTION '046_support_enterprise: POST_APPLY_READINESS_FAILED — support_ticket_attachments_ticket_id_fkey missing or not validated';
  END IF;

  -- All 7 indexes present with correct shape
  FOR spec IN
    SELECT * FROM (VALUES
      ('idx_st_user','support_tickets',ARRAY['user_id']::text[],ARRAY[0]::int[],FALSE,NULL::text),
      ('idx_st_status','support_tickets',ARRAY['status','created_at']::text[],ARRAY[0,1]::int[],FALSE,NULL::text),
      ('idx_st_office','support_tickets',ARRAY['office_id','status']::text[],ARRAY[0,0]::int[],FALSE,NULL::text),
      ('idx_st_sla_res','support_tickets',ARRAY['sla_resolution_deadline']::text[],ARRAY[0]::int[],TRUE,'closed_resolved'),
      ('idx_sta_ticket','support_ticket_attachments',ARRAY['ticket_id']::text[],ARRAY[0]::int[],FALSE,NULL::text),
      ('idx_stau_ticket','support_ticket_audit',ARRAY['ticket_id','created_at']::text[],ARRAY[0,1]::int[],FALSE,NULL::text),
      ('idx_sm_ticket','support_messages',ARRAY['ticket_id','created_at']::text[],ARRAY[0,0]::int[],FALSE,NULL::text)
    ) AS t(index_name, table_name, columns, desc_bits, expect_partial, partial_kind)
  LOOP
    index_columns := NULL; index_options := NULL; index_partial := NULL; index_pred := NULL;
    SELECT
      (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
       FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
       JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped),
      (SELECT array_agg(o::int ORDER BY k.ordinality)
       FROM unnest(x.indoption) WITH ORDINALITY AS k(o, ordinality)),
      x.indpred IS NOT NULL,
      pg_get_expr(x.indpred, x.indrelid)
    INTO index_columns, index_options, index_partial, index_pred
    FROM pg_class t
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_index x ON x.indrelid = t.oid
    JOIN pg_class i ON i.oid = x.indexrelid
    WHERE n.nspname='public' AND t.relname=spec.table_name AND i.relname=spec.index_name
      AND x.indisvalid AND x.indisready AND x.indexprs IS NULL
      AND x.indisunique IS DISTINCT FROM TRUE;

    IF index_columns IS NULL THEN
      RAISE EXCEPTION '046_support_enterprise: POST_APPLY_READINESS_FAILED — % missing or wrong binding', spec.index_name;
    END IF;

    desc_ok := true;
    IF index_options IS NULL OR cardinality(index_options) IS DISTINCT FROM cardinality(spec.desc_bits) THEN
      desc_ok := false;
    ELSE
      FOR opt_i IN 1 .. cardinality(spec.desc_bits) LOOP
        IF (index_options[opt_i] & 1) IS DISTINCT FROM spec.desc_bits[opt_i] THEN
          desc_ok := false;
        END IF;
      END LOOP;
    END IF;

    pred_ok := true;
    IF spec.expect_partial AND spec.partial_kind = 'closed_resolved' THEN
      pred_ok := coalesce(index_pred,'') ~* 'status'
        AND coalesce(index_pred,'') ~* 'closed'
        AND coalesce(index_pred,'') ~* 'resolved'
        AND (coalesce(index_pred,'') ~* 'not\s+in' OR coalesce(index_pred,'') ~* '<>\s*all');
    END IF;

    IF index_columns IS DISTINCT FROM spec.columns
       OR index_partial IS DISTINCT FROM spec.expect_partial
       OR desc_ok IS NOT TRUE
       OR pred_ok IS NOT TRUE THEN
      RAISE EXCEPTION
        '046_support_enterprise: POST_APPLY_READINESS_FAILED — % wrong shape (cols=% opts=% partial=% pred=%)',
        spec.index_name, index_columns, index_options, index_partial, coalesce(index_pred,'<none>');
    END IF;
  END LOOP;

  RAISE NOTICE '046_support_enterprise: post-apply FULL READY (reason=SUPPORT_ENTERPRISE_SCHEMA_READY; support_tickets +19 EXTENSIONS; 3 satellites; UNIQUE(email); FK CASCADE; 7 indexes)';
END $$;

COMMIT;
