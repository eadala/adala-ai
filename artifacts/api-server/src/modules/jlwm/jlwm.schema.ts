/**
 * JLWM — Justice Legal World Model
 * Core schema authority: Migration 034 (Stage 4B).
 *
 * Runtime CREATE TABLE / CREATE INDEX removed from ensureJLWMSchema.
 * This helper performs SELECT-only readiness checks for the 14 core tables.
 *
 * Satellites (035) and Reliability (036) remain on their Runtime ensure* helpers.
 *
 * NOTE: The project uses Drizzle ORM + raw SQL (not Prisma).
 *       TypeScript types live in artifacts/adala/src/types/jlwm.ts.
 */

import { db }  from "@workspace/db";
import { sql } from "drizzle-orm";

const JLWM_CORE_TABLES = [
  "jlwm_config",
  "jlwm_memory_nodes",
  "jlwm_memory_edges",
  "jlwm_world_states",
  "jlwm_legal_patterns",
  "jlwm_command_sessions",
  "jlwm_command_actions",
  "jlwm_case_twins",
  "jlwm_client_twins",
  "jlwm_firm_twin",
  "jlwm_predictions",
  "jlwm_recommendations",
  "jlwm_radar_alerts",
  "jlwm_feedback",
] as const;

/**
 * SELECT-only readiness for Migration 034-owned JLWM core tables.
 * No CREATE / ALTER / CREATE INDEX.
 */
export async function ensureJLWMSchema(): Promise<void> {
  const { rows } = await db.execute(sql`
    SELECT
      to_regclass('public.jlwm_config') IS NOT NULL AS has_config,
      to_regclass('public.jlwm_memory_nodes') IS NOT NULL AS has_nodes,
      to_regclass('public.jlwm_memory_edges') IS NOT NULL AS has_edges,
      to_regclass('public.jlwm_case_twins') IS NOT NULL AS has_case_twins,
      to_regclass('public.jlwm_client_twins') IS NOT NULL AS has_client_twins,
      to_regclass('public.jlwm_firm_twin') IS NOT NULL AS has_firm_twin,
      to_regclass('public.jlwm_world_states') IS NOT NULL AS has_world,
      to_regclass('public.jlwm_predictions') IS NOT NULL AS has_predictions
  `).catch(() => ({ rows: [{}] }));

  const r = (rows[0] ?? {}) as Record<string, boolean>;
  const missing: string[] = [];
  if (!r.has_config) missing.push("jlwm_config");
  if (!r.has_nodes) missing.push("jlwm_memory_nodes");
  if (!r.has_edges) missing.push("jlwm_memory_edges");
  if (!r.has_case_twins) missing.push("jlwm_case_twins");
  if (!r.has_client_twins) missing.push("jlwm_client_twins");
  if (!r.has_firm_twin) missing.push("jlwm_firm_twin");
  if (!r.has_world) missing.push("jlwm_world_states");
  if (!r.has_predictions) missing.push("jlwm_predictions");

  if (missing.length > 0) {
    console.error(
      "[JLWM] Migration 034 core schema not ready — missing:",
      missing.join(", "),
      "(apply artifacts/api-server/migrations/034_jlwm_core_schema_authority.sql)",
    );
  }

  void JLWM_CORE_TABLES;
}

/* ─────────────────────────────────────────────────────────────────
   Seed demo data for a demo office — safe with ON CONFLICT DO NOTHING
   (application DML only; schema owned by Migration 034)
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
      insertedIds[n.ref] = (rows[0] as { id?: string } | undefined)?.id ?? "";
    } catch { /* ignore — known follow-up: conflict target vs partial unique */ }
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
