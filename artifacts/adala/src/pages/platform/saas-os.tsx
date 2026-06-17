import { useState, useCallback } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Brain, TrendingUp, Zap, Target, AlertTriangle,
  CheckCircle2, XCircle, RefreshCw, Play, ChevronUp,
  ChevronDown, DollarSign, Users, Building2, Activity,
  Server, Clock, ArrowUpRight, Cpu,
} from "lucide-react";

/* ── types ─────────────────────────────────────────────────────── */
interface Snapshot {
  platform: { activeOffices:number; totalUsers:number; totalCases:number; newOffices30d:number; atRiskOffices:number; churnRisk:number };
  finance:  { totalRevenue:number; paidInvoices:number; overdueInvoices:number; avgRevenuePerOffice:number; mrr:number };
  ai:       { tasks24h:number; pending:number };
  system:   { memPct:number; heapUsedMB:number; heapTotalMB:number; dbLatencyMs:number; uptimeMin:number };
  capturedAt: string;
}
interface OptAction {
  priority: "critical"|"high"|"medium"|"low";
  category: string;
  action: string;
  reason: string;
  metric?: string;
}
interface OsResult {
  snapshot: Snapshot;
  actions: OptAction[];
  forecast: string;
  decision: string;
}

/* ── helpers ────────────────────────────────────────────────────── */
const API = "/api";
const fmt = (n:number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}م` : n >= 1_000 ? `${(n/1_000).toFixed(1)}ك` : String(n);

function priorityColor(p:string) {
  return p === "critical" ? "#ef4444" : p === "high" ? "#f97316" : p === "medium" ? "#eab308" : "#22c55e";
}
function priorityAr(p:string) {
  return p === "critical" ? "حرج" : p === "high" ? "عالي" : p === "medium" ? "متوسط" : "منخفض";
}
function categoryIcon(c:string) {
  if (c === "retention") return "🔄";
  if (c === "revenue")   return "💰";
  if (c === "growth")    return "📈";
  if (c === "ai")        return "🤖";
  return "⚙️";
}

/* ── render bold markdown (**text**) ──────────────────────────── */
function renderText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <strong key={i} style={{ color: "#93c5fd" }}>{p.slice(2,-2)}</strong>
      : <span key={i}>{p}</span>
  );
}

/* ── StatusDot ─────────────────────────────────────────────────── */
function Dot({ ok }: { ok: boolean }) {
  return (
    <span style={{
      display:"inline-block", width:8, height:8, borderRadius:"50%",
      background: ok ? "#22c55e" : "#ef4444",
      boxShadow: ok ? "0 0 6px #22c55e" : "0 0 6px #ef4444",
    }} />
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export default function SaasOS() {
  const [loading, setLoading]   = useState(false);
  const [phase, setPhase]       = useState<string>("");
  const [result, setResult]     = useState<OsResult|null>(null);
  const [error, setError]       = useState<string|null>(null);
  const [expanded, setExpanded] = useState<Record<string,boolean>>({ forecast:true, decision:true });

  const toggle = (k:string) => setExpanded(p => ({ ...p, [k]: !p[k] }));

  const runOS = useCallback(async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      setPhase("📊 جمع مقاييس المنصة...");
      await new Promise(r => setTimeout(r, 400));
      setPhase("⚙️ محرك التحسين التلقائي...");
      await new Promise(r => setTimeout(r, 400));
      setPhase("🔮 AI Forecasting — يحسب المستقبل...");
      const res = await fetch(`${API}/saas-os/run`, { method:"POST",
        headers:{ "Content-Type":"application/json" } });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "خطأ غير معروف");
      setPhase("🧠 CEO Decision Layer — يُصدر القرار...");
      await new Promise(r => setTimeout(r, 300));
      setResult(json.data);
    } catch(e:any) {
      setError(e.message);
    } finally {
      setLoading(false); setPhase("");
    }
  }, []);

  const snap = result?.snapshot;
  const sys  = snap?.system;

  /* ── palette ─────────────────────────────────────────────────── */
  const BG    = "#070D1A";
  const CARD  = "#0D1629";
  const CARD2 = "#111D35";
  const BLUE  = "#2563EB";
  const GLOW  = "0 0 24px rgba(37,99,235,0.15)";

  return (
    <AdminLayout>
      <div style={{ minHeight:"100vh", background:BG, padding:"32px 24px", direction:"rtl" }}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:32 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:6 }}>
              <div style={{ background:"linear-gradient(135deg,#1e40af,#7c3aed)", borderRadius:12,
                            padding:10, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Brain size={28} color="#fff" />
              </div>
              <div>
                <h1 style={{ margin:0, fontSize:28, fontWeight:800, color:"#f1f5f9",
                             background:"linear-gradient(90deg,#60a5fa,#a78bfa)", WebkitBackgroundClip:"text",
                             WebkitTextFillColor:"transparent" }}>
                  SaaS Operating System
                </h1>
                <div style={{ color:"#64748b", fontSize:13, marginTop:2 }}>نظام التشغيل الذكي لـ عدالة AI</div>
              </div>
            </div>
          </div>
          <div style={{ display:"flex", gap:12, alignItems:"center" }}>
            {result && (
              <span style={{ color:"#475569", fontSize:12 }}>
                آخر تحليل: {new Date(result.snapshot.capturedAt).toLocaleTimeString("ar-SA")}
              </span>
            )}
            <Button onClick={runOS} disabled={loading}
              style={{ background:"linear-gradient(135deg,#2563eb,#7c3aed)", border:"none",
                       color:"#fff", padding:"10px 24px", borderRadius:10, fontWeight:700,
                       fontSize:15, cursor:loading?"wait":"pointer", boxShadow:"0 4px 20px rgba(37,99,235,0.4)",
                       display:"flex", alignItems:"center", gap:8 }}>
              {loading
                ? <><RefreshCw size={16} style={{ animation:"spin 1s linear infinite" }} /> جارٍ التحليل...</>
                : <><Play size={16} fill="#fff" /> تشغيل نظام التشغيل</>}
            </Button>
          </div>
        </div>

        {/* ── Architecture Banner ─────────────────────────────────── */}
        {!result && !loading && (
          <div style={{ background:CARD, border:"1px solid #1e293b", borderRadius:16,
                        padding:32, marginBottom:32, boxShadow:GLOW }}>
            <div style={{ textAlign:"center", marginBottom:24 }}>
              <div style={{ color:"#64748b", fontSize:13, marginBottom:8 }}>معمارية نظام التشغيل</div>
            </div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:0, flexWrap:"wrap" }}>
              {[
                { icon:"📡", label:"Live Events" },
                { icon:"📊", label:"Metrics Engine" },
                { icon:"🔮", label:"AI Forecasting" },
                { icon:"🧠", label:"CEO Decision" },
                { icon:"⚙️", label:"Auto Optimizer" },
                { icon:"🚀", label:"Control Plane" },
              ].map((s, i) => (
                <div key={i} style={{ display:"flex", alignItems:"center" }}>
                  <div style={{ background:CARD2, border:"1px solid #1e293b", borderRadius:12,
                                padding:"12px 16px", textAlign:"center", minWidth:110 }}>
                    <div style={{ fontSize:22, marginBottom:4 }}>{s.icon}</div>
                    <div style={{ color:"#94a3b8", fontSize:11 }}>{s.label}</div>
                  </div>
                  {i < 5 && <div style={{ color:"#334155", padding:"0 4px", fontSize:18 }}>→</div>}
                </div>
              ))}
            </div>
            <div style={{ textAlign:"center", marginTop:28 }}>
              <Button onClick={runOS}
                style={{ background:"linear-gradient(135deg,#1e40af,#7c3aed)", border:"none", color:"#fff",
                         padding:"14px 40px", borderRadius:12, fontWeight:700, fontSize:16, cursor:"pointer",
                         boxShadow:"0 6px 30px rgba(37,99,235,0.5)" }}>
                🚀 تشغيل نظام التشغيل
              </Button>
            </div>
          </div>
        )}

        {/* ── Loading Phase ───────────────────────────────────────── */}
        {loading && (
          <div style={{ background:CARD, border:"1px solid #1e3a8a", borderRadius:16,
                        padding:40, textAlign:"center", marginBottom:32,
                        boxShadow:"0 0 40px rgba(37,99,235,0.2)" }}>
            <div style={{ fontSize:32, marginBottom:16 }}>🧠</div>
            <div style={{ color:"#93c5fd", fontSize:18, fontWeight:600, marginBottom:8 }}>
              {phase || "جارٍ التحليل..."}
            </div>
            <div style={{ color:"#475569", fontSize:13 }}>نظام التشغيل يجمع البيانات ويستشير الذكاء الاصطناعي</div>
            <div style={{ display:"flex", justifyContent:"center", gap:8, marginTop:20 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width:8, height:8, borderRadius:"50%", background:BLUE,
                  animation:`pulse 1.4s ease-in-out ${i*0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}

        {/* ── Error ──────────────────────────────────────────────── */}
        {error && (
          <div style={{ background:"#1c0a0a", border:"1px solid #7f1d1d", borderRadius:12,
                        padding:16, marginBottom:24, color:"#fca5a5", display:"flex",
                        alignItems:"center", gap:10 }}>
            <XCircle size={18} /> {error}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            RESULTS
        ════════════════════════════════════════════════════════ */}
        {result && snap && (
          <>
            {/* ── KPI Grid ──────────────────────────────────────── */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:24 }}>
              {[
                { icon:<Building2 size={20}/>, label:"مكاتب نشطة",    value:fmt(snap.platform.activeOffices), sub:`${snap.platform.newOffices30d} جديد/شهر`, color:"#3b82f6" },
                { icon:<DollarSign size={20}/>, label:"MRR المقدَّر",  value:`${fmt(snap.finance.mrr)} ر.س`,  sub:`إيراد/مكتب: ${fmt(snap.finance.avgRevenuePerOffice)}`, color:"#22c55e" },
                { icon:<Users size={20}/>,    label:"إجمالي المستخدمين", value:fmt(snap.platform.totalUsers), sub:`${snap.platform.totalCases} قضية`, color:"#a78bfa" },
                { icon:<AlertTriangle size={20}/>, label:"خطر الـ Churn", value:`${snap.platform.churnRisk}%`,
                  sub:`${snap.platform.atRiskOffices} مكتب معرَّض`,
                  color: snap.platform.churnRisk > 20 ? "#ef4444" : snap.platform.churnRisk > 10 ? "#f97316" : "#22c55e" },
              ].map((k,i) => (
                <div key={i} style={{ background:CARD, border:"1px solid #1e293b", borderRadius:14,
                                      padding:20, boxShadow:GLOW }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, color:"#64748b" }}>
                    <span style={{ color:k.color }}>{k.icon}</span>
                    <span style={{ fontSize:13 }}>{k.label}</span>
                  </div>
                  <div style={{ fontSize:28, fontWeight:800, color:k.color, marginBottom:4 }}>{k.value}</div>
                  <div style={{ color:"#475569", fontSize:12 }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* ── System Health Row ──────────────────────────────── */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:24 }}>
              {[
                { icon:<Server size={14}/>,  label:"DB Latency", value:`${sys!.dbLatencyMs}ms`,   ok: sys!.dbLatencyMs < 300 },
                { icon:<Cpu size={14}/>,     label:"RAM",         value:`${sys!.memPct}%`,          ok: sys!.memPct < 80 },
                { icon:<Activity size={14}/>,label:"AI Pending",  value:String(snap.ai.pending),    ok: snap.ai.pending < 10 },
                { icon:<Clock size={14}/>,   label:"Uptime",      value:`${snap.system.uptimeMin}m`, ok: true },
              ].map((s,i) => (
                <div key={i} style={{ background:CARD2, border:`1px solid ${s.ok?"#1e3a1e":"#3a1e1e"}`,
                                      borderRadius:10, padding:"12px 16px",
                                      display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, color:"#64748b", fontSize:13 }}>
                    {s.icon} {s.label}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ color: s.ok?"#22c55e":"#ef4444", fontWeight:700, fontSize:15 }}>{s.value}</span>
                    <Dot ok={s.ok} />
                  </div>
                </div>
              ))}
            </div>

            {/* ── Main Grid: Actions + Finance ──────────────────── */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>

              {/* Auto Optimizer */}
              <div style={{ background:CARD, border:"1px solid #1e293b", borderRadius:16,
                            padding:24, boxShadow:GLOW }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
                  <Zap size={20} color="#eab308" />
                  <span style={{ color:"#f1f5f9", fontWeight:700, fontSize:16 }}>محرك التحسين التلقائي</span>
                  <Badge style={{ background:"#1c1a08", color:"#eab308", border:"1px solid #854d0e", marginRight:"auto" }}>
                    {result.actions.length} إجراء
                  </Badge>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {result.actions.length === 0
                    ? <div style={{ color:"#475569", textAlign:"center", padding:"20px 0" }}>✅ لا توجد إجراءات مطلوبة</div>
                    : result.actions.map((a, i) => (
                      <div key={i} style={{ background:CARD2, border:`1px solid ${priorityColor(a.priority)}22`,
                                            borderRight:`3px solid ${priorityColor(a.priority)}`,
                                            borderRadius:10, padding:"12px 14px" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                          <span style={{ fontSize:16 }}>{categoryIcon(a.category)}</span>
                          <span style={{ fontSize:11, color:priorityColor(a.priority), fontWeight:700,
                                         background:`${priorityColor(a.priority)}18`, padding:"2px 8px",
                                         borderRadius:20, border:`1px solid ${priorityColor(a.priority)}40` }}>
                            {priorityAr(a.priority)}
                          </span>
                        </div>
                        <div style={{ color:"#e2e8f0", fontSize:14, fontWeight:600, marginBottom:4 }}>{a.action}</div>
                        <div style={{ color:"#64748b", fontSize:12 }}>{a.reason}</div>
                        {a.metric && (
                          <div style={{ color:"#475569", fontSize:11, marginTop:4 }}>📌 {a.metric}</div>
                        )}
                      </div>
                    ))
                  }
                </div>
              </div>

              {/* Finance Panel */}
              <div style={{ background:CARD, border:"1px solid #1e293b", borderRadius:16,
                            padding:24, boxShadow:GLOW }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
                  <TrendingUp size={20} color="#22c55e" />
                  <span style={{ color:"#f1f5f9", fontWeight:700, fontSize:16 }}>المؤشرات المالية</span>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {[
                    { label:"إجمالي الإيرادات",  value:`${fmt(snap.finance.totalRevenue)} ر.س`, color:"#22c55e", icon:<ArrowUpRight size={14}/> },
                    { label:"MRR المقدَّر",       value:`${fmt(snap.finance.mrr)} ر.س`,          color:"#3b82f6", icon:<DollarSign size={14}/> },
                    { label:"فواتير مدفوعة",     value:String(snap.finance.paidInvoices),         color:"#a78bfa", icon:<CheckCircle2 size={14}/> },
                    { label:"فواتير متأخرة",     value:String(snap.finance.overdueInvoices),
                      color: snap.finance.overdueInvoices > 5 ? "#ef4444" : "#f97316",
                      icon:<AlertTriangle size={14}/> },
                    { label:"متوسط إيراد/مكتب",  value:`${fmt(snap.finance.avgRevenuePerOffice)} ر.س`, color:"#eab308", icon:<Target size={14}/> },
                  ].map((row, i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                                          padding:"10px 14px", background:CARD2, borderRadius:10,
                                          border:"1px solid #1e293b" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, color:"#64748b", fontSize:13 }}>
                        <span style={{ color:row.color }}>{row.icon}</span>
                        {row.label}
                      </div>
                      <span style={{ color:row.color, fontWeight:700, fontSize:16 }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── AI Forecast ────────────────────────────────────── */}
            <div style={{ background:CARD, border:"1px solid #1e3a8a", borderRadius:16,
                          padding:24, marginBottom:20, boxShadow:"0 0 30px rgba(37,99,235,0.12)" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                            marginBottom: expanded.forecast ? 20 : 0, cursor:"pointer" }}
                   onClick={() => toggle("forecast")}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ background:"#1e3a8a", borderRadius:10, padding:8 }}>
                    <Brain size={20} color="#93c5fd" />
                  </div>
                  <span style={{ color:"#f1f5f9", fontWeight:700, fontSize:16 }}>🔮 AI Forecasting</span>
                  <Badge style={{ background:"#172554", color:"#93c5fd", border:"1px solid #1e40af" }}>Gemini</Badge>
                </div>
                {expanded.forecast ? <ChevronUp size={18} color="#475569"/> : <ChevronDown size={18} color="#475569"/>}
              </div>
              {expanded.forecast && (
                <div style={{ background:CARD2, borderRadius:12, padding:20,
                              borderRight:"3px solid #2563eb" }}>
                  {result.forecast.split("\n").map((line, i) => (
                    <div key={i} style={{ color: line.startsWith("#") ? "#93c5fd" : "#cbd5e1",
                                          fontSize: line.startsWith("#") ? 15 : 14,
                                          fontWeight: line.startsWith("#") ? 700 : 400,
                                          marginBottom:6, lineHeight:1.7 }}>
                      {renderText(line || "\u00a0")}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── CEO Decision ───────────────────────────────────── */}
            <div style={{ background:CARD, border:"1px solid #4c1d95", borderRadius:16,
                          padding:24, boxShadow:"0 0 30px rgba(124,58,237,0.15)" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                            marginBottom: expanded.decision ? 20 : 0, cursor:"pointer" }}
                   onClick={() => toggle("decision")}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ background:"#2e1065", borderRadius:10, padding:8 }}>
                    <Brain size={20} color="#c4b5fd" />
                  </div>
                  <span style={{ color:"#f1f5f9", fontWeight:700, fontSize:16 }}>🧠 AI CEO Decision Layer</span>
                  <Badge style={{ background:"#1e1040", color:"#c4b5fd", border:"1px solid #6d28d9" }}>القرار الاستراتيجي</Badge>
                </div>
                {expanded.decision ? <ChevronUp size={18} color="#475569"/> : <ChevronDown size={18} color="#475569"/>}
              </div>
              {expanded.decision && (
                <div style={{ background:CARD2, borderRadius:12, padding:20,
                              borderRight:"3px solid #7c3aed" }}>
                  {result.decision.split("\n").map((line, i) => (
                    <div key={i} style={{ color: line.startsWith("#") ? "#c4b5fd" : "#cbd5e1",
                                          fontSize: line.startsWith("#") ? 15 : 14,
                                          fontWeight: line.startsWith("#") ? 700 : 400,
                                          marginBottom:6, lineHeight:1.7 }}>
                      {renderText(line || "\u00a0")}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── CSS animations ─────────────────────────────────────── */}
        <style>{`
          @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
          @keyframes pulse { 0%,80%,100% { opacity:.3; transform:scale(0.8); } 40% { opacity:1; transform:scale(1.2); } }
        `}</style>
      </div>
    </AdminLayout>
  );
}
