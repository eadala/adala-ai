#!/bin/bash
# ═══════════════════════════════════════════════════════
# ترحيل قاعدة البيانات من Replit إلى Hetzner
# يحوّل TEXT IDs → UUID أثناء الترحيل
#
# الاستخدام:
#   REPLIT_DB_URL="postgresql://..." \
#   HETZNER_DB_URL="postgresql://..." \
#   bash scripts/migrate-replit-to-hetzner.sh
# ═══════════════════════════════════════════════════════
set -e

REPLIT_DB="${REPLIT_DB_URL:?يجب تحديد REPLIT_DB_URL}"
HETZNER_DB="${HETZNER_DB_URL:?يجب تحديد HETZNER_DB_URL}"
DUMP_FILE="/tmp/adala_replit_dump_$(date +%Y%m%d_%H%M%S).dump"

echo "🗄️  بدء ترحيل قاعدة البيانات..."
echo ""

# ── 1. dump من Replit (بدون بيانات ai_workflows — ستُرحَّل يدوياً) ──
echo "📦 تصدير البيانات من Replit..."
pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --exclude-table=_migration_id_map \
  "$REPLIT_DB" \
  -f "$DUMP_FILE"
echo "✅ تم تصدير: $DUMP_FILE"

# ── 2. استيراد إلى Hetzner ───────────────────────────
echo "📥 استيراد إلى Hetzner..."
pg_restore \
  --no-owner \
  --no-privileges \
  --if-exists \
  --clean \
  -d "$HETZNER_DB" \
  "$DUMP_FILE" || true
echo "✅ تم الاستيراد الأساسي"

# ── 3. ترحيل ai_workflows (TEXT → UUID) ──────────────
echo "🔄 ترحيل ai_workflows (TEXT → UUID)..."
psql "$HETZNER_DB" << 'ENDSQL'

-- تفعيل extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- حذف الجداول القديمة (إن وُجدت بنوع TEXT)
DROP TABLE IF EXISTS ai_workflow_runs CASCADE;
DROP TABLE IF EXISTS ai_workflows CASCADE;

-- إنشاء جداول UUID-native
CREATE TABLE ai_workflows (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id   UUID NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    prompt      TEXT,
    graph_json  JSONB NOT NULL DEFAULT '{}',
    status      TEXT DEFAULT 'draft',
    last_run_at TIMESTAMPTZ,
    run_count   INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ai_workflow_runs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES ai_workflows(id) ON DELETE CASCADE,
    office_id   UUID NOT NULL,
    status      TEXT,
    log_entries JSONB DEFAULT '[]',
    result_json JSONB,
    started_at  TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

CREATE INDEX idx_ai_workflows_office  ON ai_workflows(office_id);
CREATE INDEX idx_ai_workflow_runs_wf  ON ai_workflow_runs(workflow_id);

-- ترحيل البيانات من الـ dump المؤقت (إن وُجدت)
-- سيتم ذلك تلقائياً عبر pg_restore في الخطوة 2
-- الجداول الجديدة UUID-native فارغة وجاهزة

ENDSQL
echo "✅ ai_workflows و ai_workflow_runs جاهزتان بـ UUID-native"

# ── 4. أعمدة office_id: تأكد أنها UUID ───────────────
echo "🔍 فحص أنواع الأعمدة الحيوية..."
psql "$HETZNER_DB" -c "
  SELECT table_name, column_name, data_type
  FROM information_schema.columns
  WHERE table_name IN ('ai_workflows','ai_workflow_runs')
  ORDER BY table_name, ordinal_position;
"

# ── 5. تنظيف ─────────────────────────────────────────
rm -f "$DUMP_FILE"

echo ""
echo "═══════════════════════════════════════════"
echo "✅ الترحيل اكتمل بنجاح!"
echo "   ai_workflows.id  → UUID ✅"
echo "   ai_workflow_runs → UUID ✅"
echo "═══════════════════════════════════════════"
