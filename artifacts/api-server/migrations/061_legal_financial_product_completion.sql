-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 061: Legal & financial product completion (ADALA-031)
-- Forward-only. Idempotent. No DROP of prior objects.
-- Owns: fee agreements domain, refund_requests, events.client_visible,
--        messages portal sender columns (if missing).
-- Period-close tables intentionally NOT created (design-gated).
-- Rebased from lost LOCAL-ONLY tip 4d76a954 onto recovery lineage.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── A) Fee agreements ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fee_agreements (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id         TEXT NOT NULL,
  client_id         TEXT,
  client_name       TEXT,
  case_id           TEXT,
  title             TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'draft',
  fee_structure     TEXT NOT NULL DEFAULT 'fixed',
  currency          TEXT NOT NULL DEFAULT 'SAR',
  fixed_fee         NUMERIC(14,2),
  total_value       NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes             TEXT,
  acknowledgment_at TIMESTAMPTZ,
  acknowledgment_by TEXT,
  invoice_id        TEXT,
  document_id       TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fee_agreements_status_chk
    CHECK (status = ANY (ARRAY['draft','active','amended','completed','cancelled'])),
  CONSTRAINT fee_agreements_structure_chk
    CHECK (fee_structure = ANY (ARRAY['fixed','installments','milestone','hourly','mixed']))
);

ALTER TABLE fee_agreements ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE fee_agreements ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE fee_agreements ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE fee_agreements ADD COLUMN IF NOT EXISTS case_id TEXT;
ALTER TABLE fee_agreements ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE fee_agreements ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE fee_agreements ADD COLUMN IF NOT EXISTS fee_structure TEXT;
ALTER TABLE fee_agreements ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE fee_agreements ADD COLUMN IF NOT EXISTS fixed_fee NUMERIC(14,2);
ALTER TABLE fee_agreements ADD COLUMN IF NOT EXISTS total_value NUMERIC(14,2);
ALTER TABLE fee_agreements ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE fee_agreements ADD COLUMN IF NOT EXISTS acknowledgment_at TIMESTAMPTZ;
ALTER TABLE fee_agreements ADD COLUMN IF NOT EXISTS acknowledgment_by TEXT;
ALTER TABLE fee_agreements ADD COLUMN IF NOT EXISTS invoice_id TEXT;
ALTER TABLE fee_agreements ADD COLUMN IF NOT EXISTS document_id TEXT;
ALTER TABLE fee_agreements ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE fee_agreements ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE fee_agreements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_fee_agreements_office
  ON fee_agreements (office_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fee_agreements_case
  ON fee_agreements (office_id, case_id)
  WHERE case_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fee_agreements_client
  ON fee_agreements (office_id, client_id)
  WHERE client_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS fee_agreement_installments (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id       TEXT NOT NULL,
  agreement_id    TEXT NOT NULL,
  seq             INTEGER NOT NULL DEFAULT 1,
  label           TEXT,
  amount          NUMERIC(14,2) NOT NULL,
  due_date        DATE,
  status          TEXT NOT NULL DEFAULT 'pending',
  invoice_id      TEXT,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fee_installment_status_chk
    CHECK (status = ANY (ARRAY['pending','invoiced','paid','waived','cancelled'])),
  CONSTRAINT fee_installment_agreement_fkey
    FOREIGN KEY (agreement_id) REFERENCES fee_agreements(id) ON DELETE CASCADE
);

ALTER TABLE fee_agreement_installments ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE fee_agreement_installments ADD COLUMN IF NOT EXISTS agreement_id TEXT;
ALTER TABLE fee_agreement_installments ADD COLUMN IF NOT EXISTS seq INTEGER;
ALTER TABLE fee_agreement_installments ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE fee_agreement_installments ADD COLUMN IF NOT EXISTS amount NUMERIC(14,2);
ALTER TABLE fee_agreement_installments ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE fee_agreement_installments ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE fee_agreement_installments ADD COLUMN IF NOT EXISTS invoice_id TEXT;
ALTER TABLE fee_agreement_installments ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE fee_agreement_installments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_fee_installments_agreement
  ON fee_agreement_installments (office_id, agreement_id, seq);

CREATE TABLE IF NOT EXISTS fee_agreement_amendments (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id       TEXT NOT NULL,
  agreement_id    TEXT NOT NULL,
  change_summary  TEXT NOT NULL,
  previous_total  NUMERIC(14,2),
  new_total       NUMERIC(14,2),
  previous_status TEXT,
  new_status      TEXT,
  amended_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fee_amendment_agreement_fkey
    FOREIGN KEY (agreement_id) REFERENCES fee_agreements(id) ON DELETE CASCADE
);

ALTER TABLE fee_agreement_amendments ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE fee_agreement_amendments ADD COLUMN IF NOT EXISTS agreement_id TEXT;
ALTER TABLE fee_agreement_amendments ADD COLUMN IF NOT EXISTS change_summary TEXT;
ALTER TABLE fee_agreement_amendments ADD COLUMN IF NOT EXISTS previous_total NUMERIC(14,2);
ALTER TABLE fee_agreement_amendments ADD COLUMN IF NOT EXISTS new_total NUMERIC(14,2);
ALTER TABLE fee_agreement_amendments ADD COLUMN IF NOT EXISTS previous_status TEXT;
ALTER TABLE fee_agreement_amendments ADD COLUMN IF NOT EXISTS new_status TEXT;
ALTER TABLE fee_agreement_amendments ADD COLUMN IF NOT EXISTS amended_by TEXT;
ALTER TABLE fee_agreement_amendments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS fee_agreement_audit (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id       TEXT NOT NULL,
  agreement_id    TEXT NOT NULL,
  action          TEXT NOT NULL,
  actor_id        TEXT,
  detail          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fee_audit_agreement_fkey
    FOREIGN KEY (agreement_id) REFERENCES fee_agreements(id) ON DELETE CASCADE
);

ALTER TABLE fee_agreement_audit ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE fee_agreement_audit ADD COLUMN IF NOT EXISTS agreement_id TEXT;
ALTER TABLE fee_agreement_audit ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE fee_agreement_audit ADD COLUMN IF NOT EXISTS actor_id TEXT;
ALTER TABLE fee_agreement_audit ADD COLUMN IF NOT EXISTS detail TEXT;
ALTER TABLE fee_agreement_audit ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_fee_audit_agreement
  ON fee_agreement_audit (office_id, agreement_id, created_at DESC);

-- ── B) Refund requests (fake-transport workflow) ───────────────────────────
CREATE TABLE IF NOT EXISTS refund_requests (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id             TEXT NOT NULL,
  payment_id            TEXT NOT NULL,
  invoice_id            TEXT,
  amount                NUMERIC(14,2) NOT NULL,
  currency              TEXT NOT NULL DEFAULT 'SAR',
  status                TEXT NOT NULL DEFAULT 'pending',
  reason                TEXT,
  requested_by          TEXT,
  authorized_by         TEXT,
  credit_note_id        TEXT,
  provider_refund_id    TEXT,
  provider_status       TEXT,
  duplicate_key         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT refund_requests_status_chk
    CHECK (status = ANY (ARRAY['pending','authorized','submitted','succeeded','failed','cancelled'])),
  CONSTRAINT refund_requests_amount_chk CHECK (amount > 0)
);

ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS payment_id TEXT;
ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS invoice_id TEXT;
ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS amount NUMERIC(14,2);
ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS requested_by TEXT;
ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS authorized_by TEXT;
ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS credit_note_id TEXT;
ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS provider_refund_id TEXT;
ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS provider_status TEXT;
ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS duplicate_key TEXT;
ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_refund_requests_duplicate_key
  ON refund_requests (office_id, duplicate_key)
  WHERE duplicate_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_refund_requests_office
  ON refund_requests (office_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refund_requests_payment
  ON refund_requests (office_id, payment_id);

-- ── C) Client-visible calendar events ─────────────────────────────────────
ALTER TABLE events ADD COLUMN IF NOT EXISTS client_visible BOOLEAN NOT NULL DEFAULT FALSE;

-- ── C2) Portal token tenant + active flags (038 omitted office_id) ────────
ALTER TABLE client_portal_tokens ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE client_portal_tokens ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS idx_client_portal_tokens_office
  ON client_portal_tokens (office_id)
  WHERE office_id IS NOT NULL;

-- ── C3) credit_notes safety net when 037 greenfield readiness rolls back ──
CREATE TABLE IF NOT EXISTS credit_notes (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id           TEXT NOT NULL,
  original_invoice_id TEXT NOT NULL,
  credit_number       TEXT NOT NULL,
  client_id           TEXT,
  client_name         TEXT,
  case_id             TEXT,
  amount              NUMERIC(12,2) NOT NULL,
  tax_amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  total               NUMERIC(12,2) NOT NULL,
  reason              TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'issued',
  notes               TEXT,
  issued_by           TEXT,
  issued_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS original_invoice_id TEXT;
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS credit_number TEXT;
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2);
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2);
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS total NUMERIC(12,2);
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_credit_notes_office ON credit_notes (office_id);

ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS linked_credit_note_id TEXT;
ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(14,2) DEFAULT 0;

-- expenses.office_id required by reconciliation tenant filter (legacy 003 lacked it)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS office_id TEXT;

-- ── D) Portal message columns on messages (003 baseline) ──────────────────
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_email TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS parent_id TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_case_portal
  ON messages (case_id, created_at DESC)
  WHERE channel = 'portal';

-- ── E) RLS on new tenant tables (fail-closed) ─────────────────────────────
ALTER TABLE fee_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_agreements FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fee_agreements_tenant ON fee_agreements;
CREATE POLICY fee_agreements_tenant ON fee_agreements
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR office_id = NULLIF(current_setting('app.current_tenant', true), '')
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR office_id = NULLIF(current_setting('app.current_tenant', true), '')
  );

ALTER TABLE fee_agreement_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_agreement_installments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fee_installments_tenant ON fee_agreement_installments;
CREATE POLICY fee_installments_tenant ON fee_agreement_installments
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR office_id = NULLIF(current_setting('app.current_tenant', true), '')
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR office_id = NULLIF(current_setting('app.current_tenant', true), '')
  );

ALTER TABLE fee_agreement_amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_agreement_amendments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fee_amendments_tenant ON fee_agreement_amendments;
CREATE POLICY fee_amendments_tenant ON fee_agreement_amendments
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR office_id = NULLIF(current_setting('app.current_tenant', true), '')
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR office_id = NULLIF(current_setting('app.current_tenant', true), '')
  );

ALTER TABLE fee_agreement_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_agreement_audit FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fee_audit_tenant ON fee_agreement_audit;
CREATE POLICY fee_audit_tenant ON fee_agreement_audit
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR office_id = NULLIF(current_setting('app.current_tenant', true), '')
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR office_id = NULLIF(current_setting('app.current_tenant', true), '')
  );

ALTER TABLE refund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_requests FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS refund_requests_tenant ON refund_requests;
CREATE POLICY refund_requests_tenant ON refund_requests
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR office_id = NULLIF(current_setting('app.current_tenant', true), '')
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR office_id = NULLIF(current_setting('app.current_tenant', true), '')
  );

-- Readiness — period-close must remain unimplemented
DO $$
BEGIN
  IF to_regclass('public.fee_agreements') IS NULL THEN
    RAISE EXCEPTION '061: fee_agreements missing after create';
  END IF;
  IF to_regclass('public.refund_requests') IS NULL THEN
    RAISE EXCEPTION '061: refund_requests missing after create';
  END IF;
  IF to_regclass('public.accounting_periods') IS NOT NULL THEN
    RAISE EXCEPTION '061: accounting_periods must NOT exist (period-close design-gated)';
  END IF;
END $$;

COMMIT;
