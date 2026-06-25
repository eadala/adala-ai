/**
 * JLWM — Justice Legal World Model
 * Schema: 7 tables, all prefixed jlwm_* for zero conflict with existing system.
 * Migration strategy: idempotent CREATE TABLE IF NOT EXISTS — safe to run on every boot.
 *
 * NOTE: The project uses Drizzle ORM + raw SQL (not Prisma).
 *       TypeScript types live in artifacts/adala/src/types/jlwm.ts.
 */

import { db }  from "@workspace/db";
import { sql } from "drizzle-orm";

export async function ensureJLWMSchema(): Promise<void> {

  /* ── 1. jlwm_config ─────────────────────────────────────────── */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS jlwm_config (
      id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      office_id           TEXT NOT NULL UNIQUE,
      enabled             BOOLEAN NOT NULL DEFAULT TRUE,
      enabled_modules     TEXT[]  NOT NULL DEFAULT ARRAY['memory_graph','world_state','command_center'],
      sync_frequency      TEXT    NOT NULL DEFAULT 'hourly',   -- realtime | hourly | daily
      ai_model            TEXT    NOT NULL DEFAULT 'gemini',
      last_full_sync_at   TIMESTAMPTZ,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});

  /* ── 2. jlwm_memory_nodes ───────────────────────────────────── */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS jlwm_memory_nodes (
      id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      office_id        TEXT NOT NULL,
      node_type        TEXT NOT NULL,  -- case|client|lawyer|court|judge|opponent|contract|law
      node_ref         TEXT,           -- FK to source table (cases.id, clients.id …)
      label            TEXT NOT NULL,
      properties       JSONB NOT NULL DEFAULT '{}',
      importance_score FLOAT NOT NULL DEFAULT 0.5,
      is_auto          BOOLEAN NOT NULL DEFAULT TRUE,   -- true = synced from DB, false = manual
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jmn_office       ON jlwm_memory_nodes(office_id)`).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jmn_type         ON jlwm_memory_nodes(office_id, node_type)`).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jmn_ref          ON jlwm_memory_nodes(office_id, node_ref)`).catch(() => {});
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_jmn_uniq  ON jlwm_memory_nodes(office_id, node_type, node_ref) WHERE node_ref IS NOT NULL`).catch(() => {});

  /* ── 3. jlwm_memory_edges ───────────────────────────────────── */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS jlwm_memory_edges (
      id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      office_id    TEXT NOT NULL,
      from_node_id TEXT NOT NULL REFERENCES jlwm_memory_nodes(id) ON DELETE CASCADE,
      to_node_id   TEXT NOT NULL REFERENCES jlwm_memory_nodes(id) ON DELETE CASCADE,
      edge_type    TEXT NOT NULL,  -- represents|opposed_by|filed_at|won_against|paid|linked_to|contracted_with
      weight       FLOAT NOT NULL DEFAULT 0.5,
      evidence     JSONB NOT NULL DEFAULT '{}',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jme_office    ON jlwm_memory_edges(office_id)`).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jme_from      ON jlwm_memory_edges(from_node_id)`).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jme_to        ON jlwm_memory_edges(to_node_id)`).catch(() => {});

  /* ── 4. jlwm_world_states ───────────────────────────────────── */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS jlwm_world_states (
      id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      office_id       TEXT NOT NULL,
      risk_level      TEXT NOT NULL DEFAULT 'green', -- green|yellow|orange|red
      state_vector    JSONB NOT NULL DEFAULT '{}',
      active_threats  JSONB NOT NULL DEFAULT '[]',
      opportunities   JSONB NOT NULL DEFAULT '[]',
      state_summary   TEXT,
      computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      valid_until     TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour',
      triggered_by    TEXT NOT NULL DEFAULT 'auto'   -- auto|manual|event
    )
  `).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jws_office_time ON jlwm_world_states(office_id, computed_at DESC)`).catch(() => {});

  /* ── 5. jlwm_legal_patterns ─────────────────────────────────── */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS jlwm_legal_patterns (
      id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      office_id        TEXT NOT NULL,
      pattern_type     TEXT NOT NULL,  -- outcome|timing|financial|behavioral|risk
      pattern_name     TEXT NOT NULL,
      description      TEXT,
      evidence_count   INT  NOT NULL DEFAULT 1,
      confidence_score FLOAT NOT NULL DEFAULT 0.5,
      applies_to       JSONB NOT NULL DEFAULT '{}',
      is_active        BOOLEAN NOT NULL DEFAULT TRUE,
      first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jlp_office ON jlwm_legal_patterns(office_id)`).catch(() => {});

  /* ── 6. jlwm_command_sessions ───────────────────────────────── */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS jlwm_command_sessions (
      id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      office_id    TEXT NOT NULL,
      user_id      TEXT NOT NULL,
      query        TEXT NOT NULL,
      response     TEXT,
      context_used JSONB NOT NULL DEFAULT '{}',
      model_used   TEXT,
      tokens_est   INT  NOT NULL DEFAULT 0,
      duration_ms  INT,
      status       TEXT NOT NULL DEFAULT 'pending',  -- pending|done|error
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jcs_office_time ON jlwm_command_sessions(office_id, created_at DESC)`).catch(() => {});

  /* ── 7. jlwm_command_actions ────────────────────────────────── */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS jlwm_command_actions (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      office_id   TEXT NOT NULL,
      user_id     TEXT,
      action_type TEXT NOT NULL,  -- rebuild_graph|compute_state|discover_patterns|reset|sync
      status      TEXT NOT NULL DEFAULT 'pending',
      result      JSONB NOT NULL DEFAULT '{}',
      error_msg   TEXT,
      started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ
    )
  `).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jca_office_time ON jlwm_command_actions(office_id, started_at DESC)`).catch(() => {});

  /* ── 8. jlwm_case_twins ─────────────────────────────────────── */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS jlwm_case_twins (
      id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      office_id             TEXT NOT NULL,
      case_id               TEXT NOT NULL,
      health_score          FLOAT NOT NULL DEFAULT 50,
      complexity_score      FLOAT NOT NULL DEFAULT 50,
      risk_level            TEXT  NOT NULL DEFAULT 'medium',
      predicted_outcome     TEXT,
      outcome_confidence    FLOAT NOT NULL DEFAULT 0,
      predicted_duration_days INT,
      financial_exposure    FLOAT NOT NULL DEFAULT 0,
      key_entities          JSONB NOT NULL DEFAULT '[]',
      critical_dates        JSONB NOT NULL DEFAULT '[]',
      strengths             TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
      weaknesses            TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
      opportunities         TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
      state_data            JSONB NOT NULL DEFAULT '{}',
      last_synced_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(office_id, case_id)
    )
  `).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jct_office     ON jlwm_case_twins(office_id)`).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jct_case       ON jlwm_case_twins(case_id)`).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jct_risk       ON jlwm_case_twins(office_id, risk_level)`).catch(() => {});

  /* ── 9. jlwm_client_twins ───────────────────────────────────── */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS jlwm_client_twins (
      id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      office_id            TEXT NOT NULL,
      client_id            TEXT NOT NULL,
      loyalty_score        FLOAT NOT NULL DEFAULT 50,
      risk_score           FLOAT NOT NULL DEFAULT 50,
      ltv_score            FLOAT NOT NULL DEFAULT 0,
      total_cases          INT   NOT NULL DEFAULT 0,
      won_cases            INT   NOT NULL DEFAULT 0,
      lost_cases           INT   NOT NULL DEFAULT 0,
      active_cases         INT   NOT NULL DEFAULT 0,
      total_invoiced       FLOAT NOT NULL DEFAULT 0,
      total_paid           FLOAT NOT NULL DEFAULT 0,
      payment_reliability  FLOAT NOT NULL DEFAULT 1,
      churn_risk           TEXT  NOT NULL DEFAULT 'low',
      predicted_next_case  TIMESTAMPTZ,
      behavioral_patterns  JSONB NOT NULL DEFAULT '{}',
      last_synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(office_id, client_id)
    )
  `).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jclt_office    ON jlwm_client_twins(office_id)`).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jclt_client    ON jlwm_client_twins(client_id)`).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jclt_churn     ON jlwm_client_twins(office_id, churn_risk)`).catch(() => {});

  /* ── 10. jlwm_firm_twin ─────────────────────────────────────── */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS jlwm_firm_twin (
      id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      office_id               TEXT NOT NULL,
      performance_score       FLOAT NOT NULL DEFAULT 50,
      efficiency_score        FLOAT NOT NULL DEFAULT 50,
      health_score            FLOAT NOT NULL DEFAULT 50,
      monthly_revenue         FLOAT NOT NULL DEFAULT 0,
      revenue_trend           FLOAT NOT NULL DEFAULT 0,
      active_cases_count      INT   NOT NULL DEFAULT 0,
      avg_case_duration_days  FLOAT NOT NULL DEFAULT 0,
      win_rate_pct            FLOAT NOT NULL DEFAULT 0,
      client_satisfaction     FLOAT NOT NULL DEFAULT 50,
      top_case_types          JSONB NOT NULL DEFAULT '[]',
      resource_utilization    JSONB NOT NULL DEFAULT '{}',
      financial_health        JSONB NOT NULL DEFAULT '{}',
      growth_indicators       JSONB NOT NULL DEFAULT '{}',
      snapshot_date           DATE  NOT NULL DEFAULT CURRENT_DATE,
      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(office_id, snapshot_date)
    )
  `).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jft_office ON jlwm_firm_twin(office_id)`).catch(() => {});

  /* ── 11. jlwm_predictions ───────────────────────────────────── */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS jlwm_predictions (
      id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      office_id        TEXT NOT NULL,
      subject_type     TEXT NOT NULL,  -- case|client|firm|financial
      subject_id       TEXT,
      prediction_type  TEXT NOT NULL,  -- outcome|duration|churn|revenue|risk
      predicted_value  TEXT NOT NULL,
      confidence_score FLOAT NOT NULL DEFAULT 0,
      supporting_data  JSONB NOT NULL DEFAULT '{}',
      model_used       TEXT,
      is_verified      BOOLEAN NOT NULL DEFAULT FALSE,
      actual_value     TEXT,
      expires_at       TIMESTAMPTZ,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jpred_office     ON jlwm_predictions(office_id)`).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jpred_type       ON jlwm_predictions(office_id, prediction_type)`).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jpred_subject    ON jlwm_predictions(subject_type, subject_id)`).catch(() => {});

  /* ── 12. jlwm_recommendations ──────────────────────────────── */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS jlwm_recommendations (
      id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      office_id        TEXT NOT NULL,
      target_type      TEXT NOT NULL DEFAULT 'firm',  -- case|client|firm|lawyer
      target_id        TEXT,
      category         TEXT NOT NULL,  -- action|risk|opportunity|resource|deadline
      priority         TEXT NOT NULL DEFAULT 'medium', -- critical|high|medium|low
      title            TEXT NOT NULL,
      body             TEXT NOT NULL,
      action_items     JSONB NOT NULL DEFAULT '[]',
      estimated_impact TEXT,
      is_read          BOOLEAN NOT NULL DEFAULT FALSE,
      is_applied       BOOLEAN NOT NULL DEFAULT FALSE,
      dismissed        BOOLEAN NOT NULL DEFAULT FALSE,
      expires_at       TIMESTAMPTZ,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jrec_office_pri ON jlwm_recommendations(office_id, priority)`).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jrec_unread     ON jlwm_recommendations(office_id, is_read) WHERE is_read = FALSE`).catch(() => {});

  /* ── 13. jlwm_radar_alerts ─────────────────────────────────── */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS jlwm_radar_alerts (
      id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      office_id          TEXT NOT NULL,
      alert_type         TEXT NOT NULL,  -- deadline|risk|anomaly|opportunity|prediction_shift
      severity           TEXT NOT NULL DEFAULT 'warning',  -- critical|warning|info
      subject_type       TEXT,
      subject_id         TEXT,
      title              TEXT NOT NULL,
      body               TEXT NOT NULL,
      action_url         TEXT,
      is_acknowledged    BOOLEAN NOT NULL DEFAULT FALSE,
      acknowledged_by    TEXT,
      acknowledged_at    TIMESTAMPTZ,
      auto_resolved      BOOLEAN NOT NULL DEFAULT FALSE,
      resolved_at        TIMESTAMPTZ,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jra_office_sev  ON jlwm_radar_alerts(office_id, severity)`).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jra_unack       ON jlwm_radar_alerts(office_id, is_acknowledged) WHERE is_acknowledged = FALSE`).catch(() => {});

  /* ── 14. jlwm_feedback ─────────────────────────────────────── */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS jlwm_feedback (
      id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      office_id        TEXT NOT NULL,
      user_id          TEXT NOT NULL,
      source_type      TEXT NOT NULL,  -- prediction|recommendation|radar
      source_id        TEXT NOT NULL,
      rating           INT,            -- 1-5
      was_accurate     BOOLEAN,
      was_useful       BOOLEAN,
      user_action      TEXT,           -- applied|dismissed|ignored
      notes            TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jfb_office ON jlwm_feedback(office_id)`).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jfb_source ON jlwm_feedback(source_type, source_id)`).catch(() => {});
}

/* ─────────────────────────────────────────────────────────────────
   Seed demo data for a demo office — safe with ON CONFLICT DO NOTHING
───────────────────────────────────────────────────────────────── */
export async function seedJLWMDemoData(officeId: string): Promise<void> {
  /* Upsert config */
  await db.execute(sql`
    INSERT INTO jlwm_config (office_id, enabled, enabled_modules, ai_model)
    VALUES (${officeId}, TRUE,
            ARRAY['memory_graph','world_state','command_center'],
            'gemini')
    ON CONFLICT (office_id) DO NOTHING
  `).catch(() => {});

  /* Demo nodes */
  const nodes = [
    { type: "client",   ref: "demo-c1", label: "شركة النخيل للتجارة",   importance: 0.9, props: { sector:"تجارة", city:"الرياض" } },
    { type: "client",   ref: "demo-c2", label: "محمد العتيبي",           importance: 0.7, props: { sector:"أفراد", city:"جدة" } },
    { type: "case",     ref: "demo-k1", label: "قضية تجارية #2024-001",  importance: 0.85, props: { status:"جارية", court:"المحكمة التجارية" } },
    { type: "case",     ref: "demo-k2", label: "قضية عمالية #2024-002",  importance: 0.6,  props: { status:"منتهية", court:"المحكمة العمالية" } },
    { type: "case",     ref: "demo-k3", label: "قضية مدنية #2024-003",   importance: 0.75, props: { status:"جارية", court:"المحكمة المدنية" } },
    { type: "lawyer",   ref: "demo-l1", label: "المحامي خالد السعد",     importance: 0.8,  props: { speciality:"تجاري", years_exp:12 } },
    { type: "court",    ref: "demo-ct1", label: "المحكمة التجارية بالرياض", importance: 0.7, props: { city:"الرياض" } },
    { type: "opponent", ref: "demo-o1", label: "المقاول العام للإنشاءات", importance: 0.5, props: { type:"شركة" } },
    { type: "contract", ref: "demo-cn1", label: "عقد توريد #CT-2024",    importance: 0.65, props: { value:"250000", currency:"SAR" } },
  ];

  const insertedIds: Record<string, string> = {};
  for (const n of nodes) {
    try {
      const { rows } = await db.execute(sql`
        INSERT INTO jlwm_memory_nodes (office_id, node_type, node_ref, label, properties, importance_score, is_auto)
        VALUES (${officeId}, ${n.type}, ${n.ref}, ${n.label}, ${JSON.stringify(n.props)}::jsonb, ${n.importance}, FALSE)
        ON CONFLICT (office_id, node_type, node_ref) DO UPDATE SET label = EXCLUDED.label
        RETURNING id
      `);
      insertedIds[n.ref] = (rows[0] as any)?.id;
    } catch { /* ignore */ }
  }

  /* Demo edges */
  const edges = [
    { from: "demo-c1", to: "demo-k1", type: "represents",      weight: 1.0 },
    { from: "demo-c2", to: "demo-k2", type: "represents",      weight: 1.0 },
    { from: "demo-c1", to: "demo-k3", type: "represents",      weight: 0.9 },
    { from: "demo-l1", to: "demo-k1", type: "filed_at",        weight: 0.8 },
    { from: "demo-l1", to: "demo-k2", type: "filed_at",        weight: 0.8 },
    { from: "demo-k1", to: "demo-ct1", type: "filed_at",       weight: 0.7 },
    { from: "demo-o1", to: "demo-k1", type: "opposed_by",      weight: 0.9 },
    { from: "demo-c1", to: "demo-cn1", type: "contracted_with",weight: 0.7 },
  ];

  for (const e of edges) {
    const fromId = insertedIds[e.from];
    const toId   = insertedIds[e.to];
    if (!fromId || !toId) continue;
    await db.execute(sql`
      INSERT INTO jlwm_memory_edges (office_id, from_node_id, to_node_id, edge_type, weight)
      VALUES (${officeId}, ${fromId}, ${toId}, ${e.type}, ${e.weight})
      ON CONFLICT DO NOTHING
    `).catch(() => {});
  }

  /* Demo world state */
  await db.execute(sql`
    INSERT INTO jlwm_world_states
      (office_id, risk_level, state_vector, active_threats, opportunities, state_summary, triggered_by)
    VALUES (
      ${officeId}, 'yellow',
      ${{ cases_open:3, cases_critical:1, overdue_tasks:2, unpaid_invoices:1, revenue_momentum:"stable" }}::jsonb,
      ${{ items: [{ type:"deadline_approaching", detail:"جلسة في 3 أيام لقضية #2024-001" }] }}::jsonb,
      ${{ items: [{ type:"new_case_potential", detail:"عميل جديد يسأل عن خدمات عقارية" }] }}::jsonb,
      'المكتب في حالة مستقرة مع قضيتين نشطتين. هناك جلسة قادمة تستوجب الاستعداد الفوري.',
      'seed'
    )
    ON CONFLICT DO NOTHING
  `).catch(() => {});

  /* Demo patterns */
  const patterns = [
    {
      type: "outcome",     name: "ترجيح الفوز في القضايا التجارية",
      desc: "78% من قضايا العميل شركة النخيل تُحسم لصالح المكتب",
      confidence: 0.78, applies: { case_types: ["تجاري"], clients: ["demo-c1"] }
    },
    {
      type: "timing",      name: "متوسط مدة القضايا العمالية 4 أشهر",
      desc: "القضايا العمالية تستغرق 110-130 يوم في المتوسط",
      confidence: 0.82, applies: { case_types: ["عمالي"] }
    },
    {
      type: "financial",   name: "إيرادات Q4 أعلى بـ30% من Q3",
      desc: "نمط موسمي: الربع الرابع أكثر إيراداً باستمرار",
      confidence: 0.71, applies: { period: "Q4" }
    },
  ];

  for (const p of patterns) {
    await db.execute(sql`
      INSERT INTO jlwm_legal_patterns
        (office_id, pattern_type, pattern_name, description, confidence_score, applies_to, evidence_count)
      VALUES
        (${officeId}, ${p.type}, ${p.name}, ${p.desc}, ${p.confidence}, ${JSON.stringify(p.applies)}::jsonb, 5)
      ON CONFLICT DO NOTHING
    `).catch(() => {});
  }
}
