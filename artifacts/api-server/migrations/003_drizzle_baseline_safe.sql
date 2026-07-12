-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 003: Drizzle baseline (safe) — all core tables from 0000_baseline.sql
-- Source: lib/db/drizzle/0000_baseline.sql @ main
-- Apply manually on Production (never drizzle-kit push):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f artifacts/api-server/migrations/003_drizzle_baseline_safe.sql
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + guarded FK constraints
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "cases" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"case_type" text DEFAULT 'مدنية' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"client_name" text,
	"assigned_to" text,
	"office_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text,
	"office_id" text,
	"file_url" text NOT NULL,
	"file_type" text NOT NULL,
	"file_name" text,
	"ocr_text" text,
	"ai_summary" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "ai_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text,
	"document_id" text,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 3 NOT NULL,
	"input_text" text,
	"output_text" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"status" text DEFAULT 'active' NOT NULL,
	"role" text DEFAULT 'lawyer' NOT NULL,
	"accepted_terms" boolean DEFAULT false,
	"accepted_terms_at" timestamp,
	"accepted_privacy_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
CREATE TABLE IF NOT EXISTS "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text,
	"channel" text DEFAULT 'whatsapp' NOT NULL,
	"direction" text DEFAULT 'outbound' NOT NULL,
	"content" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"from_phone" text,
	"to_phone" text,
	"external_id" text,
	"category" text,
	"metadata" text,
	"updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"amount" real NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "plan_notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text DEFAULT 'plan_change' NOT NULL,
	"old_plan" text,
	"new_plan" text,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_name" text NOT NULL,
	"plan_price" real NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"start_date" timestamp DEFAULT now() NOT NULL,
	"end_date" timestamp NOT NULL,
	"accepted_terms" boolean DEFAULT false,
	"accepted_terms_at" timestamp,
	"ip_address" varchar(100),
	"user_agent" text
);
CREATE TABLE IF NOT EXISTS "usage_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"feature" text NOT NULL,
	"units" integer NOT NULL,
	"cost" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"user_full_name" text,
	"action" text NOT NULL,
	"resource" text NOT NULL,
	"resource_id" text,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'lawyer' NOT NULL,
	"token" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
CREATE TABLE IF NOT EXISTS "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"permissions" text DEFAULT '[]' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
CREATE TABLE IF NOT EXISTS "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"type" text DEFAULT 'general' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"parties" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"content" text,
	"ai_generated" boolean DEFAULT false NOT NULL,
	"risk_score" text,
	"notes" text,
	"expires_at" timestamp,
	"signed_at" timestamp,
	"client_id" uuid,
	"case_id" uuid,
	"office_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"type" text DEFAULT 'individual' NOT NULL,
	"email" text,
	"phone" text,
	"company" text,
	"national_id" text,
	"notes" text,
	"status" text DEFAULT 'active' NOT NULL,
	"source" text DEFAULT 'direct',
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"office_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "arbitration_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"type" text DEFAULT 'arbitration' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"claimant" text NOT NULL,
	"respondent" text NOT NULL,
	"arbitrator" text,
	"claim_amount" text,
	"description" text,
	"parties" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"documents" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sessions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"decision" text,
	"decision_date" timestamp,
	"filed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"check_in" timestamp,
	"check_out" timestamp,
	"work_date" date NOT NULL,
	"status" text DEFAULT 'present' NOT NULL,
	"notes" text,
	"ip_address" text,
	"check_in_lat" numeric,
	"check_in_lng" numeric,
	"check_out_lat" numeric,
	"check_out_lng" numeric,
	"location_verified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "employee_investigations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'open' NOT NULL,
	"outcome" text,
	"opened_by" text,
	"committee" text,
	"session_date" date,
	"closed_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "employee_warnings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"type" text DEFAULT 'written' NOT NULL,
	"reason" text NOT NULL,
	"description" text,
	"issued_by" text,
	"status" text DEFAULT 'active' NOT NULL,
	"appeal_notes" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_no" text NOT NULL,
	"full_name" text NOT NULL,
	"email" text,
	"phone" text,
	"national_id" text,
	"job_title" text NOT NULL,
	"department" text,
	"manager_id" uuid,
	"salary" numeric DEFAULT '0' NOT NULL,
	"salary_type" text DEFAULT 'monthly' NOT NULL,
	"hire_date" date,
	"contract_type" text DEFAULT 'permanent',
	"status" text DEFAULT 'active' NOT NULL,
	"gender" text,
	"nationality" text DEFAULT 'سعودي',
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "leaves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"type" text DEFAULT 'annual' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"days" integer DEFAULT 1 NOT NULL,
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_by" text,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "office_location" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text DEFAULT 'المكتب الرئيسي' NOT NULL,
	"latitude" numeric NOT NULL,
	"longitude" numeric NOT NULL,
	"radius" integer DEFAULT 200 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "payroll" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"month" text NOT NULL,
	"year" integer NOT NULL,
	"base_salary" numeric DEFAULT '0' NOT NULL,
	"allowances" numeric DEFAULT '0' NOT NULL,
	"deductions" numeric DEFAULT '0' NOT NULL,
	"gosi" numeric DEFAULT '0' NOT NULL,
	"net_salary" numeric DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"paid_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "office_branding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"office_name" text,
	"office_name_en" text,
	"tagline" text,
	"phone" text,
	"email" text,
	"address" text,
	"website" text,
	"license_no" text,
	"logo_url" text,
	"stamp_url" text,
	"signature_url" text,
	"favicon_url" text,
	"login_background_url" text,
	"watermark_url" text,
	"letterhead_url" text,
	"invoice_template" text DEFAULT 'classic_legal',
	"primary_color" text DEFAULT '#1e3a5f',
	"secondary_color" text DEFAULT '#c9a84c',
	"subscription_tier" text DEFAULT 'basic' NOT NULL,
	"show_adalah_logo" boolean DEFAULT true NOT NULL,
	"show_adalah_footer" boolean DEFAULT true NOT NULL,
	"adalah_logo_size" text DEFAULT 'normal' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "client_invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"client_id" text,
	"case_id" text,
	"office_id" text,
	"title" text NOT NULL,
	"items" text DEFAULT '[]' NOT NULL,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"vat_rate" integer DEFAULT 15 NOT NULL,
	"vat_amount" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'SAR' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"due_date" text,
	"notes" text,
	"stripe_payment_link_id" text,
	"stripe_payment_link_url" text,
	"stripe_price_id" text,
	"stripe_product_id" text,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
CREATE TABLE IF NOT EXISTS "office_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"excerpt" text,
	"content" text NOT NULL,
	"category" text DEFAULT 'قانوني',
	"is_published" boolean DEFAULT false,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "office_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"subdomain" varchar(100) NOT NULL,
	"custom_domain" varchar(255),
	"is_verified" boolean DEFAULT false,
	"ssl_enabled" boolean DEFAULT false,
	"cname_target" text DEFAULT 'cname.adala-ai.sa',
	"verification_token" text,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "office_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"service_id" uuid,
	"client_name" text NOT NULL,
	"client_phone" text NOT NULL,
	"client_email" text,
	"notes" text,
	"amount" numeric,
	"status" text DEFAULT 'pending' NOT NULL,
	"is_quote_request" boolean DEFAULT false,
	"stripe_session_id" text,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "office_page" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"plan" text DEFAULT 'starter',
	"logo" text,
	"tagline" text,
	"about" text,
	"license_number" text,
	"experience_years" integer DEFAULT 0,
	"phone" text,
	"whatsapp" text,
	"email" text,
	"address" text,
	"city" text,
	"regions" text,
	"facebook" text,
	"twitter" text,
	"linkedin" text,
	"website" text,
	"cases_count" integer DEFAULT 0,
	"clients_count" integer DEFAULT 0,
	"success_rate" integer DEFAULT 0,
	"show_stats" boolean DEFAULT true,
	"is_published" boolean DEFAULT false,
	"maps_embed_url" text,
	"google_maps_url" text,
	"primary_color" text DEFAULT '#C9A84C',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "office_page_slug_unique" UNIQUE("slug")
);
CREATE TABLE IF NOT EXISTS "office_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"client_name" text NOT NULL,
	"rating" integer DEFAULT 5 NOT NULL,
	"comment" text,
	"is_approved" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "office_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" numeric,
	"is_custom_quote" boolean DEFAULT false,
	"category" text DEFAULT 'استشارات',
	"delivery_days" integer DEFAULT 1,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "office_team" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"name" text NOT NULL,
	"title" text NOT NULL,
	"specialties" text,
	"bio" text,
	"photo_url" text,
	"linkedin" text,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "ai_api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"key_label" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_masked" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"total_cost" real DEFAULT 0 NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "departments" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_en" text,
	"description" text,
	"parent_id" text,
	"color" text DEFAULT '#C9A84C',
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "discount_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"type" text DEFAULT 'percent' NOT NULL,
	"value" real NOT NULL,
	"plan_id" text,
	"max_uses" integer DEFAULT 100 NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "discount_codes_code_unique" UNIQUE("code")
);
CREATE TABLE IF NOT EXISTS "job_titles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_en" text,
	"department_id" text,
	"level" text DEFAULT 'staff',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "legal_systems" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"title_en" text,
	"category" text DEFAULT 'نظام' NOT NULL,
	"content" text,
	"file_url" text,
	"source" text,
	"effective_date" text,
	"version" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "office_registry" (
	"id" text PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"office_name" text,
	"owner_name" text,
	"owner_email" text NOT NULL,
	"plan_id" text,
	"plan_name" text DEFAULT 'free',
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"last_active_at" timestamp,
	CONSTRAINT "office_registry_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
CREATE TABLE IF NOT EXISTS "plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_en" text,
	"slug" text,
	"description" text,
	"price" real DEFAULT 0 NOT NULL,
	"monthly_price" real,
	"yearly_price" real,
	"billing_cycle" text DEFAULT 'monthly' NOT NULL,
	"color" text DEFAULT '#C9A84C',
	"features" jsonb DEFAULT '[]'::jsonb,
	"feature_flags" jsonb DEFAULT '{}'::jsonb,
	"max_users" integer DEFAULT 5 NOT NULL,
	"max_cases" integer DEFAULT 100 NOT NULL,
	"max_clients" integer DEFAULT 50,
	"max_ai_calls" integer DEFAULT 500 NOT NULL,
	"max_storage_gb" integer DEFAULT 5,
	"max_branches" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"is_highlighted" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"stripe_price_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "platform_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text DEFAULT '' NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"group" text DEFAULT 'general' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "support_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"sender_type" text DEFAULT 'office' NOT NULL,
	"sender_name" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "support_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"category" text DEFAULT 'technical' NOT NULL,
	"user_id" text,
	"user_email" text NOT NULL,
	"user_name" text NOT NULL,
	"office_name" text,
	"assigned_to" text,
	"response" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "backup_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text DEFAULT 'manual' NOT NULL,
	"schedule_type" text,
	"status" text DEFAULT 'completed' NOT NULL,
	"size_bytes" integer DEFAULT 0,
	"file_name" text,
	"file_data" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
CREATE TABLE IF NOT EXISTS "backup_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"schedule" text DEFAULT 'daily' NOT NULL,
	"retention_days" integer DEFAULT 30 NOT NULL,
	"storage_provider" text DEFAULT 'local' NOT NULL,
	"cloud_config" jsonb DEFAULT '{}'::jsonb,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"last_backup_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_name" text NOT NULL,
	"account_name" text NOT NULL,
	"account_number" text NOT NULL,
	"iban" text,
	"currency" text DEFAULT 'SAR',
	"current_balance" numeric(15, 2) DEFAULT '0',
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "cash_advances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid,
	"employee_name" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"purpose" text NOT NULL,
	"repayment_months" integer DEFAULT 1,
	"amount_repaid" numeric(15, 2) DEFAULT '0',
	"status" text DEFAULT 'pending',
	"approved_by" text,
	"approved_at" timestamp,
	"date" date NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"category" text DEFAULT 'مصاريف عامة' NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"payment_method" text DEFAULT 'bank',
	"date" date NOT NULL,
	"vendor" text,
	"is_payroll" boolean DEFAULT false,
	"payroll_id" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "revenues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"category" text DEFAULT 'أتعاب محاماة' NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"payment_method" text DEFAULT 'bank',
	"date" date NOT NULL,
	"client_id" text,
	"case_id" text,
	"invoice_id" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
-- ── Foreign keys (skip if already present) ─────────────────────────────────
DO $fk$
DECLARE s TEXT;
BEGIN

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_employee_id_employees_id_fk'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE "attendance" ADD CONSTRAINT "attendance_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_investigations_employee_id_employees_id_fk'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE "employee_investigations" ADD CONSTRAINT "employee_investigations_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_warnings_employee_id_employees_id_fk'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE "employee_warnings" ADD CONSTRAINT "employee_warnings_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leaves_employee_id_employees_id_fk'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE "leaves" ADD CONSTRAINT "leaves_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payroll_employee_id_employees_id_fk'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE "payroll" ADD CONSTRAINT "payroll_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'office_articles_office_id_office_page_id_fk'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE "office_articles" ADD CONSTRAINT "office_articles_office_id_office_page_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."office_page"("id") ON DELETE cascade ON UPDATE no action;';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'office_domains_office_id_office_page_id_fk'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE "office_domains" ADD CONSTRAINT "office_domains_office_id_office_page_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."office_page"("id") ON DELETE cascade ON UPDATE no action;';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'office_orders_office_id_office_page_id_fk'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE "office_orders" ADD CONSTRAINT "office_orders_office_id_office_page_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."office_page"("id") ON DELETE cascade ON UPDATE no action;';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'office_orders_service_id_office_services_id_fk'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE "office_orders" ADD CONSTRAINT "office_orders_service_id_office_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."office_services"("id") ON DELETE no action ON UPDATE no action;';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'office_reviews_office_id_office_page_id_fk'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE "office_reviews" ADD CONSTRAINT "office_reviews_office_id_office_page_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."office_page"("id") ON DELETE cascade ON UPDATE no action;';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'office_services_office_id_office_page_id_fk'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE "office_services" ADD CONSTRAINT "office_services_office_id_office_page_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."office_page"("id") ON DELETE cascade ON UPDATE no action;';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'office_team_office_id_office_page_id_fk'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE "office_team" ADD CONSTRAINT "office_team_office_id_office_page_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."office_page"("id") ON DELETE cascade ON UPDATE no action;';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $fk$;

COMMIT;
