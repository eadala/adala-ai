-- =============================================================================
-- 023_trial_uuid_offices.sql
-- Stage 15.2c — Legacy trial_* → canonical Office UUID migration
--
-- Converts every existing legacy trial_* tenant into one canonical office_page
-- UUID and remaps trusted tenant-owned TEXT office_id columns by exact old id.
--
-- Trusted ownership ONLY (fail closed — no guessing):
--   Allowed automatic mapping:
--     1) exactly one explicit trial_offices.user_id for that office_id
--     2) exactly one active office_members.role = 'owner'
--     3) after a trusted owner is chosen, reuse an existing UUID office that
--        already belongs to that same owner (no second office_page)
--   Sources (1) and (2) must agree when both present.
--
--   role='admin' is NOT used for automatic ownership.
--   Repository evidence: trial onboarding / provisionOfficeForUser /
--   TENANT-HEAL always INSERT office_members with role='owner' for the
--   trial creator (officeProvision.ts, trialOnboarding paths, tenantMiddleware).
--   No code path assigns the trial creator as 'admin'.
--
--   NOT allowed as automatic ownership:
--     - unique ordinary member (non-owner)
--     - users.office_id alone
--     - earliest member / timestamps / first matching row
--     - current logged-in user / session tenant
--
--   Missing or disagreeing trusted sources → abort BEFORE any office_page
--   insert or business remap (entire transaction rolls back).
--
-- Does NOT:
--   - duplicate Migration 022 NULL-task logic
--   - auto-map office_id = 'default' (reported in legacy_default_office_unresolved)
--   - delete unresolved user data
--   - trust preflight script output (validation is repeated here independently)
--
-- Idempotent: re-run reuses legacy_trial_office_map; UPDATE only exact old ids.
--
-- Rollback (operational — mapping preserved for reverse remap):
--   BEGIN;
--   -- reverse TEXT office_id on remapped tables using legacy_trial_office_map
--   -- UPDATE <tbl> t SET office_id = m.old_office_id
--   --   FROM legacy_trial_office_map m WHERE t.office_id = m.new_office_uuid::text;
--   -- Then restore trial_offices / members / users / onboarding from map;
--   -- Do NOT DROP legacy_trial_office_map or office_page rows without backup.
--   ROLLBACK; -- or COMMIT after verified reverse
--   On migration failure: entire transaction aborts (no partial remap).
--
-- Apply (production ops — not by this agent):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f artifacts/api-server/migrations/023_trial_uuid_offices.sql
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Durable mapping (kept after success for audit / rollback) ───────────────
CREATE TABLE IF NOT EXISTS legacy_trial_office_map (
  old_office_id   TEXT PRIMARY KEY,
  new_office_uuid UUID NOT NULL,
  owner_user_id   TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_legacy_trial_office_map_owner
  ON legacy_trial_office_map (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_legacy_trial_office_map_new
  ON legacy_trial_office_map (new_office_uuid);

-- ── Conflict log (empty on success; retained if ops copy DB mid-failure) ───
CREATE TABLE IF NOT EXISTS legacy_trial_office_conflicts (
  id              BIGSERIAL PRIMARY KEY,
  old_office_id   TEXT,
  conflict_code   TEXT NOT NULL,
  details         JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Unresolved default inventory (never auto-assigned to a tenant) ─────────
CREATE TABLE IF NOT EXISTS legacy_default_office_unresolved (
  id              BIGSERIAL PRIMARY KEY,
  table_name      TEXT NOT NULL,
  row_count       INT NOT NULL DEFAULT 0,
  sample_row_ref  TEXT,
  noted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note            TEXT NOT NULL DEFAULT 'office_id=default left unresolved — no automatic remap'
);

DO $$
DECLARE
  uuid_re CONSTANT TEXT := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  trial_re CONSTANT TEXT := '^trial_';
  r RECORD;
  new_uuid UUID;
  existing_uuid TEXT;
  page_office_name TEXT;
  conflict_count INT := 0;
  remaining INT;
  tbl TEXT;
  col_udt TEXT;
  sql_update TEXT;
  trial_owner TEXT;
  trial_owner_n INT;
  member_owner TEXT;
  member_owner_n INT;
  -- TEXT office_id business tables safe to remap by exact old id
  remap_tables TEXT[] := ARRAY[
    'cases', 'clients', 'contracts', 'client_invoices', 'employees',
    'tasks', 'revenues', 'expenses', 'legal_documents', 'audit_logs',
    'documents', 'arbitration_cases', 'employee_warnings',
    'employee_investigations', 'document_signatures', 'case_timeline',
    'compliance_items', 'ai_agent_logs',
    'office_members', 'trial_offices', 'onboarding_state',
    'system_events',
    'storage_files', 'storage_folders',
    'office_branches', 'office_messages',
    'office_ledger', 'office_erp_ledger', 'financial_anomalies',
    'chart_of_accounts', 'journal_entries', 'journal_items',
    'payment_transactions',
    'bankruptcy_cases', 'bk_creditors', 'bk_claims', 'bk_claim_documents',
    'bk_assets', 'bk_asset_valuations', 'bk_meetings', 'bk_distributions',
    'bk_distribution_items', 'bk_reports', 'bk_ai_analysis', 'bk_timeline',
    'bk_audit_logs', 'bk_notifications', 'bk_workflows', 'bk_workflow_steps',
    'bk_workflow_events', 'bk_tasks', 'bk_task_comments', 'bk_task_assignments',
    'bk_templates', 'bk_alerts', 'bk_opening_requests',
    'bk_opening_request_documents', 'bk_emergency_locks',
    'document_center_files', 'document_ai_metadata', 'rag_chunks',
    'message_conversations', 'conversation_members', 'events',
    'contract_templates', 'contract_instances', 'contract_signatures',
    'contract_obligations'
  ];
  default_tables TEXT[] := ARRAY[
    'cases', 'clients', 'tasks', 'onboarding_state', 'system_events',
    'office_members', 'storage_files', 'documents', 'employees'
  ];
BEGIN
  -- Clear conflict / default report rows from prior failed attempts (map kept)
  DELETE FROM legacy_trial_office_conflicts;
  DELETE FROM legacy_default_office_unresolved;

  -- ═══════════════════════════════════════════════════════════════════════
  -- A) Discover distinct trial_* ids from trusted identity + business sources
  -- ═══════════════════════════════════════════════════════════════════════
  CREATE TEMP TABLE tmp_trial_ids (
    old_office_id TEXT PRIMARY KEY
  ) ON COMMIT DROP;

  INSERT INTO tmp_trial_ids (old_office_id)
  SELECT DISTINCT office_id FROM trial_offices
  WHERE office_id ~* trial_re
  ON CONFLICT DO NOTHING;

  INSERT INTO tmp_trial_ids (old_office_id)
  SELECT DISTINCT office_id FROM office_members
  WHERE office_id ~* trial_re
  ON CONFLICT DO NOTHING;

  INSERT INTO tmp_trial_ids (old_office_id)
  SELECT DISTINCT office_id FROM users
  WHERE office_id ~* trial_re
  ON CONFLICT DO NOTHING;

  INSERT INTO tmp_trial_ids (old_office_id)
  SELECT DISTINCT office_id FROM onboarding_state
  WHERE office_id ~* trial_re
  ON CONFLICT DO NOTHING;

  -- Business tables that exist: collect any remaining trial_* ids
  FOREACH tbl IN ARRAY remap_tables LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN
      CONTINUE;
    END IF;
    SELECT c.udt_name INTO col_udt
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = tbl AND c.column_name = 'office_id';
    IF col_udt IS NULL OR col_udt = 'uuid' THEN
      CONTINUE; -- UUID columns cannot store trial_*; skip
    END IF;
    EXECUTE format(
      'INSERT INTO tmp_trial_ids (old_office_id)
       SELECT DISTINCT office_id::text FROM %I
       WHERE office_id::text ~* %L
       ON CONFLICT DO NOTHING',
      tbl, trial_re
    );
  END LOOP;

  RAISE NOTICE '023_trial: discovered % distinct trial_* office ids',
    (SELECT COUNT(*) FROM tmp_trial_ids);

  -- ═══════════════════════════════════════════════════════════════════════
  -- B) Resolve canonical owner per trial id (fail closed on conflict)
  -- ═══════════════════════════════════════════════════════════════════════
  CREATE TEMP TABLE tmp_trial_owners (
    old_office_id TEXT PRIMARY KEY,
    owner_user_id TEXT,
    resolve_source TEXT,
    conflict BOOLEAN NOT NULL DEFAULT FALSE,
    conflict_code TEXT,
    conflict_details JSONB DEFAULT '{}'
  ) ON COMMIT DROP;

  FOR r IN SELECT old_office_id FROM tmp_trial_ids ORDER BY old_office_id LOOP
    trial_owner := NULL;
    trial_owner_n := 0;
    member_owner := NULL;
    member_owner_n := 0;

    SELECT COUNT(DISTINCT user_id)::int, MIN(user_id)
      INTO trial_owner_n, trial_owner
    FROM trial_offices
    WHERE office_id = r.old_office_id;

    SELECT COUNT(DISTINCT user_id)::int, MIN(user_id)
      INTO member_owner_n, member_owner
    FROM office_members
    WHERE office_id = r.old_office_id
      AND status = 'active'
      AND role = 'owner';

    IF trial_owner_n > 1 THEN
      INSERT INTO tmp_trial_owners (old_office_id, conflict, conflict_code, conflict_details)
      VALUES (
        r.old_office_id, TRUE, 'MULTIPLE_TRIAL_OFFICE_OWNERS',
        jsonb_build_object(
          'owner_count', trial_owner_n,
          'user_ids', (SELECT jsonb_agg(DISTINCT user_id) FROM trial_offices WHERE office_id = r.old_office_id)
        )
      );
    ELSIF member_owner_n > 1 THEN
      INSERT INTO tmp_trial_owners (old_office_id, conflict, conflict_code, conflict_details)
      VALUES (
        r.old_office_id, TRUE, 'MULTIPLE_MEMBER_OWNERS',
        jsonb_build_object(
          'owner_count', member_owner_n,
          'user_ids', (
            SELECT jsonb_agg(DISTINCT user_id) FROM office_members
            WHERE office_id = r.old_office_id AND status = 'active' AND role = 'owner'
          )
        )
      );
    ELSIF trial_owner_n = 1 AND member_owner_n = 1
          AND trial_owner IS DISTINCT FROM member_owner THEN
      INSERT INTO tmp_trial_owners (old_office_id, conflict, conflict_code, conflict_details)
      VALUES (
        r.old_office_id, TRUE, 'OWNER_SOURCE_CONFLICT',
        jsonb_build_object(
          'trial_owner_user_id', trial_owner,
          'owner_member_user_id', member_owner
        )
      );
    ELSIF trial_owner_n = 1 THEN
      INSERT INTO tmp_trial_owners (old_office_id, owner_user_id, resolve_source)
      VALUES (r.old_office_id, trial_owner, 'trial_offices.user_id');
    ELSIF member_owner_n = 1 THEN
      INSERT INTO tmp_trial_owners (old_office_id, owner_user_id, resolve_source)
      VALUES (r.old_office_id, member_owner, 'office_members.role_owner');
    ELSE
      /* Ordinary members / users.office_id / admin-only are NOT trusted ownership */
      INSERT INTO tmp_trial_owners (old_office_id, conflict, conflict_code, conflict_details)
      VALUES (
        r.old_office_id, TRUE, 'MISSING_TRUSTED_OWNER',
        jsonb_build_object(
          'reason', 'need exactly one trial_offices.user_id or exactly one active role=owner membership',
          'ordinary_member_count', (
            SELECT COUNT(DISTINCT user_id) FROM office_members
            WHERE office_id = r.old_office_id AND status = 'active' AND role IS DISTINCT FROM 'owner'
          ),
          'users_office_id_count', (
            SELECT COUNT(DISTINCT id) FROM users WHERE office_id = r.old_office_id
          ),
          'admin_member_count', (
            SELECT COUNT(DISTINCT user_id) FROM office_members
            WHERE office_id = r.old_office_id AND status = 'active' AND role = 'admin'
          )
        )
      );
    END IF;
  END LOOP;

  INSERT INTO legacy_trial_office_conflicts (old_office_id, conflict_code, details)
  SELECT old_office_id, conflict_code, conflict_details
  FROM tmp_trial_owners
  WHERE conflict = TRUE;

  SELECT COUNT(*)::int INTO conflict_count FROM tmp_trial_owners WHERE conflict;
  IF conflict_count > 0 THEN
    RAISE EXCEPTION
      '023_trial: % legacy trial id(s) have unresolved/conflicting ownership — abort BEFORE office_page creation: %',
      conflict_count,
      (SELECT string_agg(old_office_id || ':' || COALESCE(conflict_code, '?'), ', ' ORDER BY old_office_id)
       FROM tmp_trial_owners WHERE conflict);
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════
  -- C) Build map + create/reuse canonical UUID offices
  -- ═══════════════════════════════════════════════════════════════════════
  FOR r IN
    SELECT old_office_id, owner_user_id, resolve_source
    FROM tmp_trial_owners
    WHERE conflict = FALSE
    ORDER BY owner_user_id, old_office_id
  LOOP
    -- Idempotent: already mapped
    SELECT new_office_uuid INTO new_uuid
    FROM legacy_trial_office_map
    WHERE old_office_id = r.old_office_id;

    IF new_uuid IS NOT NULL THEN
      CONTINUE;
    END IF;

    -- Same owner already got a UUID from another trial_* in this/prior run
    SELECT m.new_office_uuid INTO new_uuid
    FROM legacy_trial_office_map m
    WHERE m.owner_user_id = r.owner_user_id
    ORDER BY m.created_at ASC
    LIMIT 1;

    IF new_uuid IS NULL THEN
      /* Existing UUID office proven for this trusted owner only (role=owner).
         Do not use ordinary membership or earliest arbitrary row across tenants. */
      SELECT om.office_id INTO existing_uuid
      FROM office_members om
      WHERE om.user_id = r.owner_user_id
        AND om.status = 'active'
        AND om.role = 'owner'
        AND om.office_id ~* uuid_re
      ORDER BY om.created_at ASC NULLS LAST
      LIMIT 1;

      IF existing_uuid IS NOT NULL THEN
        new_uuid := existing_uuid::uuid;
      ELSE
        SELECT reg.id INTO existing_uuid
        FROM office_registry reg
        WHERE reg.clerk_user_id = r.owner_user_id
          AND reg.status = 'active'
          AND reg.id ~* uuid_re
        LIMIT 1;
        IF existing_uuid IS NOT NULL
           AND EXISTS (SELECT 1 FROM office_page op WHERE op.id = existing_uuid::uuid) THEN
          new_uuid := existing_uuid::uuid;
        END IF;
      END IF;
    END IF;

    IF new_uuid IS NULL THEN
      new_uuid := gen_random_uuid();
      SELECT COALESCE(NULLIF(tr.office_name, ''), 'مكتب المحاماة')
        INTO page_office_name
      FROM trial_offices tr
      WHERE tr.user_id = r.owner_user_id
      LIMIT 1;
      page_office_name := COALESCE(page_office_name, 'مكتب المحاماة');

      INSERT INTO office_page (id, slug, name, plan, is_published)
      VALUES (
        new_uuid,
        'migrated-' || REPLACE(new_uuid::text, '-', ''),
        page_office_name,
        'trial',
        FALSE
      )
      ON CONFLICT (id) DO NOTHING;
    END IF;

    INSERT INTO legacy_trial_office_map (old_office_id, new_office_uuid, owner_user_id, notes)
    VALUES (
      r.old_office_id,
      new_uuid,
      r.owner_user_id,
      'source=' || r.resolve_source
    )
    ON CONFLICT (old_office_id) DO NOTHING;
  END LOOP;

  RAISE NOTICE '023_trial: map rows = %', (SELECT COUNT(*) FROM legacy_trial_office_map);

  -- ═══════════════════════════════════════════════════════════════════════
  -- D) Repair registry + membership + users + trial_offices + onboarding
  -- ═══════════════════════════════════════════════════════════════════════
  FOR r IN SELECT * FROM legacy_trial_office_map LOOP
    SELECT COALESCE(NULLIF(tr.office_name, ''), 'مكتب المحاماة')
      INTO page_office_name
    FROM trial_offices tr
    WHERE tr.user_id = r.owner_user_id
    LIMIT 1;
    page_office_name := COALESCE(page_office_name, 'مكتب المحاماة');

    -- office_registry: ensure owner points at canonical UUID
    INSERT INTO office_registry (id, clerk_user_id, owner_email, office_name, plan_name, status)
    VALUES (
      r.new_office_uuid::text,
      r.owner_user_id,
      r.owner_user_id || '@users.clerk.local',
      page_office_name,
      'trial',
      'active'
    )
    ON CONFLICT (clerk_user_id) DO UPDATE SET
      id = EXCLUDED.id,
      status = 'active',
      office_name = COALESCE(EXCLUDED.office_name, office_registry.office_name),
      last_active_at = NOW();

    -- Remove stale registry row keyed by old trial id (if distinct PK row)
    DELETE FROM office_registry
    WHERE id = r.old_office_id
      AND clerk_user_id IS DISTINCT FROM r.owner_user_id;

    -- office_members: drop rows that would collide on (new_uuid, user_id), then remap
    DELETE FROM office_members om
    WHERE om.office_id = r.old_office_id
      AND EXISTS (
        SELECT 1 FROM office_members x
        WHERE x.office_id = r.new_office_uuid::text
          AND x.user_id = om.user_id
      );

    UPDATE office_members
    SET office_id = r.new_office_uuid::text,
        updated_at = NOW()
    WHERE office_id = r.old_office_id;

    INSERT INTO office_members (office_id, user_id, role, status)
    VALUES (r.new_office_uuid::text, r.owner_user_id, 'owner', 'active')
    ON CONFLICT (office_id, user_id) DO UPDATE SET
      role = 'owner',
      status = 'active',
      updated_at = NOW();

    -- Collapse any remaining active memberships on other mapped old ids for this owner
    UPDATE office_members om
    SET status = 'inactive',
        updated_at = NOW()
    WHERE om.user_id = r.owner_user_id
      AND om.status = 'active'
      AND om.office_id IS DISTINCT FROM r.new_office_uuid::text
      AND om.office_id IN (SELECT old_office_id FROM legacy_trial_office_map WHERE owner_user_id = r.owner_user_id);

    -- Remap ALL users.office_id rows pointing at this mapped legacy trial id
    -- (owner + invited members / stale rows). Exact old-id only — fail-closed.
    UPDATE users
    SET office_id = r.new_office_uuid::text
    WHERE office_id = r.old_office_id;

    -- Trusted owner only: also heal NULL / default (not automatic for others)
    UPDATE users
    SET office_id = r.new_office_uuid::text
    WHERE id = r.owner_user_id
      AND (office_id IS NULL OR office_id = 'default');

    UPDATE trial_offices
    SET office_id = r.new_office_uuid::text
    WHERE office_id = r.old_office_id
       OR (user_id = r.owner_user_id AND office_id ~* trial_re);

    UPDATE onboarding_state
    SET office_id = r.new_office_uuid::text,
        updated_at = NOW()
    WHERE office_id = r.old_office_id
       OR (user_id = r.owner_user_id AND office_id ~* trial_re);
  END LOOP;

  -- ═══════════════════════════════════════════════════════════════════════
  -- E) Remap trusted business tables by exact old office id
  -- ═══════════════════════════════════════════════════════════════════════
  FOREACH tbl IN ARRAY remap_tables LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN
      CONTINUE;
    END IF;
    SELECT c.udt_name INTO col_udt
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = tbl AND c.column_name = 'office_id';
    IF col_udt IS NULL OR col_udt = 'uuid' THEN
      CONTINUE;
    END IF;

    -- Skip identity tables already handled above (still safe to UPDATE again)
    sql_update := format(
      'UPDATE %I AS t
       SET office_id = m.new_office_uuid::text
       FROM legacy_trial_office_map m
       WHERE t.office_id = m.old_office_id',
      tbl
    );
    BEGIN
      EXECUTE sql_update;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION '023_trial: failed remapping table % : %', tbl, SQLERRM;
    END;
  END LOOP;

  -- office_storage_quota: PK is office_id — merge then delete old
  IF to_regclass('public.office_storage_quota') IS NOT NULL THEN
    INSERT INTO office_storage_quota (office_id, used_bytes, files_count)
    SELECT m.new_office_uuid::text,
           COALESCE(q.used_bytes, 0),
           COALESCE(q.files_count, 0)
    FROM legacy_trial_office_map m
    JOIN office_storage_quota q ON q.office_id = m.old_office_id
    ON CONFLICT (office_id) DO UPDATE SET
      used_bytes = office_storage_quota.used_bytes + EXCLUDED.used_bytes,
      files_count = office_storage_quota.files_count + EXCLUDED.files_count,
      updated_at = NOW();
    DELETE FROM office_storage_quota q
    USING legacy_trial_office_map m
    WHERE q.office_id = m.old_office_id;
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════
  -- F) Inventory office_id = 'default' (do not assign to any tenant)
  -- ═══════════════════════════════════════════════════════════════════════
  FOREACH tbl IN ARRAY default_tables LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN
      CONTINUE;
    END IF;
    SELECT c.udt_name INTO col_udt
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = tbl AND c.column_name = 'office_id';
    IF col_udt IS NULL OR col_udt = 'uuid' THEN
      CONTINUE;
    END IF;
    EXECUTE format(
      'INSERT INTO legacy_default_office_unresolved (table_name, row_count, note)
       SELECT %L, COUNT(*)::int, %L
       FROM %I
       WHERE office_id = %L
       HAVING COUNT(*) > 0',
      tbl,
      'office_id=default left unresolved — ownership not unambiguous; no automatic remap',
      tbl,
      'default'
    );
  END LOOP;

  -- ═══════════════════════════════════════════════════════════════════════
  -- G) Validation gates (fail closed → ROLLBACK)
  -- ═══════════════════════════════════════════════════════════════════════
  SELECT COUNT(*)::int INTO remaining FROM office_members
  WHERE status = 'active' AND office_id ~* trial_re;
  IF remaining > 0 THEN
    RAISE EXCEPTION '023_trial: % active office_members still use trial_*', remaining;
  END IF;

  SELECT COUNT(*)::int INTO remaining FROM users WHERE office_id ~* trial_re;
  IF remaining > 0 THEN
    RAISE EXCEPTION '023_trial: % users.office_id still use trial_*', remaining;
  END IF;

  SELECT COUNT(*)::int INTO remaining FROM onboarding_state WHERE office_id ~* trial_re;
  IF remaining > 0 THEN
    RAISE EXCEPTION '023_trial: % onboarding_state.office_id still use trial_*', remaining;
  END IF;

  SELECT COUNT(*)::int INTO remaining FROM trial_offices WHERE office_id ~* trial_re;
  IF remaining > 0 THEN
    RAISE EXCEPTION '023_trial: % trial_offices.office_id still use trial_*', remaining;
  END IF;

  -- Trusted remappable business rows must not retain trial_*
  FOREACH tbl IN ARRAY ARRAY[
    'cases', 'clients', 'tasks', 'storage_files', 'documents', 'employees',
    'office_branches', 'office_messages', 'payment_transactions'
  ] LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN
      CONTINUE;
    END IF;
    SELECT c.udt_name INTO col_udt
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = tbl AND c.column_name = 'office_id';
    IF col_udt IS NULL OR col_udt = 'uuid' THEN
      CONTINUE;
    END IF;
    EXECUTE format(
      'SELECT COUNT(*)::int FROM %I WHERE office_id::text ~* %L',
      tbl, trial_re
    ) INTO remaining;
    IF remaining > 0 THEN
      RAISE EXCEPTION '023_trial: % rows in % still use trial_*', remaining, tbl;
    END IF;
  END LOOP;

  -- No owner should retain multiple active memberships after collapse
  SELECT COUNT(*)::int INTO remaining
  FROM (
    SELECT user_id
    FROM office_members
    WHERE status = 'active'
      AND user_id IN (SELECT DISTINCT owner_user_id FROM legacy_trial_office_map)
    GROUP BY user_id
    HAVING COUNT(DISTINCT office_id) > 1
  ) dups;
  IF remaining > 0 THEN
    RAISE EXCEPTION
      '023_trial: % mapped owners still have duplicate active memberships',
      remaining;
  END IF;

  -- Unresolved conflicts table must be empty for success
  SELECT COUNT(*)::int INTO remaining FROM legacy_trial_office_conflicts;
  IF remaining > 0 THEN
    RAISE EXCEPTION '023_trial: % conflict rows remain — fail closed', remaining;
  END IF;

  RAISE NOTICE '023_trial: validation passed; default unresolved groups = %',
    (SELECT COUNT(*) FROM legacy_default_office_unresolved);
END $$;

COMMIT;
