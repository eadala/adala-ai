-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 038: Marketplace + Client Portal Runtime DDL schema authority (Stage 6B)
--
-- Owns ONLY the still-executable Runtime DDL confirmed for Stage 6B:
--   A) marketplace.ts — marketplace_services, marketplace_orders,
--      marketplace_deals, marketplace_deal_offers
--   B) client-portal.ts — client_portal_tokens, case_timeline, portal_uploads
--   C) client-auth.ts — client_accounts, client_sessions, client_case_links
--      (auth shape; FK CASCADE to client_accounts)
--   D) homeCms.ts — home_cms global singleton (id=1)
--   E) clients.ts / webhookHandlers.ts extension — clients.client_account_id TEXT
--
-- Does NOT CREATE: invitations, office_page, office_services, office_orders,
-- office_reviews, client_comm_settings, website_builder_pages.
-- Does NOT invent office_id on marketplace/portal tokens/home_cms/case_timeline.
--
-- Idempotent. No DROP TABLE. Fail-closed on orphans for FKs (ORPHAN_FK).
-- Post-apply readiness must pass before COMMIT.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── A1) marketplace_services (UUID PK) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketplace_services (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT NOT NULL,
  office_name      TEXT,
  title            TEXT NOT NULL,
  description      TEXT,
  category         TEXT NOT NULL,
  price            NUMERIC DEFAULT 0,
  currency         TEXT DEFAULT 'SAR',
  duration_minutes INT,
  tags             TEXT,
  is_active        BOOLEAN DEFAULT true,
  rating           NUMERIC DEFAULT 0,
  total_reviews    INT DEFAULT 0,
  total_orders     INT DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE marketplace_services ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE marketplace_services ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE marketplace_services ADD COLUMN IF NOT EXISTS office_name TEXT;
ALTER TABLE marketplace_services ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE marketplace_services ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE marketplace_services ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE marketplace_services ADD COLUMN IF NOT EXISTS price NUMERIC;
ALTER TABLE marketplace_services ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE marketplace_services ADD COLUMN IF NOT EXISTS duration_minutes INT;
ALTER TABLE marketplace_services ADD COLUMN IF NOT EXISTS tags TEXT;
ALTER TABLE marketplace_services ADD COLUMN IF NOT EXISTS is_active BOOLEAN;
ALTER TABLE marketplace_services ADD COLUMN IF NOT EXISTS rating NUMERIC;
ALTER TABLE marketplace_services ADD COLUMN IF NOT EXISTS total_reviews INT;
ALTER TABLE marketplace_services ADD COLUMN IF NOT EXISTS total_orders INT;
ALTER TABLE marketplace_services ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE marketplace_services ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ── A2) marketplace_orders ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketplace_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id    TEXT NOT NULL,
  service_title TEXT,
  seller_id     TEXT NOT NULL,
  buyer_name    TEXT NOT NULL,
  buyer_email   TEXT,
  buyer_phone   TEXT,
  amount        NUMERIC DEFAULT 0,
  notes         TEXT,
  status        TEXT DEFAULT 'pending',
  case_id       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS service_id TEXT;
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS service_title TEXT;
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS seller_id TEXT;
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS buyer_name TEXT;
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS buyer_email TEXT;
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS buyer_phone TEXT;
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS amount NUMERIC;
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS case_id TEXT;
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- ── A3) marketplace_deals ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketplace_deals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id    TEXT NOT NULL,
  service_title TEXT,
  seller_id     TEXT NOT NULL,
  buyer_name    TEXT NOT NULL,
  buyer_email   TEXT,
  buyer_phone   TEXT,
  initial_price NUMERIC,
  final_price   NUMERIC,
  status        TEXT DEFAULT 'open',
  notes         TEXT,
  case_id       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE marketplace_deals ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE marketplace_deals ADD COLUMN IF NOT EXISTS service_id TEXT;
ALTER TABLE marketplace_deals ADD COLUMN IF NOT EXISTS service_title TEXT;
ALTER TABLE marketplace_deals ADD COLUMN IF NOT EXISTS seller_id TEXT;
ALTER TABLE marketplace_deals ADD COLUMN IF NOT EXISTS buyer_name TEXT;
ALTER TABLE marketplace_deals ADD COLUMN IF NOT EXISTS buyer_email TEXT;
ALTER TABLE marketplace_deals ADD COLUMN IF NOT EXISTS buyer_phone TEXT;
ALTER TABLE marketplace_deals ADD COLUMN IF NOT EXISTS initial_price NUMERIC;
ALTER TABLE marketplace_deals ADD COLUMN IF NOT EXISTS final_price NUMERIC;
ALTER TABLE marketplace_deals ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE marketplace_deals ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE marketplace_deals ADD COLUMN IF NOT EXISTS case_id TEXT;
ALTER TABLE marketplace_deals ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- ── A4) marketplace_deal_offers ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketplace_deal_offers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id    TEXT NOT NULL,
  from_role  TEXT NOT NULL,
  price      NUMERIC NOT NULL,
  message    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE marketplace_deal_offers ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE marketplace_deal_offers ADD COLUMN IF NOT EXISTS deal_id TEXT;
ALTER TABLE marketplace_deal_offers ADD COLUMN IF NOT EXISTS from_role TEXT;
ALTER TABLE marketplace_deal_offers ADD COLUMN IF NOT EXISTS price NUMERIC;
ALTER TABLE marketplace_deal_offers ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE marketplace_deal_offers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- ── B1) client_portal_tokens (TEXT PK) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_portal_tokens (
  id                TEXT PRIMARY KEY,
  case_id           TEXT NOT NULL,
  token             TEXT NOT NULL UNIQUE,
  client_email      TEXT,
  client_name       TEXT,
  expires_at        TIMESTAMPTZ,
  last_accessed     TIMESTAMPTZ,
  access_count      INTEGER DEFAULT 0,
  show_invoices     BOOLEAN DEFAULT true,
  show_timeline     BOOLEAN DEFAULT true,
  allowed_to_upload BOOLEAN DEFAULT false,
  shared_documents  JSONB DEFAULT '[]',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE client_portal_tokens ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE client_portal_tokens ADD COLUMN IF NOT EXISTS case_id TEXT;
ALTER TABLE client_portal_tokens ADD COLUMN IF NOT EXISTS token TEXT;
ALTER TABLE client_portal_tokens ADD COLUMN IF NOT EXISTS client_email TEXT;
ALTER TABLE client_portal_tokens ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE client_portal_tokens ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE client_portal_tokens ADD COLUMN IF NOT EXISTS last_accessed TIMESTAMPTZ;
ALTER TABLE client_portal_tokens ADD COLUMN IF NOT EXISTS access_count INTEGER;
ALTER TABLE client_portal_tokens ADD COLUMN IF NOT EXISTS show_invoices BOOLEAN;
ALTER TABLE client_portal_tokens ADD COLUMN IF NOT EXISTS show_timeline BOOLEAN;
ALTER TABLE client_portal_tokens ADD COLUMN IF NOT EXISTS allowed_to_upload BOOLEAN;
ALTER TABLE client_portal_tokens ADD COLUMN IF NOT EXISTS shared_documents JSONB;
ALTER TABLE client_portal_tokens ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- ── B2) case_timeline (TEXT PK; no office_id) ────────────────────────────────
CREATE TABLE IF NOT EXISTS case_timeline (
  id          TEXT PRIMARY KEY,
  case_id     TEXT NOT NULL,
  entry_type  TEXT NOT NULL DEFAULT 'note',
  title       TEXT NOT NULL,
  description TEXT,
  happened_at TIMESTAMPTZ DEFAULT NOW(),
  is_shared   BOOLEAN DEFAULT true,
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE case_timeline ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE case_timeline ADD COLUMN IF NOT EXISTS case_id TEXT;
ALTER TABLE case_timeline ADD COLUMN IF NOT EXISTS entry_type TEXT;
ALTER TABLE case_timeline ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE case_timeline ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE case_timeline ADD COLUMN IF NOT EXISTS happened_at TIMESTAMPTZ;
ALTER TABLE case_timeline ADD COLUMN IF NOT EXISTS is_shared BOOLEAN;
ALTER TABLE case_timeline ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE case_timeline ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- ── B3) portal_uploads (TEXT PK) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portal_uploads (
  id           TEXT PRIMARY KEY,
  portal_token TEXT NOT NULL,
  case_id      TEXT,
  file_name    TEXT NOT NULL,
  file_size    INTEGER,
  file_type    TEXT,
  file_path    TEXT,
  uploaded_at  TIMESTAMPTZ DEFAULT NOW(),
  is_read      BOOLEAN DEFAULT false
);

ALTER TABLE portal_uploads ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE portal_uploads ADD COLUMN IF NOT EXISTS portal_token TEXT;
ALTER TABLE portal_uploads ADD COLUMN IF NOT EXISTS case_id TEXT;
ALTER TABLE portal_uploads ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE portal_uploads ADD COLUMN IF NOT EXISTS file_size INTEGER;
ALTER TABLE portal_uploads ADD COLUMN IF NOT EXISTS file_type TEXT;
ALTER TABLE portal_uploads ADD COLUMN IF NOT EXISTS file_path TEXT;
ALTER TABLE portal_uploads ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ;
ALTER TABLE portal_uploads ADD COLUMN IF NOT EXISTS is_read BOOLEAN;

-- ── C1) client_accounts (TEXT PK) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_accounts (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email          TEXT UNIQUE NOT NULL,
  password_hash  TEXT,
  name           TEXT,
  phone          TEXT,
  email_verified BOOLEAN DEFAULT false,
  otp            TEXT,
  otp_expires    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS email_verified BOOLEAN;
ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS otp TEXT;
ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS otp_expires TIMESTAMPTZ;
ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ── C2) client_sessions (FK CASCADE) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_sessions (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id  TEXT NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
  token      TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE client_sessions ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE client_sessions ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE client_sessions ADD COLUMN IF NOT EXISTS token TEXT;
ALTER TABLE client_sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE client_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- ── C3) client_case_links (FK CASCADE + UNIQUE; auth shape) ──────────────────
CREATE TABLE IF NOT EXISTS client_case_links (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id       TEXT NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
  case_id         TEXT NOT NULL,
  portal_token_id TEXT,
  portal_token    TEXT,
  office_id       TEXT,
  linked_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, case_id)
);

ALTER TABLE client_case_links ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE client_case_links ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE client_case_links ADD COLUMN IF NOT EXISTS case_id TEXT;
ALTER TABLE client_case_links ADD COLUMN IF NOT EXISTS portal_token_id TEXT;
ALTER TABLE client_case_links ADD COLUMN IF NOT EXISTS portal_token TEXT;
ALTER TABLE client_case_links ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE client_case_links ADD COLUMN IF NOT EXISTS linked_at TIMESTAMPTZ;

-- ── D) home_cms global singleton ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS home_cms (
  id           INTEGER PRIMARY KEY DEFAULT 1,
  hero         JSONB NOT NULL DEFAULT '{}',
  trust        JSONB NOT NULL DEFAULT '{}',
  features     JSONB NOT NULL DEFAULT '{}',
  cta_section  JSONB NOT NULL DEFAULT '{}',
  announcement JSONB NOT NULL DEFAULT '{}',
  stats        JSONB NOT NULL DEFAULT '{}',
  seo          JSONB NOT NULL DEFAULT '{}',
  contact      JSONB NOT NULL DEFAULT '{}',
  footer       JSONB NOT NULL DEFAULT '{}',
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_by   TEXT
);

ALTER TABLE home_cms ADD COLUMN IF NOT EXISTS id INTEGER;
ALTER TABLE home_cms ADD COLUMN IF NOT EXISTS hero JSONB;
ALTER TABLE home_cms ADD COLUMN IF NOT EXISTS trust JSONB;
ALTER TABLE home_cms ADD COLUMN IF NOT EXISTS features JSONB;
ALTER TABLE home_cms ADD COLUMN IF NOT EXISTS cta_section JSONB;
ALTER TABLE home_cms ADD COLUMN IF NOT EXISTS announcement JSONB;
ALTER TABLE home_cms ADD COLUMN IF NOT EXISTS stats JSONB;
ALTER TABLE home_cms ADD COLUMN IF NOT EXISTS seo JSONB;
ALTER TABLE home_cms ADD COLUMN IF NOT EXISTS contact JSONB;
ALTER TABLE home_cms ADD COLUMN IF NOT EXISTS footer JSONB;
ALTER TABLE home_cms ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE home_cms ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- ── E) clients extension (003-owned base; 038 owns client_account_id only) ───
DO $$
BEGIN
  IF to_regclass('public.clients') IS NULL THEN
    RAISE EXCEPTION
      '038_marketplace_portal: BLOCK_AND_MANUAL_REVIEW (reason_code=MISSING_BASE_TABLE) — clients missing (owned by Migration 003; 038 cannot invent it)';
  END IF;
END $$;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_account_id TEXT;

-- ═══════════════════════════════════════════════════════════════════════════
-- Type validation + NULL required blocks
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  spec RECORD;
  actual_udt TEXT;
  null_cnt BIGINT;
  tbl TEXT;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('marketplace_services','id','uuid'),
      ('marketplace_services','user_id','text'),
      ('marketplace_services','office_name','text'),
      ('marketplace_services','title','text'),
      ('marketplace_services','description','text'),
      ('marketplace_services','category','text'),
      ('marketplace_services','price','numeric'),
      ('marketplace_services','currency','text'),
      ('marketplace_services','duration_minutes','int4'),
      ('marketplace_services','tags','text'),
      ('marketplace_services','is_active','bool'),
      ('marketplace_services','rating','numeric'),
      ('marketplace_services','total_reviews','int4'),
      ('marketplace_services','total_orders','int4'),
      ('marketplace_services','created_at','timestamptz'),
      ('marketplace_services','updated_at','timestamptz'),
      ('marketplace_orders','id','uuid'),
      ('marketplace_orders','service_id','text'),
      ('marketplace_orders','service_title','text'),
      ('marketplace_orders','seller_id','text'),
      ('marketplace_orders','buyer_name','text'),
      ('marketplace_orders','buyer_email','text'),
      ('marketplace_orders','buyer_phone','text'),
      ('marketplace_orders','amount','numeric'),
      ('marketplace_orders','notes','text'),
      ('marketplace_orders','status','text'),
      ('marketplace_orders','case_id','text'),
      ('marketplace_orders','created_at','timestamptz'),
      ('marketplace_deals','id','uuid'),
      ('marketplace_deals','service_id','text'),
      ('marketplace_deals','service_title','text'),
      ('marketplace_deals','seller_id','text'),
      ('marketplace_deals','buyer_name','text'),
      ('marketplace_deals','buyer_email','text'),
      ('marketplace_deals','buyer_phone','text'),
      ('marketplace_deals','initial_price','numeric'),
      ('marketplace_deals','final_price','numeric'),
      ('marketplace_deals','status','text'),
      ('marketplace_deals','notes','text'),
      ('marketplace_deals','case_id','text'),
      ('marketplace_deals','created_at','timestamptz'),
      ('marketplace_deal_offers','id','uuid'),
      ('marketplace_deal_offers','deal_id','text'),
      ('marketplace_deal_offers','from_role','text'),
      ('marketplace_deal_offers','price','numeric'),
      ('marketplace_deal_offers','message','text'),
      ('marketplace_deal_offers','created_at','timestamptz'),
      ('client_portal_tokens','id','text'),
      ('client_portal_tokens','case_id','text'),
      ('client_portal_tokens','token','text'),
      ('client_portal_tokens','client_email','text'),
      ('client_portal_tokens','client_name','text'),
      ('client_portal_tokens','expires_at','timestamptz'),
      ('client_portal_tokens','last_accessed','timestamptz'),
      ('client_portal_tokens','access_count','int4'),
      ('client_portal_tokens','show_invoices','bool'),
      ('client_portal_tokens','show_timeline','bool'),
      ('client_portal_tokens','allowed_to_upload','bool'),
      ('client_portal_tokens','shared_documents','jsonb'),
      ('client_portal_tokens','created_at','timestamptz'),
      ('case_timeline','id','text'),
      ('case_timeline','case_id','text'),
      ('case_timeline','entry_type','text'),
      ('case_timeline','title','text'),
      ('case_timeline','description','text'),
      ('case_timeline','happened_at','timestamptz'),
      ('case_timeline','is_shared','bool'),
      ('case_timeline','created_by','text'),
      ('case_timeline','created_at','timestamptz'),
      ('portal_uploads','id','text'),
      ('portal_uploads','portal_token','text'),
      ('portal_uploads','case_id','text'),
      ('portal_uploads','file_name','text'),
      ('portal_uploads','file_size','int4'),
      ('portal_uploads','file_type','text'),
      ('portal_uploads','file_path','text'),
      ('portal_uploads','uploaded_at','timestamptz'),
      ('portal_uploads','is_read','bool'),
      ('client_accounts','id','text'),
      ('client_accounts','email','text'),
      ('client_accounts','password_hash','text'),
      ('client_accounts','name','text'),
      ('client_accounts','phone','text'),
      ('client_accounts','email_verified','bool'),
      ('client_accounts','otp','text'),
      ('client_accounts','otp_expires','timestamptz'),
      ('client_accounts','created_at','timestamptz'),
      ('client_accounts','updated_at','timestamptz'),
      ('client_sessions','id','text'),
      ('client_sessions','client_id','text'),
      ('client_sessions','token','text'),
      ('client_sessions','expires_at','timestamptz'),
      ('client_sessions','created_at','timestamptz'),
      ('client_case_links','id','text'),
      ('client_case_links','client_id','text'),
      ('client_case_links','case_id','text'),
      ('client_case_links','portal_token_id','text'),
      ('client_case_links','portal_token','text'),
      ('client_case_links','office_id','text'),
      ('client_case_links','linked_at','timestamptz'),
      ('home_cms','id','int4'),
      ('home_cms','hero','jsonb'),
      ('home_cms','trust','jsonb'),
      ('home_cms','features','jsonb'),
      ('home_cms','cta_section','jsonb'),
      ('home_cms','announcement','jsonb'),
      ('home_cms','stats','jsonb'),
      ('home_cms','seo','jsonb'),
      ('home_cms','contact','jsonb'),
      ('home_cms','footer','jsonb'),
      ('home_cms','updated_at','timestamptz'),
      ('home_cms','updated_by','text')
    ) AS t(table_name, column_name, udt_name)
  LOOP
    SELECT c.udt_name INTO actual_udt
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = spec.table_name
      AND c.column_name = spec.column_name;
    IF actual_udt IS NULL OR actual_udt IS DISTINCT FROM spec.udt_name THEN
      RAISE EXCEPTION
        '038_marketplace_portal: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — %.% has udt %, expected %',
        spec.table_name, spec.column_name, coalesce(actual_udt, '<missing>'), spec.udt_name;
    END IF;
  END LOOP;

  SELECT c.udt_name INTO actual_udt
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'clients'
    AND c.column_name = 'client_account_id';
  IF actual_udt IS NULL OR actual_udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION
      '038_marketplace_portal: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — clients.client_account_id has udt %, expected text',
      coalesce(actual_udt, '<missing>');
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM marketplace_services
  WHERE id IS NULL OR user_id IS NULL OR title IS NULL OR category IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '038_marketplace_portal: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — marketplace_services has % NULL required row(s)', null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM marketplace_orders
  WHERE id IS NULL OR service_id IS NULL OR seller_id IS NULL OR buyer_name IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '038_marketplace_portal: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — marketplace_orders has % NULL required row(s)', null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM marketplace_deals
  WHERE id IS NULL OR service_id IS NULL OR seller_id IS NULL OR buyer_name IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '038_marketplace_portal: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — marketplace_deals has % NULL required row(s)', null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM marketplace_deal_offers
  WHERE id IS NULL OR deal_id IS NULL OR from_role IS NULL OR price IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '038_marketplace_portal: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — marketplace_deal_offers has % NULL required row(s)', null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM client_portal_tokens
  WHERE id IS NULL OR case_id IS NULL OR token IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '038_marketplace_portal: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — client_portal_tokens has % NULL required row(s)', null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM case_timeline
  WHERE id IS NULL OR case_id IS NULL OR entry_type IS NULL OR title IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '038_marketplace_portal: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — case_timeline has % NULL required row(s)', null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM portal_uploads
  WHERE id IS NULL OR portal_token IS NULL OR file_name IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '038_marketplace_portal: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — portal_uploads has % NULL required row(s)', null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM client_accounts
  WHERE id IS NULL OR email IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '038_marketplace_portal: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — client_accounts has % NULL required row(s)', null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM client_sessions
  WHERE id IS NULL OR client_id IS NULL OR token IS NULL OR expires_at IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '038_marketplace_portal: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — client_sessions has % NULL required row(s)', null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM client_case_links
  WHERE id IS NULL OR client_id IS NULL OR case_id IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '038_marketplace_portal: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — client_case_links has % NULL required row(s)', null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM home_cms
  WHERE id IS NULL OR hero IS NULL OR trust IS NULL OR features IS NULL
    OR cta_section IS NULL OR announcement IS NULL OR stats IS NULL
    OR seo IS NULL OR contact IS NULL OR footer IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '038_marketplace_portal: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — home_cms has % NULL required row(s)', null_cnt;
  END IF;
END $$;

-- Safe defaults (exact Runtime)
ALTER TABLE marketplace_services ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE marketplace_services ALTER COLUMN price SET DEFAULT 0;
ALTER TABLE marketplace_services ALTER COLUMN currency SET DEFAULT 'SAR';
ALTER TABLE marketplace_services ALTER COLUMN is_active SET DEFAULT true;
ALTER TABLE marketplace_services ALTER COLUMN rating SET DEFAULT 0;
ALTER TABLE marketplace_services ALTER COLUMN total_reviews SET DEFAULT 0;
ALTER TABLE marketplace_services ALTER COLUMN total_orders SET DEFAULT 0;
ALTER TABLE marketplace_services ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE marketplace_services ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE marketplace_orders ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE marketplace_orders ALTER COLUMN amount SET DEFAULT 0;
ALTER TABLE marketplace_orders ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE marketplace_orders ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE marketplace_deals ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE marketplace_deals ALTER COLUMN status SET DEFAULT 'open';
ALTER TABLE marketplace_deals ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE marketplace_deal_offers ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE marketplace_deal_offers ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE client_portal_tokens ALTER COLUMN access_count SET DEFAULT 0;
ALTER TABLE client_portal_tokens ALTER COLUMN show_invoices SET DEFAULT true;
ALTER TABLE client_portal_tokens ALTER COLUMN show_timeline SET DEFAULT true;
ALTER TABLE client_portal_tokens ALTER COLUMN allowed_to_upload SET DEFAULT false;
ALTER TABLE client_portal_tokens ALTER COLUMN shared_documents SET DEFAULT '[]';
ALTER TABLE client_portal_tokens ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE case_timeline ALTER COLUMN entry_type SET DEFAULT 'note';
ALTER TABLE case_timeline ALTER COLUMN happened_at SET DEFAULT NOW();
ALTER TABLE case_timeline ALTER COLUMN is_shared SET DEFAULT true;
ALTER TABLE case_timeline ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE portal_uploads ALTER COLUMN uploaded_at SET DEFAULT NOW();
ALTER TABLE portal_uploads ALTER COLUMN is_read SET DEFAULT false;

ALTER TABLE client_accounts ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE client_accounts ALTER COLUMN email_verified SET DEFAULT false;
ALTER TABLE client_accounts ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE client_accounts ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE client_sessions ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE client_sessions ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE client_case_links ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE client_case_links ALTER COLUMN linked_at SET DEFAULT NOW();

ALTER TABLE home_cms ALTER COLUMN id SET DEFAULT 1;
ALTER TABLE home_cms ALTER COLUMN hero SET DEFAULT '{}';
ALTER TABLE home_cms ALTER COLUMN trust SET DEFAULT '{}';
ALTER TABLE home_cms ALTER COLUMN features SET DEFAULT '{}';
ALTER TABLE home_cms ALTER COLUMN cta_section SET DEFAULT '{}';
ALTER TABLE home_cms ALTER COLUMN announcement SET DEFAULT '{}';
ALTER TABLE home_cms ALTER COLUMN stats SET DEFAULT '{}';
ALTER TABLE home_cms ALTER COLUMN seo SET DEFAULT '{}';
ALTER TABLE home_cms ALTER COLUMN contact SET DEFAULT '{}';
ALTER TABLE home_cms ALTER COLUMN footer SET DEFAULT '{}';
ALTER TABLE home_cms ALTER COLUMN updated_at SET DEFAULT NOW();

-- SET NOT NULL after NULL probes
DO $$
BEGIN
  ALTER TABLE marketplace_services ALTER COLUMN id SET NOT NULL;
  ALTER TABLE marketplace_services ALTER COLUMN user_id SET NOT NULL;
  ALTER TABLE marketplace_services ALTER COLUMN title SET NOT NULL;
  ALTER TABLE marketplace_services ALTER COLUMN category SET NOT NULL;

  ALTER TABLE marketplace_orders ALTER COLUMN id SET NOT NULL;
  ALTER TABLE marketplace_orders ALTER COLUMN service_id SET NOT NULL;
  ALTER TABLE marketplace_orders ALTER COLUMN seller_id SET NOT NULL;
  ALTER TABLE marketplace_orders ALTER COLUMN buyer_name SET NOT NULL;

  ALTER TABLE marketplace_deals ALTER COLUMN id SET NOT NULL;
  ALTER TABLE marketplace_deals ALTER COLUMN service_id SET NOT NULL;
  ALTER TABLE marketplace_deals ALTER COLUMN seller_id SET NOT NULL;
  ALTER TABLE marketplace_deals ALTER COLUMN buyer_name SET NOT NULL;

  ALTER TABLE marketplace_deal_offers ALTER COLUMN id SET NOT NULL;
  ALTER TABLE marketplace_deal_offers ALTER COLUMN deal_id SET NOT NULL;
  ALTER TABLE marketplace_deal_offers ALTER COLUMN from_role SET NOT NULL;
  ALTER TABLE marketplace_deal_offers ALTER COLUMN price SET NOT NULL;

  ALTER TABLE client_portal_tokens ALTER COLUMN id SET NOT NULL;
  ALTER TABLE client_portal_tokens ALTER COLUMN case_id SET NOT NULL;
  ALTER TABLE client_portal_tokens ALTER COLUMN token SET NOT NULL;

  ALTER TABLE case_timeline ALTER COLUMN id SET NOT NULL;
  ALTER TABLE case_timeline ALTER COLUMN case_id SET NOT NULL;
  ALTER TABLE case_timeline ALTER COLUMN entry_type SET NOT NULL;
  ALTER TABLE case_timeline ALTER COLUMN title SET NOT NULL;

  ALTER TABLE portal_uploads ALTER COLUMN id SET NOT NULL;
  ALTER TABLE portal_uploads ALTER COLUMN portal_token SET NOT NULL;
  ALTER TABLE portal_uploads ALTER COLUMN file_name SET NOT NULL;

  ALTER TABLE client_accounts ALTER COLUMN id SET NOT NULL;
  ALTER TABLE client_accounts ALTER COLUMN email SET NOT NULL;

  ALTER TABLE client_sessions ALTER COLUMN id SET NOT NULL;
  ALTER TABLE client_sessions ALTER COLUMN client_id SET NOT NULL;
  ALTER TABLE client_sessions ALTER COLUMN token SET NOT NULL;
  ALTER TABLE client_sessions ALTER COLUMN expires_at SET NOT NULL;

  ALTER TABLE client_case_links ALTER COLUMN id SET NOT NULL;
  ALTER TABLE client_case_links ALTER COLUMN client_id SET NOT NULL;
  ALTER TABLE client_case_links ALTER COLUMN case_id SET NOT NULL;

  ALTER TABLE home_cms ALTER COLUMN id SET NOT NULL;
  ALTER TABLE home_cms ALTER COLUMN hero SET NOT NULL;
  ALTER TABLE home_cms ALTER COLUMN trust SET NOT NULL;
  ALTER TABLE home_cms ALTER COLUMN features SET NOT NULL;
  ALTER TABLE home_cms ALTER COLUMN cta_section SET NOT NULL;
  ALTER TABLE home_cms ALTER COLUMN announcement SET NOT NULL;
  ALTER TABLE home_cms ALTER COLUMN stats SET NOT NULL;
  ALTER TABLE home_cms ALTER COLUMN seo SET NOT NULL;
  ALTER TABLE home_cms ALTER COLUMN contact SET NOT NULL;
  ALTER TABLE home_cms ALTER COLUMN footer SET NOT NULL;
END $$;

-- PK repair (id only; home_cms uses INTEGER id)
DO $$
DECLARE
  has_pk BOOLEAN;
  null_cnt BIGINT;
  dup_cnt BIGINT;
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'marketplace_services','marketplace_orders','marketplace_deals','marketplace_deal_offers'
  ]
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = format('public.%I', tbl)::regclass AND c.contype = 'p'
    ) INTO has_pk;
    IF NOT has_pk THEN
      EXECUTE format('SELECT COUNT(*) FROM %I WHERE id IS NULL', tbl) INTO null_cnt;
      IF null_cnt > 0 THEN
        RAISE EXCEPTION '038_marketplace_portal: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — NULL id blocks PK on %', tbl;
      END IF;
      EXECUTE format('SELECT COUNT(*) FROM (SELECT id FROM %I GROUP BY id HAVING COUNT(*) > 1) d', tbl)
        INTO dup_cnt;
      IF dup_cnt > 0 THEN
        RAISE EXCEPTION '038_marketplace_portal: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — duplicate id blocks PK on %', tbl;
      END IF;
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I PRIMARY KEY (id)', tbl, tbl || '_pkey');
    ELSIF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = format('public.%I', tbl)::regclass AND c.contype = 'p'
        AND pg_get_constraintdef(c.oid) ~* '\(id\)'
        AND pg_get_constraintdef(c.oid) !~* ','
    ) THEN
      RAISE EXCEPTION '038_marketplace_portal: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — % PK is not solely (id)', tbl;
    END IF;
  END LOOP;

  FOREACH tbl IN ARRAY ARRAY[
    'client_portal_tokens','case_timeline','portal_uploads',
    'client_accounts','client_sessions','client_case_links'
  ]
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = format('public.%I', tbl)::regclass AND c.contype = 'p'
    ) INTO has_pk;
    IF NOT has_pk THEN
      EXECUTE format('SELECT COUNT(*) FROM %I WHERE id IS NULL', tbl) INTO null_cnt;
      IF null_cnt > 0 THEN
        RAISE EXCEPTION '038_marketplace_portal: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — NULL id blocks PK on %', tbl;
      END IF;
      EXECUTE format('SELECT COUNT(*) FROM (SELECT id FROM %I GROUP BY id HAVING COUNT(*) > 1) d', tbl)
        INTO dup_cnt;
      IF dup_cnt > 0 THEN
        RAISE EXCEPTION '038_marketplace_portal: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — duplicate id blocks PK on %', tbl;
      END IF;
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I PRIMARY KEY (id)', tbl, tbl || '_pkey');
    ELSIF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = format('public.%I', tbl)::regclass AND c.contype = 'p'
        AND pg_get_constraintdef(c.oid) ~* '\(id\)'
        AND pg_get_constraintdef(c.oid) !~* ','
    ) THEN
      RAISE EXCEPTION '038_marketplace_portal: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — % PK is not solely (id)', tbl;
    END IF;
  END LOOP;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.home_cms'::regclass AND c.contype = 'p'
  ) INTO has_pk;
  IF NOT has_pk THEN
    SELECT COUNT(*) INTO null_cnt FROM home_cms WHERE id IS NULL;
    IF null_cnt > 0 THEN
      RAISE EXCEPTION '038_marketplace_portal: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — NULL id blocks PK on home_cms';
    END IF;
    SELECT COUNT(*) INTO dup_cnt FROM (SELECT id FROM home_cms GROUP BY id HAVING COUNT(*) > 1) d;
    IF dup_cnt > 0 THEN
      RAISE EXCEPTION '038_marketplace_portal: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — duplicate id blocks PK on home_cms';
    END IF;
    ALTER TABLE home_cms ADD CONSTRAINT home_cms_pkey PRIMARY KEY (id);
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.home_cms'::regclass AND c.contype = 'p'
      AND pg_get_constraintdef(c.oid) ~* '\(id\)'
      AND pg_get_constraintdef(c.oid) !~* ','
  ) THEN
    RAISE EXCEPTION '038_marketplace_portal: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — home_cms PK is not solely (id)';
  END IF;
END $$;

-- Runtime UNIQUE arbiters (exact columns/order only)
DO $$
DECLARE
  uq RECORD;
  dup_cnt BIGINT;
  has_uq BOOLEAN;
  uq_cols TEXT[];
  expected_sorted TEXT[];
  uq_sorted TEXT[];
  near_miss BOOLEAN;
  idx_rec RECORD;
BEGIN
  FOR uq IN
    SELECT * FROM (VALUES
      ('client_portal_tokens', 'client_portal_tokens_token_key', ARRAY['token']::text[],
       'UNIQUE\s*\(\s*token\s*\)', 'token'),
      ('client_accounts', 'client_accounts_email_key', ARRAY['email']::text[],
       'UNIQUE\s*\(\s*email\s*\)', 'email'),
      ('client_sessions', 'client_sessions_token_key', ARRAY['token']::text[],
       'UNIQUE\s*\(\s*token\s*\)', 'token'),
      ('client_case_links', 'client_case_links_client_id_case_id_key', ARRAY['client_id','case_id']::text[],
       'UNIQUE\s*\(\s*client_id\s*,\s*case_id\s*\)', 'client_id, case_id')
    ) AS t(table_name, constraint_name, cols, def_re, dup_probe_cols)
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = format('public.%I', uq.table_name)::regclass AND c.contype = 'u'
        AND c.conname = uq.constraint_name
        AND pg_get_constraintdef(c.oid) !~* uq.def_re
    ) THEN
      RAISE EXCEPTION
        '038_marketplace_portal: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — % wrong shape',
        uq.constraint_name;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = format('public.%I', uq.table_name)::regclass AND c.contype = 'u'
        AND pg_get_constraintdef(c.oid) ~* uq.def_re
    ) OR EXISTS (
      SELECT 1 FROM pg_index x
      WHERE x.indrelid = format('public.%I', uq.table_name)::regclass
        AND x.indisunique AND NOT x.indisprimary
        AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
        AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
             FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
             JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
            = uq.cols
    ) INTO has_uq;

    IF EXISTS (
      SELECT 1 FROM pg_index x
      WHERE x.indrelid = format('public.%I', uq.table_name)::regclass
        AND x.indisunique AND NOT x.indisprimary
        AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
             FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
             JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
            = uq.cols
        AND (
          x.indisvalid IS DISTINCT FROM TRUE OR x.indisready IS DISTINCT FROM TRUE
          OR x.indpred IS NOT NULL OR x.indexprs IS NOT NULL
        )
    ) THEN
      RAISE EXCEPTION
        '038_marketplace_portal: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — % UNIQUE index invalid/not-ready/partial/expression',
        uq.constraint_name;
    END IF;

    IF NOT has_uq THEN
      near_miss := false;
      SELECT array_agg(x ORDER BY x) INTO expected_sorted FROM unnest(uq.cols) AS x;
      FOR idx_rec IN
        SELECT (
          SELECT array_agg(a.attname::text ORDER BY k.ordinality)
          FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
          JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped
        ) AS cols
        FROM pg_index x
        WHERE x.indrelid = format('public.%I', uq.table_name)::regclass
          AND x.indisunique AND NOT x.indisprimary
      LOOP
        uq_cols := idx_rec.cols;
        IF uq_cols IS NULL THEN CONTINUE; END IF;
        SELECT array_agg(x ORDER BY x) INTO uq_sorted FROM unnest(uq_cols) AS x;
        IF uq_cols IS DISTINCT FROM uq.cols
           AND (
             (cardinality(uq_cols) > cardinality(uq.cols) AND uq_cols[1:cardinality(uq.cols)] = uq.cols)
             OR (cardinality(uq_cols) = cardinality(uq.cols) AND uq_sorted IS NOT DISTINCT FROM expected_sorted)
             OR (cardinality(uq_cols) > cardinality(uq.cols) AND uq.cols <@ uq_cols)
           ) THEN
          near_miss := true;
          EXIT;
        END IF;
      END LOOP;
      IF near_miss THEN
        RAISE EXCEPTION
          '038_marketplace_portal: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — % has wider/wrong-order UNIQUE near (%); exact contract UNIQUE required',
          uq.table_name, uq.dup_probe_cols;
      END IF;
    END IF;

    IF uq.table_name = 'client_portal_tokens' THEN
      SELECT COUNT(*) INTO dup_cnt FROM (
        SELECT token FROM client_portal_tokens GROUP BY token HAVING COUNT(*) > 1
      ) d;
    ELSIF uq.table_name = 'client_accounts' THEN
      SELECT COUNT(*) INTO dup_cnt FROM (
        SELECT email FROM client_accounts GROUP BY email HAVING COUNT(*) > 1
      ) d;
    ELSIF uq.table_name = 'client_sessions' THEN
      SELECT COUNT(*) INTO dup_cnt FROM (
        SELECT token FROM client_sessions GROUP BY token HAVING COUNT(*) > 1
      ) d;
    ELSE
      SELECT COUNT(*) INTO dup_cnt FROM (
        SELECT client_id, case_id FROM client_case_links GROUP BY client_id, case_id HAVING COUNT(*) > 1
      ) d;
    END IF;
    IF dup_cnt > 0 THEN
      RAISE EXCEPTION
        '038_marketplace_portal: BLOCK_AND_MANUAL_REVIEW (reason_code=DUPLICATE_UNIQUE_KEY) — % duplicate (% ) group(s) on %',
        dup_cnt, uq.dup_probe_cols, uq.table_name;
    END IF;

    IF NOT has_uq THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I UNIQUE (%s)',
        uq.table_name, uq.constraint_name,
        array_to_string(uq.cols, ', ')
      );
    END IF;
  END LOOP;
END $$;

-- FK CASCADE (fail-closed on orphans; never NOT VALID silent ready)
DO $$
DECLARE
  fk RECORD;
  fk_ok BOOLEAN;
  orphan_cnt BIGINT;
  child_col TEXT;
  child_attnum INT2;
  ref_attnum INT2;
BEGIN
  FOR fk IN
    SELECT * FROM (VALUES
      ('client_sessions', 'client_sessions_client_id_fkey', 'client_id', 'client_accounts', 'id'),
      ('client_case_links', 'client_case_links_client_id_fkey', 'client_id', 'client_accounts', 'id')
    ) AS t(child_table, constraint_name, child_column, ref_table, ref_column)
  LOOP
    SELECT a.attnum INTO child_attnum
    FROM pg_attribute a
    WHERE a.attrelid = format('public.%I', fk.child_table)::regclass
      AND a.attname = fk.child_column AND NOT a.attisdropped;
    SELECT a.attnum INTO ref_attnum
    FROM pg_attribute a
    WHERE a.attrelid = format('public.%I', fk.ref_table)::regclass
      AND a.attname = fk.ref_column AND NOT a.attisdropped;

    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class ref ON ref.oid = c.confrelid
      WHERE c.conrelid = format('public.%I', fk.child_table)::regclass
        AND c.contype = 'f'
        AND c.conname = fk.constraint_name
        AND ref.relname = fk.ref_table
        AND c.confdeltype = 'c'
        AND c.convalidated
        AND array_length(c.conkey, 1) = 1
        AND c.conkey[1] = child_attnum
        AND array_length(c.confkey, 1) = 1
        AND c.confkey[1] = ref_attnum
    ) INTO fk_ok;

    IF fk_ok THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = format('public.%I', fk.child_table)::regclass
        AND c.contype = 'f'
        AND c.conname = fk.constraint_name
        AND NOT (
          EXISTS (SELECT 1 FROM pg_class ref WHERE ref.oid = c.confrelid AND ref.relname = fk.ref_table)
          AND c.confdeltype = 'c'
          AND array_length(c.conkey, 1) = 1
          AND c.conkey[1] = child_attnum
          AND array_length(c.confkey, 1) = 1
          AND c.confkey[1] = ref_attnum
        )
    ) THEN
      RAISE EXCEPTION
        '038_marketplace_portal: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_FK) — % wrong FK shape',
        fk.constraint_name;
    END IF;

    EXECUTE format(
      $q$SELECT COUNT(*) FROM %I c
         WHERE c.%I IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM %I p WHERE p.%I = c.%I
           )$q$,
      fk.child_table, fk.child_column,
      fk.ref_table, fk.ref_column, fk.child_column
    ) INTO orphan_cnt;

    IF orphan_cnt > 0 THEN
      RAISE EXCEPTION
        '038_marketplace_portal: BLOCK_AND_MANUAL_REVIEW (reason_code=ORPHAN_FK) — % has % orphan % row(s) referencing %',
        fk.child_table, orphan_cnt, fk.child_column, fk.ref_table;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = format('public.%I', fk.child_table)::regclass
        AND c.contype = 'f'
        AND c.conname = fk.constraint_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(%I) ON DELETE CASCADE',
        fk.child_table, fk.constraint_name, fk.child_column, fk.ref_table, fk.ref_column
      );
    ELSE
      EXECUTE format('ALTER TABLE %I VALIDATE CONSTRAINT %I', fk.child_table, fk.constraint_name);
    END IF;
  END LOOP;
END $$;

-- Optional safe DML seed for home_cms singleton
INSERT INTO home_cms (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Post-apply readiness
DO $$
DECLARE
  tbl TEXT;
  fk RECORD;
  uq RECORD;
  child_attnum INT2;
  ref_attnum INT2;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'marketplace_services','marketplace_orders','marketplace_deals','marketplace_deal_offers',
    'client_portal_tokens','case_timeline','portal_uploads',
    'client_accounts','client_sessions','client_case_links','home_cms'
  ]
  LOOP
    IF to_regclass(format('public.%I', tbl)) IS NULL THEN
      RAISE EXCEPTION '038_marketplace_portal: POST_APPLY_READINESS_FAILED — missing table %', tbl;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid=format('public.%I',tbl)::regclass AND c.contype='p'
        AND pg_get_constraintdef(c.oid) ~* '\(id\)' AND pg_get_constraintdef(c.oid) !~* ','
    ) THEN
      RAISE EXCEPTION '038_marketplace_portal: POST_APPLY_READINESS_FAILED — % PK (id) missing or incompatible', tbl;
    END IF;
  END LOOP;

  IF to_regclass('public.clients') IS NULL THEN
    RAISE EXCEPTION '038_marketplace_portal: POST_APPLY_READINESS_FAILED — clients base table missing (003)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clients' AND column_name='client_account_id'
      AND udt_name='text'
  ) THEN
    RAISE EXCEPTION '038_marketplace_portal: POST_APPLY_READINESS_FAILED — clients.client_account_id TEXT missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='marketplace_orders' AND column_name='notes'
      AND udt_name='text'
  ) THEN
    RAISE EXCEPTION '038_marketplace_portal: POST_APPLY_READINESS_FAILED — marketplace_orders.notes TEXT missing';
  END IF;

  FOR uq IN
    SELECT * FROM (VALUES
      ('client_portal_tokens', ARRAY['token']::text[], 'UNIQUE\s*\(\s*token\s*\)'),
      ('client_accounts', ARRAY['email']::text[], 'UNIQUE\s*\(\s*email\s*\)'),
      ('client_sessions', ARRAY['token']::text[], 'UNIQUE\s*\(\s*token\s*\)'),
      ('client_case_links', ARRAY['client_id','case_id']::text[], 'UNIQUE\s*\(\s*client_id\s*,\s*case_id\s*\)')
    ) AS t(table_name, cols, def_re)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = format('public.%I', uq.table_name)::regclass AND c.contype = 'u'
        AND pg_get_constraintdef(c.oid) ~* uq.def_re
        AND c.convalidated
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_index x
      WHERE x.indrelid = format('public.%I', uq.table_name)::regclass
        AND x.indisunique AND NOT x.indisprimary
        AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
        AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
             FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
             JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
            = uq.cols
    ) THEN
      RAISE EXCEPTION '038_marketplace_portal: POST_APPLY_READINESS_FAILED — % UNIQUE(%) missing or not validated', uq.table_name, array_to_string(uq.cols, ',');
    END IF;
  END LOOP;

  FOR fk IN
    SELECT * FROM (VALUES
      ('client_sessions', 'client_sessions_client_id_fkey', 'client_id', 'client_accounts', 'id'),
      ('client_case_links', 'client_case_links_client_id_fkey', 'client_id', 'client_accounts', 'id')
    ) AS t(child_table, constraint_name, child_column, ref_table, ref_column)
  LOOP
    SELECT a.attnum INTO child_attnum
    FROM pg_attribute a
    WHERE a.attrelid = format('public.%I', fk.child_table)::regclass
      AND a.attname = fk.child_column AND NOT a.attisdropped;
    SELECT a.attnum INTO ref_attnum
    FROM pg_attribute a
    WHERE a.attrelid = format('public.%I', fk.ref_table)::regclass
      AND a.attname = fk.ref_column AND NOT a.attisdropped;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class ref ON ref.oid = c.confrelid
      WHERE c.conrelid = format('public.%I', fk.child_table)::regclass
        AND c.contype = 'f'
        AND c.conname = fk.constraint_name
        AND ref.relname = fk.ref_table
        AND c.confdeltype = 'c'
        AND c.convalidated
        AND array_length(c.conkey, 1) = 1
        AND c.conkey[1] = child_attnum
        AND array_length(c.confkey, 1) = 1
        AND c.confkey[1] = ref_attnum
    ) THEN
      RAISE EXCEPTION '038_marketplace_portal: POST_APPLY_READINESS_FAILED — % missing or not validated', fk.constraint_name;
    END IF;
  END LOOP;

  RAISE NOTICE '038_marketplace_portal: post-apply FULL READY (11 tables; clients.client_account_id; 4 UNIQUEs; 2 FK CASCADE)';
END $$;

COMMIT;
