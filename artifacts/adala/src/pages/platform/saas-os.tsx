import { useState, useCallback } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Brain, TrendingUp, Zap, Target, AlertTriangle,
  CheckCircle2, XCircle, RefreshCw, Play, ChevronUp,
  ChevronDown, DollarSign, Users, Building2, Activity,
  Server, Clock, ArrowUpRight, Cpu, Radio, Shield,
  FlaskConical, ListTodo, Send, CircleDot,
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
interface Safety {
  ok: boolean;
  score: number;
  violations: string[];
  warnings: string[];
}
interface EventMetrics {
  signups:number; payments:number; revenue:number; cancels:number;
  logins:number; errors:number; total:number; growth:number; windowHours:number;
}
interface OsEvent {
  id:number; event:string; data:Record<string,any>; source:string; office_id:string|null; created_at:string;
}
interface QueuedAction {
  id:number; type:string; payload:Record<string,any>; status:string;
  safety_ok:boolean; triggered_by:string; created_at:string;
}
interface OsResult {
  snapshot: Snapshot;
  eventMetrics: EventMetrics;
  safety: Safety;
  actions: OptAction[];
  forecast: string | null;
  decision: string | null;
  blocked?: boolean;
  blockReason?: string;
}

/* ── helpers ────────────────────────────────────────────────────── */
const API = "/api";
const fmt = (n:number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}م` : n >= 1_000 ? `${(n/1_000).toFixed(1)}ك` : String(Math.round(n));

function priorityColor(p:string) {
  return p==="critical"?"#ef4444":p==="high"?"#f97316":p==="medium"?"#eab308":"#22c55e";
}
function priorityAr(p:string) {
  return p==="critical"?"حرج":p==="high"?"عالي":p==="medium"?"متوسط":"منخفض";
}
function categoryIcon(c:string) {
  if(c==="retention") return "🔄";
  if(c==="revenue")   return "💰";
  if(c==="growth")    return "📈";
  if(c==="ai")        return "🤖";
  return "⚙️";
}
function eventIcon(e:string) {
  if(e==="signup")  return { icon:"👤", color:"#22c55e" };
  if(e==="payment") return { icon:"💳", color:"#3b82f6" };
  if(e==="cancel")  return { icon:"❌", color:"#ef4444" };
  if(e==="login")   return { icon:"🔑", color:"#a78bfa" };
  if(e==="error")   return { icon:"⚠️", color:"#f97316" };
  return { icon:"📡", color:"#64748b" };
}
function renderText(text:string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p,i) =>
    p.startsWith("**")&&p.endsWith("**")
      ? <strong key={i} style={{color:"#93c5fd"}}>{p.slice(2,-2)}</strong>
      : <span key={i}>{p}</span>
  );
}
function Dot({ok}:{ok:boolean}) {
  return <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",
    background:ok?"#22c55e":"#ef4444",
    boxShadow:ok?"0 0 6px #22c55e":"0 0 6px #ef4444"}} />;
}
function timeAgo(ts:string) {
  const d = Date.now() - new Date(ts).getTime();
  if(d < 60000) return `${Math.round(d/1000)}ث`;
  if(d < 3600000) return `${Math.round(d/60000)}د`;
  return `${Math.round(d/3600000)}س`;
}

/* ── Test events config ─────────────────────────────────────────── */
const TEST_EVENTS = [
  { event:"signup",  label:"تسجيل مكتب",  data:{office:"test"}, color:"#22c55e", icon:"👤" },
  { event:"payment", label:"دفعة واردة",   data:{amount:500},    color:"#3b82f6", icon:"💳" },
  { event:"cancel",  label:"إلغاء اشتراك", data:{plan:"pro"},    color:"#ef4444", icon:"❌" },
  { event:"login",   label:"تسجيل دخول",  data:{},              color:"#a78bfa", icon:"🔑" },
  { event:"error",   label:"خطأ تطبيق",    data:{code:500},     color:"#f97316", icon:"⚠️" },
  { event:"upgrade", label:"ترقية باقة",   data:{plan:"enterprise"}, color:"#eab308", icon:"⭐" },
];

/* ═══════════════════════════════════════════════════════════════ */
export default function SaasOS() {
  const [loading, setLoading]       = useState(false);
  const [phase, setPhase]           = useState<string>("");
  const [result, setResult]         = useState<OsResult|null>(null);
  const [error, setError]           = useState<string|null>(null);
  const [expanded, setExpanded]     = useState<Record<string,boolean>>({ forecast:true, decision:true });
  const [activeTab, setActiveTab]   = useState<"main"|"events"|"actions">("main");
  const [events, setEvents]         = useState<{metrics:EventMetrics;recent:OsEvent[]}|null>(null);
  const [actions, setActions]       = useState<QueuedAction[]|null>(null);
  const [tracking, setTracking]     = useState<string|null>(null);
  const [trackLog, setTrackLog]     = useState<{event:string;ts:string;ok:boolean}[]>([]);

  const toggle = (k:string) => setExpanded(p=>({...p,[k]:!p[k]}));

  /* ── Run full OS ─────────────────────────────────────────────── */
  const runOS = useCallback(async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      setPhase("📡 Event System — جمع الأحداث...");
      await new Promise(r=>setTimeout(r,300));
      setPhase("🧪 Safety Guard — فحص الأمان...");
      await new Promise(r=>setTimeout(r,300));
      setPhase("📊 Metrics Engine — تحليل المقاييس...");
      await new Promise(r=>setTimeout(r,300));
      setPhase("🔮 AI Forecast — يحسب المستقبل...");
      const res = await fetch(`${API}/saas-os/run`, { method:"POST",
        headers:{"Content-Type":"application/json"} });
      if(!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      if(!json.ok) throw new Error(json.error??"خطأ غير معروف");
      setPhase("🧠 CEO Decision — يُصدر القرار...");
      await new Promise(r=>setTimeout(r,200));
      setResult(json.data);
      setActiveTab("main");
    } catch(e:any) { setError(e.message); }
    finally { setLoading(false); setPhase(""); }
  }, []);

  /* ── Load Events tab ─────────────────────────────────────────── */
  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch(`${API}/saas-os/events`);
      const json = await res.json();
      if(json.ok) setEvents(json.data);
    } catch {}
  }, []);

  /* ── Load Actions tab ────────────────────────────────────────── */
  const loadActions = useCallback(async () => {
    try {
      const res = await fetch(`${API}/saas-os/actions`);
      const json = await res.json();
      if(json.ok) setActions(json.data);
    } catch {}
  }, []);

  /* ── Track a test event ──────────────────────────────────────── */
  const fireEvent = useCallback(async (ev: typeof TEST_EVENTS[0]) => {
    setTracking(ev.event);
    try {
      const res = await fetch(`${API}/saas-os/track`, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ event: ev.event, data: ev.data, source:"test-panel" }),
      });
      const json = await res.json();
      setTrackLog(prev => [
        { event: ev.event, ts: new Date().toLocaleTimeString("ar-SA"), ok: json.ok },
        ...prev.slice(0, 9),
      ]);
      if(activeTab === "events") await loadEvents();
    } catch {
      setTrackLog(prev => [{ event:ev.event, ts: new Date().toLocaleTimeString("ar-SA"), ok:false }, ...prev.slice(0,9)]);
    }
    setTracking(null);
  }, [activeTab, loadEvents]);

  /* ── Tab switch ──────────────────────────────────────────────── */
  const switchTab = (tab: "main"|"events"|"actions") => {
    setActiveTab(tab);
    if(tab==="events") loadEvents();
    if(tab==="actions") loadActions();
  };

  const snap = result?.snapshot;
  const sys  = snap?.system;
  const safety = result?.safety;

  /* ── palette ─────────────────────────────────────────────────── */
  const BG    = "#070D1A";
  const CARD  = "#0D1629";
  const CARD2 = "#111D35";
  const GLOW  = "0 0 24px rgba(37,99,235,0.15)";

  return (
    <AdminLayout>
      <div style={{minHeight:"100vh",background:BG,padding:"28px 24px",direction:"rtl"}}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{background:"linear-gradient(135deg,#1e40af,#7c3aed)",borderRadius:12,
                         padding:10,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Brain size={26} color="#fff"/>
            </div>
            <div>
              <h1 style={{margin:0,fontSize:26,fontWeight:800,
                          background:"linear-gradient(90deg,#60a5fa,#a78bfa)",
                          WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                SaaS Operating System
              </h1>
              <div style={{color:"#475569",fontSize:12,marginTop:2}}>
                نظام التشغيل الذكي لـ عدالة AI — Core OS v2
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            {result && <span style={{color:"#475569",fontSize:11}}>
              {new Date(result.snapshot.capturedAt).toLocaleTimeString("ar-SA")}
            </span>}
            <Button onClick={runOS} disabled={loading}
              style={{background:"linear-gradient(135deg,#2563eb,#7c3aed)",border:"none",
                      color:"#fff",padding:"9px 22px",borderRadius:10,fontWeight:700,fontSize:14,
                      cursor:loading?"wait":"pointer",boxShadow:"0 4px 20px rgba(37,99,235,0.4)",
                      display:"flex",alignItems:"center",gap:8}}>
              {loading
                ? <><RefreshCw size={15} style={{animation:"spin 1s linear infinite"}}/> جارٍ...</>
                : <><Play size={15} fill="#fff"/> تشغيل النظام</>}
            </Button>
          </div>
        </div>

        {/* ── OS Architecture — 4 Layers ─────────────────────────── */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
          {[
            { icon:<Radio size={18}/>,      label:"Event System",  sub:"📡 تتبع الأحداث",   color:"#22c55e", tab:"events" },
            { icon:<Brain size={18}/>,      label:"AI CEO Engine", sub:"🧠 القرار الاستراتيجي", color:"#a78bfa", tab:"main" },
            { icon:<ListTodo size={18}/>,   label:"Action Queue",  sub:"⚙️ تنفيذ آمن",     color:"#eab308", tab:"actions" },
            { icon:<Shield size={18}/>,     label:"Safety Guard",  sub:"🧪 حماية الإنتاج", color:"#ef4444", tab:"main" },
          ].map((layer, i) => (
            <div key={i}
              onClick={() => switchTab(layer.tab as any)}
              style={{background:activeTab===layer.tab?CARD2:CARD,
                      border:`1px solid ${activeTab===layer.tab?layer.color+"44":"#1e293b"}`,
                      borderRadius:12,padding:"14px 16px",cursor:"pointer",
                      transition:"all 0.2s",
                      boxShadow:activeTab===layer.tab?`0 0 16px ${layer.color}22`:"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,color:layer.color}}>
                {layer.icon}
                <span style={{color:"#e2e8f0",fontSize:13,fontWeight:600}}>{layer.label}</span>
              </div>
              <div style={{color:"#64748b",fontSize:12}}>{layer.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Loading ─────────────────────────────────────────────── */}
        {loading && (
          <div style={{background:CARD,border:"1px solid #1e3a8a",borderRadius:16,
                       padding:36,textAlign:"center",marginBottom:24,
                       boxShadow:"0 0 40px rgba(37,99,235,0.2)"}}>
            <div style={{fontSize:30,marginBottom:12}}>🧠</div>
            <div style={{color:"#93c5fd",fontSize:17,fontWeight:600,marginBottom:6}}>{phase||"جارٍ التحليل..."}</div>
            <div style={{color:"#475569",fontSize:12}}>4 طبقات تعمل بالتسلسل</div>
            <div style={{display:"flex",justifyContent:"center",gap:8,marginTop:16}}>
              {[0,1,2].map(i=>(
                <div key={i} style={{width:8,height:8,borderRadius:"50%",background:"#2563eb",
                  animation:`pulse 1.4s ease-in-out ${i*0.2}s infinite`}}/>
              ))}
            </div>
          </div>
        )}

        {/* ── Error ──────────────────────────────────────────────── */}
        {error && (
          <div style={{background:"#1c0a0a",border:"1px solid #7f1d1d",borderRadius:12,
                       padding:14,marginBottom:20,color:"#fca5a5",display:"flex",alignItems:"center",gap:10}}>
            <XCircle size={16}/> {error}
          </div>
        )}

        {/* ═══════ TAB: EVENTS ════════════════════════════════════ */}
        {activeTab === "events" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>

            {/* Event Test Panel */}
            <div style={{background:CARD,border:"1px solid #1e293b",borderRadius:16,padding:22,boxShadow:GLOW}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:18}}>
                <FlaskConical size={18} color="#22c55e"/>
                <span style={{color:"#f1f5f9",fontWeight:700,fontSize:15}}>لوحة الاختبار التجريبي</span>
                <Badge style={{background:"#0a1f0a",color:"#22c55e",border:"1px solid #166534",marginRight:"auto",fontSize:10}}>
                  TEST PANEL
                </Badge>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
                {TEST_EVENTS.map((ev) => (
                  <button key={ev.event}
                    disabled={tracking === ev.event}
                    onClick={() => fireEvent(ev)}
                    style={{background:CARD2,border:`1px solid ${ev.color}33`,
                            borderRadius:10,padding:"10px 12px",cursor:"pointer",
                            display:"flex",alignItems:"center",gap:8,
                            transition:"all 0.15s",
                            opacity: tracking && tracking !== ev.event ? 0.5 : 1}}>
                    <span style={{fontSize:18}}>{ev.icon}</span>
                    <div style={{textAlign:"right"}}>
                      <div style={{color:"#e2e8f0",fontSize:13,fontWeight:600}}>{ev.label}</div>
                      <div style={{color:"#475569",fontSize:10}}>{ev.event}</div>
                    </div>
                    {tracking === ev.event && (
                      <RefreshCw size={12} style={{animation:"spin 1s linear infinite",color:ev.color,marginRight:"auto"}}/>
                    )}
                  </button>
                ))}
              </div>

              {/* Track Log */}
              {trackLog.length > 0 && (
                <div style={{background:CARD2,borderRadius:10,padding:12,border:"1px solid #1e293b"}}>
                  <div style={{color:"#64748b",fontSize:11,marginBottom:8}}>سجل الأحداث المُطلَقة</div>
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    {trackLog.map((l,i) => (
                      <div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}>
                        <Dot ok={l.ok}/>
                        <span style={{color:"#94a3b8"}}>{eventIcon(l.event).icon}</span>
                        <span style={{color:"#e2e8f0"}}>{l.event}</span>
                        <span style={{color:"#475569",marginRight:"auto"}}>{l.ts}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Live Event Feed */}
            <div style={{background:CARD,border:"1px solid #1e293b",borderRadius:16,padding:22,boxShadow:GLOW}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <Radio size={16} color="#22c55e"/>
                  <span style={{color:"#f1f5f9",fontWeight:700,fontSize:15}}>الأحداث الحية</span>
                </div>
                <Button onClick={loadEvents}
                  style={{background:CARD2,border:"1px solid #1e293b",color:"#94a3b8",
                          padding:"5px 12px",borderRadius:8,fontSize:12,cursor:"pointer"}}>
                  <RefreshCw size={12}/> تحديث
                </Button>
              </div>

              {/* Event Metrics */}
              {events && (
                <>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
                    {[
                      {label:"تسجيل",   val:events.metrics.signups,  icon:"👤", c:"#22c55e"},
                      {label:"دفعات",   val:events.metrics.payments, icon:"💳", c:"#3b82f6"},
                      {label:"إلغاء",   val:events.metrics.cancels,  icon:"❌", c:"#ef4444"},
                      {label:"دخول",    val:events.metrics.logins,   icon:"🔑", c:"#a78bfa"},
                      {label:"أخطاء",   val:events.metrics.errors,   icon:"⚠️", c:"#f97316"},
                      {label:"النمو",   val:events.metrics.growth,   icon:"📈", c: events.metrics.growth>=0?"#22c55e":"#ef4444"},
                    ].map((m,i)=>(
                      <div key={i} style={{background:CARD2,borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
                        <div style={{fontSize:14}}>{m.icon}</div>
                        <div style={{color:m.c,fontWeight:700,fontSize:16}}>{m.val}</div>
                        <div style={{color:"#475569",fontSize:10}}>{m.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Recent events list */}
                  <div style={{maxHeight:240,overflowY:"auto",display:"flex",flexDirection:"column",gap:5}}>
                    {events.recent.length === 0
                      ? <div style={{color:"#475569",textAlign:"center",padding:20,fontSize:13}}>
                          لا توجد أحداث بعد — استخدم لوحة الاختبار
                        </div>
                      : events.recent.map((ev) => {
                        const ei = eventIcon(ev.event);
                        return (
                          <div key={ev.id} style={{display:"flex",alignItems:"center",gap:10,
                                                    background:CARD2,borderRadius:8,padding:"7px 10px",
                                                    borderRight:`3px solid ${ei.color}44`}}>
                            <span style={{fontSize:14}}>{ei.icon}</span>
                            <span style={{color:"#e2e8f0",fontSize:13,fontWeight:500}}>{ev.event}</span>
                            <span style={{color:"#475569",fontSize:11}}>{ev.source}</span>
                            <span style={{color:"#334155",fontSize:11,marginRight:"auto"}}>
                              {timeAgo(ev.created_at)}
                            </span>
                          </div>
                        );
                      })
                    }
                  </div>
                </>
              )}
              {!events && (
                <div style={{color:"#475569",textAlign:"center",padding:40,fontSize:13}}>
                  اضغط "تحديث" لجلب الأحداث
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════ TAB: ACTIONS ════════════════════════════════════ */}
        {activeTab === "actions" && (
          <div style={{background:CARD,border:"1px solid #1e293b",borderRadius:16,padding:24,boxShadow:GLOW}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <ListTodo size={20} color="#eab308"/>
                <span style={{color:"#f1f5f9",fontWeight:700,fontSize:16}}>قائمة انتظار الإجراءات</span>
                <Badge style={{background:"#1c1a08",color:"#eab308",border:"1px solid #854d0e",fontSize:10}}>
                  آمن — قراءة فقط
                </Badge>
              </div>
              <Button onClick={loadActions}
                style={{background:CARD2,border:"1px solid #1e293b",color:"#94a3b8",
                        padding:"6px 14px",borderRadius:8,fontSize:13,cursor:"pointer",display:"flex",gap:6}}>
                <RefreshCw size={13}/> تحديث
              </Button>
            </div>

            {!actions && (
              <div style={{color:"#475569",textAlign:"center",padding:40,fontSize:13}}>
                شغّل النظام أولاً لملء قائمة الإجراءات، أو اضغط "تحديث"
              </div>
            )}
            {actions && actions.length === 0 && (
              <div style={{color:"#475569",textAlign:"center",padding:40,fontSize:13}}>
                لا توجد إجراءات مُقترحة بعد
              </div>
            )}
            {actions && actions.length > 0 && (
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {actions.map((a) => (
                  <div key={a.id} style={{background:CARD2,border:`1px solid ${a.safety_ok?"#1e3a1e":"#3a1e1e"}`,
                                          borderRight:`3px solid ${a.safety_ok?"#22c55e":"#ef4444"}`,
                                          borderRadius:12,padding:"14px 16px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                      <Dot ok={a.safety_ok}/>
                      <span style={{color:"#94a3b8",fontSize:12,fontWeight:700,
                                     background:CARD,padding:"2px 8px",borderRadius:20}}>
                        {a.type}
                      </span>
                      <span style={{color:"#475569",fontSize:11}}>{a.triggered_by}</span>
                      <span style={{color:"#334155",fontSize:11,marginRight:"auto"}}>
                        {timeAgo(a.created_at)}
                      </span>
                      <Badge style={{background:a.safety_ok?"#0a1f0a":"#1c0a0a",
                                     color:a.safety_ok?"#22c55e":"#ef4444",
                                     border:`1px solid ${a.safety_ok?"#166534":"#7f1d1d"}`,
                                     fontSize:10}}>
                        {a.safety_ok ? "✅ آمن" : "🚫 محجوب"}
                      </Badge>
                    </div>
                    {a.payload?.action && (
                      <div style={{color:"#e2e8f0",fontSize:14,fontWeight:500,marginBottom:4}}>
                        {categoryIcon(a.payload?.category??"")} {a.payload.action}
                      </div>
                    )}
                    {a.payload?.reason && (
                      <div style={{color:"#64748b",fontSize:12}}>{a.payload.reason}</div>
                    )}
                    {a.payload?.violations && (
                      <div style={{color:"#ef4444",fontSize:12}}>
                        🚫 {a.payload.violations?.join(", ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════ TAB: MAIN ══════════════════════════════════════ */}
        {activeTab === "main" && !result && !loading && (
          <div style={{background:CARD,border:"1px solid #1e293b",borderRadius:16,
                       padding:40,textAlign:"center",boxShadow:GLOW}}>
            <div style={{fontSize:48,marginBottom:16}}>🧠</div>
            <div style={{color:"#94a3b8",fontSize:16,fontWeight:600,marginBottom:8}}>
              نظام التشغيل الذكي جاهز
            </div>
            <div style={{color:"#475569",fontSize:13,marginBottom:24}}>
              4 طبقات: Event System → Safety Guard → AI Forecast → CEO Decision
            </div>
            <div style={{display:"flex",justifyContent:"center",gap:12,flexWrap:"wrap",marginBottom:28}}>
              {["📡 Event Tracking","🧪 Safety Layer","🔮 AI Forecast","🧠 CEO Decision","⚙️ Action Queue"].map((l,i)=>(
                <div key={i} style={{background:CARD2,border:"1px solid #1e293b",borderRadius:20,
                                      padding:"6px 14px",color:"#64748b",fontSize:12}}>{l}</div>
              ))}
            </div>
            <Button onClick={runOS}
              style={{background:"linear-gradient(135deg,#1e40af,#7c3aed)",border:"none",color:"#fff",
                      padding:"14px 40px",borderRadius:12,fontWeight:700,fontSize:16,cursor:"pointer",
                      boxShadow:"0 6px 30px rgba(37,99,235,0.5)"}}>
              🚀 تشغيل النظام
            </Button>
          </div>
        )}

        {activeTab === "main" && result && snap && (
          <>
            {/* ── Safety Status ──────────────────────────────────── */}
            <div style={{background: safety?.ok ? "#0a1f0a" : "#1c0a0a",
                         border:`1px solid ${safety?.ok?"#166534":"#7f1d1d"}`,
                         borderRadius:14,padding:"14px 20px",marginBottom:20,
                         display:"flex",alignItems:"center",gap:14}}>
              {safety?.ok
                ? <CheckCircle2 size={22} color="#22c55e"/>
                : <XCircle size={22} color="#ef4444"/>}
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{color:safety?.ok?"#22c55e":"#ef4444",fontWeight:700,fontSize:15}}>
                    🧪 Safety Guard — {safety?.ok ? "✅ اجتاز الفحص" : "🚫 محجوب"}
                  </span>
                  <Badge style={{background:"rgba(0,0,0,0.3)",color:safety?.ok?"#22c55e":"#ef4444",fontSize:11}}>
                    Score: {safety?.score}/100
                  </Badge>
                  {result.blocked && (
                    <Badge style={{background:"#3a0a0a",color:"#ef4444",border:"1px solid #7f1d1d",fontSize:11}}>
                      النظام محجوب — AI لم تعمل
                    </Badge>
                  )}
                </div>
                {safety?.violations.length ? (
                  <div style={{color:"#fca5a5",fontSize:12,marginTop:4}}>
                    🚫 {safety.violations.join(" | ")}
                  </div>
                ) : null}
                {safety?.warnings.length ? (
                  <div style={{color:"#fbbf24",fontSize:12,marginTop:2}}>
                    ⚠️ {safety.warnings.join(" | ")}
                  </div>
                ) : null}
              </div>
            </div>

            {/* ── Event Metrics Strip ──────────────────────────── */}
            {result.eventMetrics && (
              <div style={{background:CARD,border:"1px solid #1e293b",borderRadius:12,
                           padding:"14px 20px",marginBottom:20,
                           display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <Radio size={15} color="#22c55e"/>
                  <span style={{color:"#64748b",fontSize:13}}>أحداث 24h:</span>
                </div>
                {[
                  {label:"تسجيل", val:result.eventMetrics.signups,  icon:"👤", c:"#22c55e"},
                  {label:"دفعات", val:result.eventMetrics.payments, icon:"💳", c:"#3b82f6"},
                  {label:"إلغاء", val:result.eventMetrics.cancels,  icon:"❌", c:"#ef4444"},
                  {label:"أخطاء", val:result.eventMetrics.errors,   icon:"⚠️", c:"#f97316"},
                  {label:"النمو", val:result.eventMetrics.growth,   icon:"📈",
                   c:result.eventMetrics.growth>=0?"#22c55e":"#ef4444"},
                ].map((m,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:13}}>{m.icon}</span>
                    <span style={{color:m.c,fontWeight:700,fontSize:15}}>{m.val}</span>
                    <span style={{color:"#475569",fontSize:11}}>{m.label}</span>
                  </div>
                ))}
                <button onClick={()=>switchTab("events")}
                  style={{marginRight:"auto",background:CARD2,border:"1px solid #1e293b",
                          borderRadius:8,padding:"4px 12px",color:"#60a5fa",fontSize:12,cursor:"pointer"}}>
                  عرض الكل ←
                </button>
              </div>
            )}

            {/* ── KPI Grid ──────────────────────────────────────── */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
              {[
                {icon:<Building2 size={18}/>,label:"مكاتب نشطة",   value:fmt(snap.platform.activeOffices),sub:`${snap.platform.newOffices30d} جديد/شهر`,color:"#3b82f6"},
                {icon:<DollarSign size={18}/>,label:"MRR المقدَّر", value:`${fmt(snap.finance.mrr)} ر.س`,  sub:`${fmt(snap.finance.avgRevenuePerOffice)}/مكتب`,color:"#22c55e"},
                {icon:<Users size={18}/>,     label:"المستخدمون",   value:fmt(snap.platform.totalUsers),   sub:`${snap.platform.totalCases} قضية`,color:"#a78bfa"},
                {icon:<AlertTriangle size={18}/>,label:"Churn Risk",value:`${snap.platform.churnRisk}%`,
                 sub:`${snap.platform.atRiskOffices} معرَّض`,
                 color:snap.platform.churnRisk>20?"#ef4444":snap.platform.churnRisk>10?"#f97316":"#22c55e"},
              ].map((k,i)=>(
                <div key={i} style={{background:CARD,border:"1px solid #1e293b",borderRadius:14,padding:18,boxShadow:GLOW}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:10,color:"#64748b"}}>
                    <span style={{color:k.color}}>{k.icon}</span>
                    <span style={{fontSize:12}}>{k.label}</span>
                  </div>
                  <div style={{fontSize:26,fontWeight:800,color:k.color,marginBottom:4}}>{k.value}</div>
                  <div style={{color:"#475569",fontSize:11}}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* ── System + Actions ──────────────────────────────── */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:18}}>

              {/* System Health */}
              <div style={{background:CARD,border:"1px solid #1e293b",borderRadius:14,padding:20,boxShadow:GLOW}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
                  <Server size={16} color="#3b82f6"/>
                  <span style={{color:"#f1f5f9",fontWeight:700,fontSize:14}}>صحة النظام</span>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {[
                    {icon:<Server size={13}/>,  label:"DB Latency", val:`${sys!.dbLatencyMs}ms`,   ok:sys!.dbLatencyMs<300},
                    {icon:<Cpu size={13}/>,     label:"RAM",         val:`${sys!.memPct}%`,          ok:sys!.memPct<80},
                    {icon:<Activity size={13}/>,label:"AI Pending",  val:String(snap.ai.pending),    ok:snap.ai.pending<10},
                    {icon:<Clock size={13}/>,   label:"Uptime",      val:`${sys!.uptimeMin}m`,        ok:true},
                  ].map((s,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                                         background:CARD2,borderRadius:8,padding:"8px 12px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:7,color:"#64748b",fontSize:12}}>
                        {s.icon} {s.label}
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{color:s.ok?"#22c55e":"#ef4444",fontWeight:700,fontSize:14}}>{s.val}</span>
                        <Dot ok={s.ok}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Auto Optimizer */}
              <div style={{background:CARD,border:"1px solid #1e293b",borderRadius:14,padding:20,boxShadow:GLOW}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
                  <Zap size={16} color="#eab308"/>
                  <span style={{color:"#f1f5f9",fontWeight:700,fontSize:14}}>التحسين التلقائي</span>
                  <Badge style={{background:"#1c1a08",color:"#eab308",border:"1px solid #854d0e",
                                 marginRight:"auto",fontSize:10}}>
                    {result.actions.length}
                  </Badge>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:180,overflowY:"auto"}}>
                  {result.actions.length===0
                    ? <div style={{color:"#475569",textAlign:"center",padding:20,fontSize:13}}>✅ لا إجراءات</div>
                    : result.actions.map((a,i)=>(
                      <div key={i} style={{background:CARD2,
                                            borderRight:`3px solid ${priorityColor(a.priority)}`,
                                            borderRadius:8,padding:"9px 12px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                          <span style={{fontSize:14}}>{categoryIcon(a.category)}</span>
                          <span style={{fontSize:10,color:priorityColor(a.priority),fontWeight:700,
                                         background:`${priorityColor(a.priority)}18`,
                                         padding:"1px 7px",borderRadius:20}}>
                            {priorityAr(a.priority)}
                          </span>
                        </div>
                        <div style={{color:"#e2e8f0",fontSize:13,fontWeight:500}}>{a.action}</div>
                        <div style={{color:"#64748b",fontSize:11,marginTop:2}}>{a.reason}</div>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>

            {/* ── AI Forecast ────────────────────────────────────── */}
            {result.forecast && (
              <div style={{background:CARD,border:"1px solid #1e3a8a",borderRadius:14,
                           padding:22,marginBottom:18,boxShadow:"0 0 24px rgba(37,99,235,0.1)"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                              marginBottom:expanded.forecast?18:0,cursor:"pointer"}}
                     onClick={()=>toggle("forecast")}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{background:"#1e3a8a",borderRadius:9,padding:7}}>
                      <Brain size={17} color="#93c5fd"/>
                    </div>
                    <span style={{color:"#f1f5f9",fontWeight:700,fontSize:15}}>🔮 AI Forecast</span>
                    <Badge style={{background:"#172554",color:"#93c5fd",border:"1px solid #1e40af",fontSize:10}}>Gemini</Badge>
                  </div>
                  {expanded.forecast?<ChevronUp size={16} color="#475569"/>:<ChevronDown size={16} color="#475569"/>}
                </div>
                {expanded.forecast && (
                  <div style={{background:CARD2,borderRadius:10,padding:18,borderRight:"3px solid #2563eb"}}>
                    {result.forecast.split("\n").map((line,i)=>(
                      <div key={i} style={{color:line.startsWith("#")?"#93c5fd":"#cbd5e1",
                                            fontSize:line.startsWith("#")?14:13,
                                            fontWeight:line.startsWith("#")?700:400,
                                            marginBottom:5,lineHeight:1.7}}>
                        {renderText(line||"\u00a0")}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── CEO Decision ───────────────────────────────────── */}
            {result.decision && (
              <div style={{background:CARD,border:"1px solid #4c1d95",borderRadius:14,
                           padding:22,boxShadow:"0 0 24px rgba(124,58,237,0.12)"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                              marginBottom:expanded.decision?18:0,cursor:"pointer"}}
                     onClick={()=>toggle("decision")}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{background:"#2e1065",borderRadius:9,padding:7}}>
                      <Brain size={17} color="#c4b5fd"/>
                    </div>
                    <span style={{color:"#f1f5f9",fontWeight:700,fontSize:15}}>🧠 AI CEO Decision</span>
                    <Badge style={{background:"#1e1040",color:"#c4b5fd",border:"1px solid #6d28d9",fontSize:10}}>القرار الاستراتيجي</Badge>
                    <button onClick={(e)=>{e.stopPropagation();switchTab("actions");loadActions();}}
                      style={{background:CARD2,border:"1px solid #1e293b",borderRadius:8,
                              padding:"3px 10px",color:"#60a5fa",fontSize:11,cursor:"pointer"}}>
                      قائمة الإجراءات →
                    </button>
                  </div>
                  {expanded.decision?<ChevronUp size={16} color="#475569"/>:<ChevronDown size={16} color="#475569"/>}
                </div>
                {expanded.decision && (
                  <div style={{background:CARD2,borderRadius:10,padding:18,borderRight:"3px solid #7c3aed"}}>
                    {result.decision.split("\n").map((line,i)=>(
                      <div key={i} style={{color:line.startsWith("#")?"#c4b5fd":"#cbd5e1",
                                            fontSize:line.startsWith("#")?14:13,
                                            fontWeight:line.startsWith("#")?700:400,
                                            marginBottom:5,lineHeight:1.7}}>
                        {renderText(line||"\u00a0")}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Blocked message */}
            {result.blocked && (
              <div style={{background:"#1c0a0a",border:"1px solid #7f1d1d",borderRadius:14,
                           padding:22,textAlign:"center"}}>
                <XCircle size={28} color="#ef4444" style={{marginBottom:12}}/>
                <div style={{color:"#ef4444",fontWeight:700,fontSize:16,marginBottom:6}}>
                  🚫 Safety Guard — تم حجب نظام AI
                </div>
                <div style={{color:"#fca5a5",fontSize:13}}>{result.blockReason}</div>
                <div style={{color:"#64748b",fontSize:12,marginTop:8}}>
                  عالج المشكلات أعلاه وأعد تشغيل النظام
                </div>
              </div>
            )}
          </>
        )}

        <style>{`
          @keyframes spin   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
          @keyframes pulse  { 0%,80%,100%{opacity:.3;transform:scale(0.8)} 40%{opacity:1;transform:scale(1.2)} }
        `}</style>
      </div>
    </AdminLayout>
  );
}
