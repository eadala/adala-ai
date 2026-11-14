-- Isolated runtime schema for ADALA-SEC-TENANT-P0-006 (adala_tenant_runtime)
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS office_members (
  office_id text NOT NULL,
  user_id text NOT NULL,
  role text NOT NULL DEFAULT 'owner',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (office_id, user_id)
);

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  office_id text,
  email text
);

CREATE TABLE IF NOT EXISTS office_registry (
  id text PRIMARY KEY,
  clerk_user_id text,
  status text NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS office_page (
  id uuid PRIMARY KEY,
  slug text UNIQUE,
  name text NOT NULL DEFAULT 'Office',
  plan text,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS office_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES office_page(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric,
  is_custom_quote boolean DEFAULT false,
  category text DEFAULT 'استشارات',
  delivery_days integer DEFAULT 1,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL,
  description text,
  amount numeric,
  status text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS office_ai_credits (
  office_id text PRIMARY KEY,
  office_name text,
  balance int NOT NULL DEFAULT 0,
  monthly_allowance int DEFAULT 100,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_credit_transactions (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id text NOT NULL,
  amount int NOT NULL,
  type text,
  description text,
  model text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_agent_logs (
  id text PRIMARY KEY,
  office_id text,
  user_id text,
  user_email text,
  command text,
  intent text,
  params jsonb,
  action_taken text,
  result jsonb,
  success boolean,
  error_message text,
  execution_ms int,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_workflows (
  id text PRIMARY KEY,
  office_id text,
  name text,
  description text,
  trigger_type text,
  schedule text,
  action_type text,
  action_params jsonb,
  mode text,
  is_active boolean DEFAULT true,
  created_by text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS whatsapp_settings (
  office_id text PRIMARY KEY,
  meta_phone_id text,
  webhook_secret text
);

CREATE TABLE IF NOT EXISTS messages (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id text,
  channel text,
  direction text,
  content text,
  status text,
  from_phone text,
  external_id text,
  category text,
  metadata text,
  updated_at timestamptz,
  created_at timestamptz DEFAULT now()
);

TRUNCATE office_members, users, office_registry, office_services, office_page, payment_transactions,
  office_ai_credits, ai_credit_transactions, ai_agent_logs, ai_workflows,
  whatsapp_settings, messages CASCADE;

INSERT INTO office_page (id, slug, name, plan) VALUES
  ('c9efc92a-41ab-46b4-9aa1-baf867882149', 'office-a', 'Office A', 'pro'),
  ('cfee909e-5821-4085-8c6a-90a3852ae437', 'office-b', 'Office B', 'pro');

INSERT INTO users (id, office_id, email) VALUES
  ('user-a-owner', 'c9efc92a-41ab-46b4-9aa1-baf867882149', 'a@test.local'),
  ('user-b-owner', 'cfee909e-5821-4085-8c6a-90a3852ae437', 'b@test.local'),
  ('user-a-lawyer', 'c9efc92a-41ab-46b4-9aa1-baf867882149', 'lawyer@test.local'),
  ('user-a-accountant', 'c9efc92a-41ab-46b4-9aa1-baf867882149', 'acct@test.local'),
  ('user-multi', 'c9efc92a-41ab-46b4-9aa1-baf867882149', 'multi@test.local'),
  ('user-revoked', 'c9efc92a-41ab-46b4-9aa1-baf867882149', 'revoked@test.local'),
  ('user-none', NULL, 'none@test.local'),
  ('user-platform-admin', NULL, 'platform@test.local');

INSERT INTO office_members (office_id, user_id, role, status) VALUES
  ('c9efc92a-41ab-46b4-9aa1-baf867882149', 'user-a-owner', 'owner', 'active'),
  ('cfee909e-5821-4085-8c6a-90a3852ae437', 'user-b-owner', 'owner', 'active'),
  ('c9efc92a-41ab-46b4-9aa1-baf867882149', 'user-a-lawyer', 'lawyer', 'active'),
  ('c9efc92a-41ab-46b4-9aa1-baf867882149', 'user-a-accountant', 'accountant', 'active'),
  ('c9efc92a-41ab-46b4-9aa1-baf867882149', 'user-multi', 'owner', 'active'),
  ('cfee909e-5821-4085-8c6a-90a3852ae437', 'user-multi', 'lawyer', 'active'),
  ('c9efc92a-41ab-46b4-9aa1-baf867882149', 'user-revoked', 'lawyer', 'revoked');

INSERT INTO office_services (id, office_id, name) VALUES
  ('11111111-1111-4111-8111-111111111111', 'c9efc92a-41ab-46b4-9aa1-baf867882149', 'Service A'),
  ('22222222-2222-4222-8222-222222222222', 'cfee909e-5821-4085-8c6a-90a3852ae437', 'Service B');

INSERT INTO payment_transactions (id, office_id, description, amount, status) VALUES
  ('11111111-1111-4111-8111-1111111111aa', 'c9efc92a-41ab-46b4-9aa1-baf867882149', 'Pay A', 100, 'completed'),
  ('22222222-2222-4222-8222-2222222222bb', 'cfee909e-5821-4085-8c6a-90a3852ae437', 'Pay B', 200, 'completed');

INSERT INTO office_ai_credits (office_id, office_name, balance) VALUES
  ('c9efc92a-41ab-46b4-9aa1-baf867882149', 'Office A', 50),
  ('cfee909e-5821-4085-8c6a-90a3852ae437', 'Office B', 80);

INSERT INTO ai_agent_logs (id, office_id, command, intent, success) VALUES
  ('log-a', 'c9efc92a-41ab-46b4-9aa1-baf867882149', 'cmd-a', 'test', true),
  ('log-b', 'cfee909e-5821-4085-8c6a-90a3852ae437', 'cmd-b', 'test', true);

INSERT INTO ai_workflows (id, office_id, name, action_type) VALUES
  ('wf-a', 'c9efc92a-41ab-46b4-9aa1-baf867882149', 'WF A', 'noop'),
  ('wf-b', 'cfee909e-5821-4085-8c6a-90a3852ae437', 'WF B', 'noop');

INSERT INTO whatsapp_settings (office_id, meta_phone_id) VALUES
  ('c9efc92a-41ab-46b4-9aa1-baf867882149', 'phone-a'),
  ('cfee909e-5821-4085-8c6a-90a3852ae437', 'phone-b');

INSERT INTO messages (id, office_id, channel, direction, content, status, external_id) VALUES
  ('msg-a', 'c9efc92a-41ab-46b4-9aa1-baf867882149', 'whatsapp', 'inbound', 'hello a', 'received', 'ext-a'),
  ('msg-b', 'cfee909e-5821-4085-8c6a-90a3852ae437', 'whatsapp', 'inbound', 'hello b', 'received', 'ext-b');

COMMIT;
