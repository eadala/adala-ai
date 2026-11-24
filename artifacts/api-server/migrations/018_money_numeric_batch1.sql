-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 018: Money Numeric Batch 1 — REAL → NUMERIC(18,2)
--
-- Owns type conversion for these monetary columns only:
--   invoices.amount
--   subscriptions.plan_price
--   usage_logs.cost
--   plans.price
--   plans.monthly_price
--   plans.yearly_price
--   discount_codes.value
--   ai_api_keys.total_cost
--
-- Out of scope for this batch (handled later or intentionally excluded):
-- other ledger/invoice tables, marketplace/HR money, free-text claim amounts,
-- AI usage point meters, and payment-gateway minor-unit conversions.
--
-- Float conversion policy:
--   USING (<col>)::numeric(18,2)
--   PostgreSQL casts REAL/DOUBLE PRECISION → NUMERIC, then reduces scale to 2
--   using numeric round-half-away-from-zero (e.g. 1.235 → 1.24).
--   No ×100 / ÷100. No SAR↔halalas reinterpretation.
--
-- discount_codes.value:
--   Business meaning unchanged — percent OR fixed SAR selected by `type`.
--   Stored as NUMERIC(18,2) without model redesign.
--
-- Apply AFTER: 003 → 001 → 004 → … → 017
-- Idempotent / legacy-safe. Unexpected types or DDL failures abort.
-- NOTICE only when table/column genuinely absent.
-- Do NOT apply via Runtime DDL / drizzle-kit push.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  -- (table_name, column_name, restore_default_expr_or_null)
  targets text[][] := ARRAY[
    ARRAY['invoices',         'amount',         NULL],
    ARRAY['subscriptions',    'plan_price',      NULL],
    ARRAY['usage_logs',       'cost',            NULL],
    ARRAY['plans',            'price',           '0'],
    ARRAY['plans',            'monthly_price',   NULL],
    ARRAY['plans',            'yearly_price',    NULL],
    ARRAY['discount_codes',   'value',           NULL],
    ARRAY['ai_api_keys',      'total_cost',      '0']
  ];
  t text;
  c text;
  def_expr text;
  tbl_exists boolean;
  col_udt text;
  col_precision int;
  col_scale int;
  i int;
BEGIN
  FOR i IN 1 .. array_length(targets, 1) LOOP
    t := targets[i][1];
    c := targets[i][2];
    def_expr := targets[i][3];

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = t
    ) INTO tbl_exists;

    IF NOT tbl_exists THEN
      RAISE NOTICE '018_money: skipping %.% — table missing', t, c;
      CONTINUE;
    END IF;

    SELECT cols.udt_name,
           cols.numeric_precision,
           cols.numeric_scale
      INTO col_udt, col_precision, col_scale
    FROM information_schema.columns cols
    WHERE cols.table_schema = 'public'
      AND cols.table_name = t
      AND cols.column_name = c;

    IF col_udt IS NULL THEN
      RAISE NOTICE '018_money: skipping %.% — column missing', t, c;
      CONTINUE;
    END IF;

    -- Already at target type — idempotent no-op
    IF col_udt = 'numeric'
       AND col_precision = 18
       AND col_scale = 2 THEN
      -- Re-assert known defaults (safe if already set)
      IF def_expr IS NOT NULL THEN
        EXECUTE format(
          'ALTER TABLE %I ALTER COLUMN %I SET DEFAULT %s',
          t, c, def_expr
        );
      END IF;
      CONTINUE;
    END IF;

    IF col_udt IN ('float4', 'float8', 'numeric') THEN
      -- REAL (float4), DOUBLE PRECISION (float8), or other NUMERIC → NUMERIC(18,2)
      -- USING applies PG numeric scale rounding (half away from zero).
      EXECUTE format(
        'ALTER TABLE %I ALTER COLUMN %I TYPE NUMERIC(18,2) USING (%I)::numeric(18,2)',
        t, c, c
      );
    ELSE
      RAISE EXCEPTION
        '018_money: refusing to convert %.% from unexpected type % — aborting',
        t, c, col_udt;
    END IF;

    IF def_expr IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE %I ALTER COLUMN %I SET DEFAULT %s',
        t, c, def_expr
      );
    END IF;

    -- Nullability is preserved by ALTER TYPE; assert NOT NULL columns stay NOT NULL
    -- by not issuing DROP NOT NULL. No force NOT NULL on nullable columns.
  END LOOP;
END $$;

COMMIT;
