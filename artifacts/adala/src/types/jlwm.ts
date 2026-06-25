/* ────────────────────────────────────────────────────────────
   JLWM — TypeScript Types
   Justice Legal World Model — shared types for frontend + backend
──────────────────────────────────────────────────────────── */

export type RiskLevel  = "green" | "yellow" | "orange" | "red";
export type ChurnRisk  = "low"   | "medium" | "high"   | "critical";
export type Priority   = "critical" | "high" | "medium" | "low";
export type AlertSeverity = "critical" | "warning" | "info";

/* ── Config ─────────────────────────────────────────────── */
export interface JLWMConfig {
  id:              string;
  office_id:       string;
  enabled:         boolean;
  enabled_modules: string[];
  sync_frequency:  "realtime" | "hourly" | "daily";
  ai_model:        string;
  last_full_sync_at: string | null;
  created_at:      string;
  updated_at:      string;
}

/* ── World State ─────────────────────────────────────────── */
export interface StateVector {
  active_cases:      number;
  critical_cases:    number;
  overdue_tasks:     number;
  upcoming_hearings: number;
  pending_invoices:  number;
  pending_amount:    number;
  revenue_momentum:  number;
  win_rate:          number;
  total_clients:     number;
  total_cases:       number;
}

export interface WorldState {
  id:             string;
  office_id:      string;
  risk_level:     RiskLevel;
  state_vector:   StateVector;
  active_threats: { items: { type: string; detail: string }[] };
  opportunities:  { items: { type: string; detail: string }[] };
  state_summary:  string | null;
  computed_at:    string;
  valid_until:    string;
  triggered_by:   string;
}

/* ── Legal Pattern ───────────────────────────────────────── */
export interface LegalPattern {
  id:              string;
  office_id:       string;
  pattern_type:    "outcome" | "timing" | "financial" | "behavioral" | "risk";
  pattern_name:    string;
  description:     string | null;
  evidence_count:  number;
  confidence_score:number;
  applies_to:      Record<string, unknown>;
  is_active:       boolean;
  first_seen_at:   string;
  last_seen_at:    string;
}

/* ── Memory Graph ────────────────────────────────────────── */
export type NodeType = "case" | "client" | "lawyer" | "court" | "judge" | "opponent" | "contract" | "law";
export type EdgeType = "represents" | "opposed_by" | "filed_at" | "won_against" | "paid" | "linked_to" | "contracted_with";

export interface MemoryNode {
  id:              string;
  office_id:       string;
  node_type:       NodeType;
  node_ref:        string | null;
  label:           string;
  properties:      Record<string, unknown>;
  importance_score:number;
  is_auto:         boolean;
  updated_at:      string;
}

export interface MemoryEdge {
  id:          string;
  office_id:   string;
  from_node_id:string;
  to_node_id:  string;
  edge_type:   EdgeType;
  weight:      number;
  evidence:    Record<string, unknown>;
}

export interface GraphData {
  nodes: MemoryNode[];
  edges: MemoryEdge[];
  stats: { node_type: string; count: number }[];
}

/* ── Digital Twins ───────────────────────────────────────── */
export interface CaseTwin {
  id:                     string;
  office_id:              string;
  case_id:                string;
  case_title?:            string;
  case_status?:           string;
  health_score:           number;
  complexity_score:       number;
  risk_level:             "low" | "medium" | "high";
  predicted_outcome:      string | null;
  outcome_confidence:     number;
  predicted_duration_days:number | null;
  financial_exposure:     number;
  key_entities:           unknown[];
  critical_dates:         unknown[];
  strengths:              string[];
  weaknesses:             string[];
  opportunities:          string[];
  state_data:             Record<string, unknown>;
  last_synced_at:         string;
}

export interface ClientTwin {
  id:                  string;
  office_id:           string;
  client_id:           string;
  client_name?:        string;
  loyalty_score:       number;
  risk_score:          number;
  ltv_score:           number;
  total_cases:         number;
  won_cases:           number;
  lost_cases:          number;
  active_cases:        number;
  total_invoiced:      number;
  total_paid:          number;
  payment_reliability: number;
  churn_risk:          ChurnRisk;
  last_synced_at:      string;
}

export interface FirmTwin {
  id:                      string;
  office_id:               string;
  performance_score:       number;
  efficiency_score:        number;
  health_score:            number;
  monthly_revenue:         number;
  revenue_trend:           number;
  active_cases_count:      number;
  avg_case_duration_days:  number;
  win_rate_pct:            number;
  client_satisfaction:     number;
  top_case_types:          { case_type: string; count: number }[];
  resource_utilization:    Record<string, unknown>;
  financial_health:        Record<string, unknown>;
  growth_indicators:       Record<string, unknown>;
  snapshot_date:           string;
}

/* ── Predictions ─────────────────────────────────────────── */
export interface Prediction {
  id:               string;
  office_id:        string;
  subject_type:     "case" | "client" | "firm" | "financial";
  subject_id:       string | null;
  prediction_type:  "outcome" | "duration" | "churn" | "revenue" | "risk";
  predicted_value:  string;
  confidence_score: number;
  supporting_data:  Record<string, unknown>;
  model_used:       string | null;
  is_verified:      boolean;
  actual_value:     string | null;
  expires_at:       string | null;
  created_at:       string;
}

/* ── Recommendations ─────────────────────────────────────── */
export interface Recommendation {
  id:               string;
  office_id:        string;
  target_type:      "case" | "client" | "firm" | "lawyer";
  target_id:        string | null;
  category:         "action" | "risk" | "opportunity" | "resource" | "deadline";
  priority:         Priority;
  title:            string;
  body:             string;
  action_items:     { step: string; done: boolean }[];
  estimated_impact: string | null;
  is_read:          boolean;
  is_applied:       boolean;
  dismissed:        boolean;
  expires_at:       string | null;
  created_at:       string;
}

/* ── Radar Alerts ────────────────────────────────────────── */
export interface RadarAlert {
  id:              string;
  office_id:       string;
  alert_type:      "deadline" | "risk" | "anomaly" | "opportunity" | "prediction_shift";
  severity:        AlertSeverity;
  subject_type:    string | null;
  subject_id:      string | null;
  title:           string;
  body:            string;
  action_url:      string | null;
  is_acknowledged: boolean;
  created_at:      string;
}

/* ── Command Center ──────────────────────────────────────── */
export interface CommandSession {
  id:          string;
  query:       string;
  response:    string | null;
  model_used:  string | null;
  tokens_est:  number;
  duration_ms: number | null;
  status:      "pending" | "done" | "error";
  created_at:  string;
}

export interface CommandAction {
  id:          string;
  action_type: string;
  status:      "pending" | "running" | "done" | "error";
  result:      Record<string, unknown>;
  error_msg:   string | null;
  started_at:  string;
  finished_at: string | null;
}

/* ── Dashboard Aggregate ─────────────────────────────────── */
export interface JLWMDashboard {
  firmHealthScore:  number;
  legalRiskScore:   number;
  activeCases:      number;
  activeThreats:    number;
  winRate:          number;
  monthlyRevenue:   number;
  revenueTrend:     number;
  recommendations:  Recommendation[];
  radarAlerts:      RadarAlert[];
  worldState:       WorldState | Record<string, never>;
  memoryGraph:      { nodes: number; edges: number };
  predictionsCount: number;
}

/* ── Module Status ───────────────────────────────────────── */
export interface JLWMStatus {
  modules: {
    memory_graph:   { status: string; nodes: number };
    world_state:    { status: string; lastComputed: string | null; riskLevel: RiskLevel | null };
    recommendations:{ status: string; count: number };
    radar:          { status: string; activeAlerts: number };
    digital_twins:  { status: string; firmHealth: number };
    predictions:    { status: string; count: number };
  };
  officeId:  string;
  timestamp: string;
}
