import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  GitBranch, Play, Save, Trash2, Sparkles, Loader2, ChevronRight,
  Zap, Brain, FileText, Bell, AlertTriangle, RefreshCw, CheckCircle2,
  Clock, Circle, ArrowRight, Plus, X, BarChart3, Cpu, List,
  History, Wand2, ChevronDown, ChevronUp, ShieldOff, Lock
} from "lucide-react";

/* ── Node type config ─────────────────────────────────────────────── */
const NODE_TYPES: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  trigger:   { color: "#10b981", bg: "#d1fae5", icon: Zap,           label: "زناد"         },
  ai_think:  { color: "#6366f1", bg: "#e0e7ff", icon: Brain,         label: "تفكير ذكي"    },
  legal_doc: { color: "#f59e0b", bg: "#fef3c7", icon: FileText,      label: "وثيقة قانونية" },
  notify:    { color: "#3b82f6", bg: "#dbeafe", icon: Bell,          label: "إشعار"         },
  condition: { color: "#ec4899", bg: "#fce7f3", icon: AlertTriangle, label: "شرط"          },
  action:    { color: "#8b5cf6", bg: "#ede9fe", icon: Cpu,           label: "إجراء"        },
  loop:      { color: "#06b6d4", bg: "#cffafe", icon: RefreshCw,     label: "حلقة"         },
  output:    { color: "#ef4444", bg: "#fee2e2", icon: CheckCircle2,  label: "نتيجة"        },
};

/* ── Edge SVG path ────────────────────────────────────────────────── */
function EdgePath({ from, to, nodes, label }: { from: string; to: string; nodes: any[]; label?: string }) {
  const fNode = nodes.find(n => n.id === from);
  const tNode = nodes.find(n => n.id === to);
  if (!fNode || !tNode) return null;
  const fx = fNode.x + 100, fy = fNode.y + 40;
  const tx = tNode.x + 100, ty = tNode.y + 40;
  const cy = (fy + ty) / 2;
  const d = `M ${fx} ${fy} C ${fx} ${cy}, ${tx} ${cy}, ${tx} ${ty}`;
  return (
    <g>
      <path d={d} fill="none" stroke="#6366f1" strokeWidth={2} strokeDasharray="6,3" opacity={0.5} />
      {label && (
        <text x={(fx + tx) / 2} y={cy} textAnchor="middle" fill="#6366f1" fontSize={10} dy={-4}>{label}</text>
      )}
      <polygon points={`${tx},${ty} ${tx - 5},${ty - 8} ${tx + 5},${ty - 8}`} fill="#6366f1" opacity={0.7} />
    </g>
  );
}

/* ── Single Node ──────────────────────────────────────────────────── */
function WorkflowNode({
  node, isActive, isDone, result, onDrag
}: {
  node: any; isActive?: boolean; isDone?: boolean; result?: string; onDrag: (id: string, dx: number, dy: number) => void;
}) {
  const cfg = NODE_TYPES[node.type] ?? NODE_TYPES.action;
  const Icon = cfg.icon;
  const dragRef = useRef<{ startX: number; startY: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY };
    const move = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      onDrag(node.id, ev.clientX - dragRef.current.startX, ev.clientY - dragRef.current.startY);
      dragRef.current = { startX: ev.clientX, startY: ev.clientY };
    };
    const up = () => { dragRef.current = null; window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{ position: "absolute", left: node.x, top: node.y, width: 200, cursor: "grab", zIndex: isActive ? 20 : 10 }}
      className="select-none"
    >
      <div className={`rounded-xl border-2 shadow-lg transition-all duration-300 overflow-hidden
        ${isActive ? "scale-105 shadow-2xl border-indigo-400" : isDone ? "border-emerald-400" : "border-white/60"}
        bg-white`}
      >
        {/* header */}
        <div className="flex items-center gap-2 px-3 py-2" style={{ backgroundColor: cfg.bg }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: cfg.color }}>
            <Icon size={14} color="white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold truncate" style={{ color: cfg.color }}>{node.title}</p>
            <p className="text-[10px] text-gray-500">{cfg.label}</p>
          </div>
          {isActive && <Loader2 size={12} className="animate-spin text-indigo-500" />}
          {isDone && <CheckCircle2 size={12} className="text-emerald-500" />}
        </div>
        {/* body */}
        <div className="px-3 py-1.5">
          <p className="text-[11px] text-gray-600 leading-relaxed">{node.description}</p>
        </div>
        {/* result */}
        {result && (
          <div className="px-3 pb-2">
            <div className="bg-emerald-50 rounded-lg p-2 border border-emerald-200">
              <p className="text-[10px] text-emerald-700 leading-relaxed line-clamp-2">{result}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Canvas ───────────────────────────────────────────────────────── */
function WorkflowCanvas({
  graph, activeNodeId, doneNodes, nodeResults, onDragNode
}: {
  graph: any; activeNodeId: string | null; doneNodes: Set<string>;
  nodeResults: Record<string, string>; onDragNode: (id: string, dx: number, dy: number) => void;
}) {
  const nodes = graph?.nodes ?? [];
  const edges = graph?.edges ?? [];
  const maxX = Math.max(...nodes.map((n: any) => n.x + 220), 900);
  const maxY = Math.max(...nodes.map((n: any) => n.y + 120), 600);

  return (
    <div className="relative overflow-auto w-full h-full" style={{ minHeight: 500 }}>
      {/* SVG edges */}
      <svg style={{ position: "absolute", top: 0, left: 0, width: maxX, height: maxY, pointerEvents: "none" }}>
        {edges.map((e: any) => (
          <EdgePath key={e.id} from={e.from} to={e.to} nodes={nodes} label={e.label} />
        ))}
      </svg>
      {/* Nodes */}
      <div style={{ position: "relative", width: maxX, height: maxY }}>
        {nodes.map((n: any) => (
          <WorkflowNode
            key={n.id}
            node={n}
            isActive={activeNodeId === n.id}
            isDone={doneNodes.has(n.id)}
            result={nodeResults[n.id]}
            onDrag={onDragNode}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Saved Workflow card ──────────────────────────────────────────── */
function SavedCard({ wf, onLoad, onDelete }: { wf: any; onLoad: () => void; onDelete: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 hover:border-indigo-300 hover:shadow-md transition-all group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{wf.name}</p>
          <p className="text-xs text-gray-500 truncate">{wf.description}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-gray-400">
              <Clock size={9} className="inline ml-0.5" />
              {wf.run_count ?? 0} تشغيل
            </span>
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onLoad} className="p-1 rounded-lg hover:bg-indigo-50 text-indigo-600"><ChevronRight size={14} /></button>
          <button onClick={onDelete} className="p-1 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={12} /></button>
        </div>
      </div>
    </div>
  );
}

/* ── QUICK TEMPLATES ────────────────────────────────────────────── */
const TEMPLATES = [
  { label: "متابعة القضية", prompt: "أنشئ workflow لمتابعة قضية قانونية: من استلام الطلب إلى تعيين المحامي وإرسال إشعار للموكل وإنشاء ملف القضية" },
  { label: "مراجعة عقد", prompt: "أنشئ workflow لمراجعة عقد: استلام العقد ثم تحليل AI للبنود ثم تقرير المخاطر ثم إشعار العميل بالنتيجة" },
  { label: "تحصيل الرسوم", prompt: "أنشئ workflow لتحصيل الرسوم: تحديد الفواتير المتأخرة ثم إرسال تذكير أول ثم شرط (هل دفع؟) ثم إجراء قانوني أو إغلاق" },
  { label: "جلسة المحكمة", prompt: "أنشئ workflow للتحضير لجلسة محكمة: مراجعة ملف القضية ثم تحليل AI للحجج ثم إعداد الوثائق ثم إشعار الموكل وتأكيد الموعد" },
];

/* ═══════════════════════════════════════════════════════════════════ */
/*                        MAIN PAGE                                    */
/* ═══════════════════════════════════════════════════════════════════ */
export default function AIWorkflowBuilder() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { getToken } = useAuth();

  const authFetch = async (url: string, opts: RequestInit = {}) => {
    const token = await getToken();
    return fetch(url, {
      ...opts,
      headers: { ...(opts.headers ?? {}), "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    });
  };

  /* ── Access check ── */
  const { data: access, isLoading: accessLoading } = useQuery<any>({
    queryKey: ["workflow-builder-access"],
    queryFn: async () => {
      const token = await getToken();
      const r = await fetch("/api/ai-workflow/access-check", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!r.ok) return { allowed: false };
      return r.json();
    },
    staleTime: 5 * 60_000,
  });

  /* ── state ── */
  const [prompt, setPrompt] = useState("");
  const [graph, setGraph] = useState<any>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [doneNodes, setDoneNodes] = useState<Set<string>>(new Set());
  const [nodeResults, setNodeResults] = useState<Record<string, string>>({});
  const [runLog, setRunLog] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [leftPanel, setLeftPanel] = useState<"prompt" | "saved">("prompt");

  /* ── saved workflows ── */
  const { data: saved = [] } = useQuery<any[]>({
    queryKey: ["ai-workflows"],
    queryFn: async () => {
      const r = await authFetch("/api/ai-workflow");
      if (!r.ok) return [];
      return r.json();
    },
    enabled: access?.allowed === true,
  });

  /* ── generate workflow ── */
  const generateMut = useMutation({
    mutationFn: async (p: string) => {
      const r = await authFetch("/api/ai-workflow/generate", {
        method: "POST",
        body: JSON.stringify({ prompt: p }),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: (data) => {
      setGraph(data.graph);
      setSavedId(null);
      setDoneNodes(new Set());
      setNodeResults({});
      setRunLog([]);
      toast({ title: "✨ تم توليد الـ Workflow!", description: `${data.graph?.nodes?.length ?? 0} خطوة` });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  /* ── save ── */
  const saveMut = useMutation({
    mutationFn: async () => {
      const r = await authFetch("/api/ai-workflow", {
        method: "POST",
        body: JSON.stringify({
          name: graph?.name ?? "Workflow جديد",
          description: graph?.description ?? "",
          prompt,
          graph_json: graph,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: (data) => {
      setSavedId(data.id);
      qc.invalidateQueries({ queryKey: ["ai-workflows"] });
      toast({ title: "💾 تم الحفظ!", description: graph?.name });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  /* ── delete ── */
  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await authFetch(`/api/ai-workflow/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-workflows"] }),
  });

  /* ── execute via SSE ── */
  const executeWorkflow = useCallback(async () => {
    if (!savedId) { toast({ title: "احفظ الـ Workflow أولاً" }); return; }
    setIsRunning(true);
    setDoneNodes(new Set());
    setNodeResults({});
    setRunLog([]);
    setShowLog(true);
    setActiveNodeId(null);

    const resp = await authFetch(`/api/ai-workflow/${savedId}/execute`, { method: "POST" });
    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();

    const read = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split("\n").filter(l => l.startsWith("data: "));
        for (const line of lines) {
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === "node_start") setActiveNodeId(evt.nodeId);
            if (evt.type === "node_done") {
              setActiveNodeId(null);
              setDoneNodes(prev => new Set([...prev, evt.nodeId]));
              setNodeResults(prev => ({ ...prev, [evt.nodeId]: evt.result }));
              setRunLog(prev => [...prev, evt]);
            }
            if (evt.type === "done") setIsRunning(false);
            if (evt.type === "error") { toast({ title: "خطأ", description: evt.message, variant: "destructive" }); setIsRunning(false); }
          } catch {}
        }
      }
      setIsRunning(false);
    };
    read();
    es.close();
  }, [savedId, toast]);

  /* ── drag node on canvas ── */
  const handleDragNode = useCallback((id: string, dx: number, dy: number) => {
    setGraph((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        nodes: prev.nodes.map((n: any) =>
          n.id === id ? { ...n, x: Math.max(10, n.x + dx), y: Math.max(10, n.y + dy) } : n
        ),
      };
    });
  }, []);

  /* ── load saved ── */
  const loadSaved = useCallback(async (wf: any) => {
    const r = await fetch(`/api/ai-workflow/${wf.id}`);
    const data = await r.json();
    setGraph(data.graph_json);
    setSavedId(data.id);
    setPrompt(data.prompt ?? "");
    setDoneNodes(new Set());
    setNodeResults({});
    setRunLog([]);
  }, []);

  const canGenerate = prompt.trim().length > 5 && !generateMut.isPending;

  /* ── Access guard ── */
  if (accessLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }
  if (!access?.allowed) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5 py-24" dir="rtl">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
          <ShieldOff className="h-8 w-8 text-red-400" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-black text-gray-800">لا تملك صلاحية الوصول</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-sm">
            هذه الأداة متاحة للسوبر أدمن والمطور فقط. تواصل مع مالك المنصة للحصول على الصلاحية.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 border border-amber-200">
          <Lock size={13} className="text-amber-500" />
          <span className="text-xs text-amber-700 font-medium">AI Workflow Builder — Super Admin Only</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#F0F4FF]" dir="rtl">

      {/* ═══ TOP BAR ════════════════════════════════════════════════ */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <GitBranch size={16} color="white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900">بناء سير العمل الذكي</h1>
            <p className="text-[10px] text-gray-500">AI يبني ويُنفّذ الـ Workflow بنفسه</p>
          </div>
        </div>

        <div className="flex-1" />

        {/* stats */}
        <div className="hidden md:flex items-center gap-4 text-xs text-gray-500">
          <span><BarChart3 size={11} className="inline ml-1" />{saved.length} workflow محفوظ</span>
          {graph && <span><List size={11} className="inline ml-1" />{graph.nodes?.length ?? 0} عقدة</span>}
        </div>

        {graph && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              <span className="mr-1 hidden sm:inline">حفظ</span>
            </Button>
            <Button
              size="sm"
              onClick={executeWorkflow}
              disabled={isRunning || !savedId}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0"
            >
              {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
              <span className="mr-1 hidden sm:inline">{isRunning ? "جاري التنفيذ…" : "تشغيل"}</span>
            </Button>
          </div>
        )}
      </div>

      {/* ═══ BODY ════════════════════════════════════════════════════ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT PANEL ──────────────────────────────────────────── */}
        <div className="w-72 flex-shrink-0 flex flex-col bg-white border-l border-gray-100 shadow-sm">

          {/* tabs */}
          <div className="flex border-b border-gray-100">
            {(["prompt", "saved"] as const).map(tab => (
              <button key={tab} onClick={() => setLeftPanel(tab)}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors
                  ${leftPanel === tab ? "text-indigo-600 border-b-2 border-indigo-500" : "text-gray-500 hover:text-gray-700"}`}
              >
                {tab === "prompt" ? <><Wand2 size={11} className="inline ml-1" />إنشاء جديد</> : <><History size={11} className="inline ml-1" />المحفوظة ({saved.length})</>}
              </button>
            ))}
          </div>

          {leftPanel === "prompt" ? (
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
              {/* prompt input */}
              <div>
                <label className="text-[11px] font-semibold text-gray-600 mb-1 block">صف ما تريد تنفيذه</label>
                <Textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="مثال: أريد workflow يتابع القضية من استلام الطلب حتى صدور الحكم، مع إشعارات تلقائية للموكل"
                  className="text-xs resize-none border-gray-200 focus:border-indigo-400"
                  rows={5}
                  dir="rtl"
                />
              </div>

              <Button
                onClick={() => generateMut.mutate(prompt)}
                disabled={!canGenerate}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0 text-xs h-9"
              >
                {generateMut.isPending
                  ? <><Loader2 size={13} className="animate-spin ml-2" />الذكاء الاصطناعي يبني…</>
                  : <><Sparkles size={13} className="ml-2" />توليد بالذكاء الاصطناعي</>
                }
              </Button>

              {/* quick templates */}
              <div>
                <p className="text-[10px] font-semibold text-gray-500 mb-2">قوالب سريعة</p>
                <div className="flex flex-col gap-1.5">
                  {TEMPLATES.map(t => (
                    <button key={t.label} onClick={() => setPrompt(t.prompt)}
                      className="text-right text-[11px] px-2.5 py-2 rounded-lg bg-gray-50 hover:bg-indigo-50 hover:text-indigo-700 text-gray-700 border border-gray-100 hover:border-indigo-200 transition-all flex items-center gap-1.5"
                    >
                      <ArrowRight size={10} className="text-indigo-400 flex-shrink-0" />{t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* graph info */}
              {graph && (
                <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-3">
                  <p className="text-xs font-bold text-indigo-700">{graph.name}</p>
                  <p className="text-[10px] text-indigo-600 mt-0.5">{graph.description}</p>
                  <div className="flex gap-3 mt-2 text-[10px] text-indigo-500">
                    <span>{graph.nodes?.length} عقدة</span>
                    <span>{graph.edges?.length} رابط</span>
                  </div>
                  {!savedId && (
                    <p className="text-[10px] text-amber-600 mt-2 flex items-center gap-1">
                      <AlertTriangle size={9} />احفظ لتتمكن من التشغيل
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
              {saved.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <GitBranch size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs">لا توجد workflows محفوظة</p>
                </div>
              ) : saved.map((wf: any) => (
                <SavedCard
                  key={wf.id}
                  wf={wf}
                  onLoad={() => { loadSaved(wf); setLeftPanel("prompt"); }}
                  onDelete={() => deleteMut.mutate(wf.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── CENTER CANVAS ────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {graph ? (
            <div className="flex-1 overflow-auto p-4 bg-[#F0F4FF]"
              style={{
                backgroundImage: "radial-gradient(circle, #c7d2fe 1px, transparent 1px)",
                backgroundSize: "24px 24px"
              }}
            >
              <WorkflowCanvas
                graph={graph}
                activeNodeId={activeNodeId}
                doneNodes={doneNodes}
                nodeResults={nodeResults}
                onDragNode={handleDragNode}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-8"
              style={{
                backgroundImage: "radial-gradient(circle, #c7d2fe 1px, transparent 1px)",
                backgroundSize: "24px 24px"
              }}
            >
              <div>
                <div className="w-24 h-24 rounded-3xl bg-white shadow-xl border border-indigo-100 flex items-center justify-center mx-auto mb-6">
                  <GitBranch size={40} className="text-indigo-300" />
                </div>
                <h2 className="text-xl font-bold text-gray-700 mb-2">ابدأ بوصف مهمتك</h2>
                <p className="text-sm text-gray-500 max-w-md">
                  اكتب ما تريد تنفيذه بالعربية في الخانة اليسرى،<br />
                  والذكاء الاصطناعي سيبني لك الـ Workflow هنا تلقائياً
                </p>
                <div className="flex items-center justify-center gap-6 mt-8 text-xs text-gray-400">
                  {Object.entries(NODE_TYPES).slice(0, 5).map(([k, v]) => {
                    const I = v.icon;
                    return (
                      <div key={k} className="flex flex-col items-center gap-1">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: v.bg }}>
                          <I size={16} style={{ color: v.color }} />
                        </div>
                        <span>{v.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── RUN LOG PANEL ── */}
          {showLog && (
            <div className="border-t border-gray-200 bg-gray-900 text-green-400 font-mono text-xs overflow-y-auto"
              style={{ maxHeight: 200, minHeight: 120 }}
            >
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-700">
                <span className="text-gray-300 text-[10px]">
                  <span className={isRunning ? "text-yellow-400" : "text-green-400"}>
                    {isRunning ? "● جاري التنفيذ" : "● اكتمل"}
                  </span>
                  <span className="mr-3 text-gray-500">{runLog.length} خطوة منجزة</span>
                </span>
                <button onClick={() => setShowLog(false)} className="text-gray-500 hover:text-gray-300"><X size={12} /></button>
              </div>
              <div className="p-3 flex flex-col gap-1.5">
                {runLog.length === 0 && isRunning && (
                  <span className="text-gray-500 animate-pulse">⏳ انتظار بدء العقدة الأولى…</span>
                )}
                {runLog.map((log, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-gray-600 flex-shrink-0">{i + 1}.</span>
                    <span className="text-yellow-300">[{log.title}]</span>
                    <span className="text-green-400">{log.result}</span>
                  </div>
                ))}
                {isRunning && <span className="text-indigo-400 animate-pulse">▌</span>}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT NODE LEGEND ────────────────────────────────────── */}
        <div className="w-44 flex-shrink-0 bg-white border-r border-gray-100 p-3 hidden lg:block">
          <p className="text-[10px] font-bold text-gray-500 mb-3">أنواع العقد</p>
          <div className="flex flex-col gap-2">
            {Object.entries(NODE_TYPES).map(([k, v]) => {
              const I = v.icon;
              return (
                <div key={k} className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: v.bg }}>
                    <I size={12} style={{ color: v.color }} />
                  </div>
                  <span className="text-[10px] text-gray-600">{v.label}</span>
                </div>
              );
            })}
          </div>

          {graph && (
            <div className="mt-6">
              <p className="text-[10px] font-bold text-gray-500 mb-2">تقدم التنفيذ</p>
              <div className="flex flex-col gap-1">
                {(graph.nodes ?? []).map((n: any) => {
                  const cfg = NODE_TYPES[n.type] ?? NODE_TYPES.action;
                  const done = doneNodes.has(n.id);
                  const active = activeNodeId === n.id;
                  return (
                    <div key={n.id} className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${active ? "bg-indigo-400 animate-pulse" : done ? "bg-emerald-400" : "bg-gray-200"}`} />
                      <span className="text-[9px] text-gray-500 truncate">{n.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
