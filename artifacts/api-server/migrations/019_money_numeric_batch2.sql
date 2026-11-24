-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 019: Money Numeric Batch 2 — bare NUMERIC → NUMERIC(18,2)
--
-- Owns type tightening for payment/ledger SAR columns only:
--   payment_transactions.amount
--   payment_transactions.platform_fee
--   payment_transactions.net_amount
--   payment_transactions.stripe_fee
--   office_ledger.amount
--   office_ledger.platform_fee
--   office_ledger.stripe_fee
--   office_ledger.net_amount
--
-- Source of truth (migrations 010 / 012): unbounded NUMERIC, values in SAR
-- (not gateway minor units). Runtime writes use toFixed(2) / halalas÷100.
--
-- Conversion policy:
--   ALTER … TYPE NUMERIC(18,2) USING (<col>)::numeric(18,2)
--   No ×100 / ÷100. No SAR↔halalas reinterpretation.
--   Preflight ABORTS if any non-null value would change when cast to
--   NUMERIC(18,2) (more than 2 meaningful decimal places) or would overflow
--   NUMERIC(18,2). No silent rounding of production payment/ledger data.
--
-- Acceptable source types: numeric (any precision/scale), including already
-- NUMERIC(18,2). Unexpected types (text/real/float8/integer/…) abort.
--
-- Apply AFTER: 003 → … → 018
-- Idempotent / legacy-safe. No broad catch-all exception handlers.
-- NOTICE only when table/column genuinely absent.
-- Do NOT apply via Runtime DDL / drizzle-kit push.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  -- (table_name, column_name, restore_default_expr_or_null)
  targets text[][] := ARRAY[
    ARRAY['payment_transactions', 'amount',       NULL],
    ARRAY['payment_transactions', 'platform_fee', NULL],
    ARRAY['payment_transactions', 'net_amount',   NULL],
    ARRAY['payment_transactions', 'stripe_fee',   NULL],
    ARRAY['office_ledger',        'amount',       NULL],
    ARRAY['office_ledger',        'platform_fee', '0'],
    ARRAY['office_ledger',        'stripe_fee',   '0'],
    ARRAY['office_ledger',        'net_amount',   '0']
  ];
  t text;
  c text;
  def_expr text;
  tbl_exists boolean;
  col_udt text;
  col_precision int;
  col_scale int;
  bad_scale_cnt bigint;
  overflow_cnt bigint;
  i int;
  -- NUMERIC(18,2) max absolute value: 16 integer digits + 2 fractional
  max_abs constant numeric := 9999999999999999.99;
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
      RAISE NOTICE '019_money: skipping %.% — table missing', t, c;
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
      RAISE NOTICE '019_money: skipping %.% — column missing', t, c;
      CONTINUE;
    END IF;

    -- Already at target — idempotent no-op (re-assert known defaults)
    IF col_udt = 'numeric'
       AND col_precision = 18
       AND col_scale = 2 THEN
      IF def_expr IS NOT NULL THEN
        EXECUTE format(
          'ALTER TABLE %I ALTER COLUMN %I SET DEFAULT %s',
          t, c, def_expr
        );
      END IF;
      CONTINUE;
    END IF;

    IF col_udt <> 'numeric' THEN
      RAISE EXCEPTION
        '019_money: refusing to convert %.% from unexpected type % — aborting (expected numeric)',
        t, c, col_udt;
    END IF;

    -- Preflight: overflow beyond NUMERIC(18,2) range (must run before scale cast)
    EXECUTE format(
      'SELECT COUNT(*) FROM %I WHERE %I IS NOT NULL AND abs(%I) > %L::numeric',
      t, c, c, max_abs
    ) INTO overflow_cnt;

    IF overflow_cnt > 0 THEN
      RAISE EXCEPTION
        '019_money: %.% has % row(s) exceeding NUMERIC(18,2) range — aborting',
        t, c, overflow_cnt;
    END IF;

    -- Preflight: values that would change under NUMERIC(18,2) cast (scale > 2 meaningful)
    EXECUTE format(
      'SELECT COUNT(*) FROM %I WHERE %I IS NOT NULL AND %I IS DISTINCT FROM (%I)::numeric(18,2)',
      t, c, c, c
    ) INTO bad_scale_cnt;

    IF bad_scale_cnt > 0 THEN
      RAISE EXCEPTION
        '019_money: %.% has % row(s) with more than 2 meaningful decimal places — aborting (no silent rounding)',
        t, c, bad_scale_cnt;
    END IF;

    -- Safe: data already equals NUMERIC(18,2) representation
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN %I TYPE NUMERIC(18,2) USING (%I)::numeric(18,2)',
      t, c, c
    );

    IF def_expr IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE %I ALTER COLUMN %I SET DEFAULT %s',
        t, c, def_expr
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
