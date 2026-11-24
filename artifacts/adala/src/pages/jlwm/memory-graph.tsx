/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps -- pre-existing lint debt; authFetch migration */
import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Network, Search, RefreshCw, Sparkles, ZoomIn, ZoomOut,
  Info, X, Filter, BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { GraphData, MemoryNode, MemoryEdge } from "@/types/jlwm";
import { authFetch } from "@/lib/authFetch";

/* ── Node type config ────────────────────────────────────── */
const NODE_TYPES: Record<string, { color: string; emoji: string; label: string }> = {
  case:     { color: "#6366F1", emoji: "⚖️", label: "قضية" },
  client:   { color: "#0EA5E9", emoji: "👤", label: "عميل" },
  lawyer:   { color: "#8B5CF6", emoji: "🧑‍⚖️", label: "محامي" },
  court:    { color: "#F59E0B", emoji: "🏛️", label: "محكمة" },
  judge:    { color: "#EF4444", emoji: "👨‍⚖️", label: "قاضي" },
  opponent: { color: "#EC4899", emoji: "🆚", label: "خصم" },
  contract: { color: "#10B981", emoji: "📄", label: "عقد" },
  law:      { color: "#F97316", emoji: "📚", label: "قانون" },
};
const DEFAULT_TYPE = { color: "#94A3B8", emoji: "•", label: "أخرى" };

/* ── Simple force-directed layout (no D3) ───────────────── */
interface NodePos { id: string; x: number; y: number; vx: number; vy: number }

function useForceLayout(nodes: MemoryNode[], edges: MemoryEdge[], width: number, height: number) {
  const [positions, setPositions] = useState<Record<string, NodePos>>({});

  useEffect(() => {
    if (!nodes.length) return;

    /* Initialize positions in a spiral */
    const pos: Record<string, NodePos> = {};
    nodes.forEach((n, i) => {
      const angle  = (i / nodes.length) * 2 * Math.PI;
      const radius = Math.min(width, height) * 0.32;
      pos[n.id] = {
        id: n.id,
        x: width / 2 + radius * Math.cos(angle),
        y: height / 2 + radius * Math.sin(angle),
        vx: 0, vy: 0,
      };
    });

    let frame = 0;
    const MAX = 80;

    const simulate = () => {
      if (frame >= MAX) { setPositions({ ...pos }); return; }
      frame++;

      /* Repulsion */
      const nodeArr = Object.values(pos);
      for (let i = 0; i < nodeArr.length; i++) {
        for (let j = i + 1; j < nodeArr.length; j++) {
          const a = nodeArr[i], b = nodeArr[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = 2400 / (dist * dist);
          const fx = (dx / dist) * force, fy = (dy / dist) * force;
          a.vx -= fx; a.vy -= fy;
          b.vx += fx; b.vy += fy;
        }
      }

      /* Attraction along edges */
      edges.forEach(e => {
        const a = pos[e.from_node_id], b = pos[e.to_node_id];
        if (!a || !b) return;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const target = 100 + e.weight * 40;
        const force  = (dist - target) * 0.05;
        const fx = (dx / dist) * force, fy = (dy / dist) * force;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      });

      /* Center gravity */
      nodeArr.forEach(n => {
        n.vx += (width / 2 - n.x) * 0.01;
        n.vy += (height / 2 - n.y) * 0.01;
        n.vx *= 0.85;
        n.vy *= 0.85;
        n.x = Math.max(40, Math.min(width - 40, n.x + n.vx));
        n.y = Math.max(40, Math.min(height - 40, n.y + n.vy));
      });

      if (frame % 10 === 0) setPositions({ ...pos });
      requestAnimationFrame(simulate);
    };

    requestAnimationFrame(simulate);
  }, [nodes.length, edges.length, width, height]);  

  return positions;
}

/* ── Main Component ──────────────────────────────────────── */
export default function MemoryGraphPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch]     = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [selected, setSelected] = useState<MemoryNode | null>(null);
  const [zoom, setZoom]         = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dims, setDims]         = useState({ w: 800, h: 520 });

  useEffect(() => {
    if (!canvasRef.current) return;
    const ro = new ResizeObserver(e => {
      const r = e[0]?.contentRect;
      if (r) setDims({ w: r.width, h: Math.max(r.height, 400) });
    });
    ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, []);

  const { data: graph, isLoading } = useQuery<GraphData>({
    queryKey: ["jlwm", "memory-graph", typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "150" });
      if (typeFilter) params.set("type", typeFilter);
      const r = await authFetch(`/api/jlwm/memory/graph?${params}`);
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    staleTime: 120_000,
  });

  const { data: stats } = useQuery({
    queryKey: ["jlwm", "memory-stats"],
    queryFn: async () => {
      const r = await authFetch("/api/jlwm/memory/stats");
      if (!r.ok) return null;
      return r.json();
    },
  });

  const rebuildMut = useMutation({
    mutationFn: async () => {
      const r = await authFetch("/api/jlwm/memory/rebuild", { method: "POST" });
      if (!r.ok) throw new Error("فشل");
      return r.json();
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["jlwm", "memory"] });
      toast({ title: `تم إعادة البناء: ${d.nodesCreated} عقدة، ${d.edgesCreated} علاقة` });
    },
    onError: () => toast({ title: "فشل إعادة البناء", variant: "destructive" }),
  });

  const analyzeMut = useMutation({
    mutationFn: async () => {
      const r = await authFetch("/api/jlwm/memory/analyze", { method: "POST" });
      if (!r.ok) throw new Error("فشل");
      return r.json();
    },
    onSuccess: (d) => toast({ title: "تحليل الذكاء الاصطناعي", description: d.analysis?.slice(0, 200) }),
    onError: () => toast({ title: "فشل التحليل", variant: "destructive" }),
  });

  /* Filter nodes by search */
  const displayNodes = (graph?.nodes ?? []).filter(n =>
    !search || n.label.includes(search) || n.node_type.includes(search)
  );
  const displayEdges = (graph?.edges ?? []).filter(e =>
    displayNodes.some(n => n.id === e.from_node_id) &&
    displayNodes.some(n => n.id === e.to_node_id)
  );

  const positions = useForceLayout(displayNodes, displayEdges, dims.w, dims.h);

  return (
    <div className="space-y-4 p-4 md:p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Network className="h-6 w-6 text-purple-500" /> مخطط الذاكرة القانونية
          </h1>
          <p className="text-muted-foreground text-sm">
            {(stats?.totals as any)?.total_nodes ?? 0} عقدة ·{" "}
            {(stats?.totals as any)?.total_edges ?? 0} علاقة
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => rebuildMut.mutate()} disabled={rebuildMut.isPending}>
            <RefreshCw className="h-4 w-4 me-1" /> {rebuildMut.isPending ? "جارٍ…" : "إعادة البناء"}
          </Button>
          <Button size="sm" onClick={() => analyzeMut.mutate()} disabled={analyzeMut.isPending}>
            <Sparkles className="h-4 w-4 me-1" /> {analyzeMut.isPending ? "جارٍ التحليل…" : "تحليل AI"}
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex gap-2 flex-wrap">
        {(stats?.byType ?? []).map((t: any) => {
          const cfg = NODE_TYPES[t.node_type] ?? DEFAULT_TYPE;
          return (
            <button key={t.node_type}
              onClick={() => setTypeFilter(typeFilter === t.node_type ? "" : t.node_type)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                typeFilter === t.node_type ? "text-white border-transparent" : "bg-muted/50 border-border hover:bg-muted"
              }`}
              style={typeFilter === t.node_type ? { background: cfg.color, borderColor: cfg.color } : {}}>
              <span>{cfg.emoji}</span>
              <span>{cfg.label}</span>
              <span className={`rounded-full px-1.5 py-0.5 ${typeFilter === t.node_type ? "bg-white/20" : "bg-muted"}`}>
                {t.count}
              </span>
            </button>
          );
        })}
        {typeFilter && (
          <button onClick={() => setTypeFilter("")} className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" /> إلغاء الفلتر
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="ابحث في العقد…" className="pr-9 h-8 text-sm" />
      </div>

      {/* Graph Canvas */}
      <Card className="overflow-hidden">
        <div ref={canvasRef} className="relative bg-muted/20 rounded-lg" style={{ height: 520 }}>
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Network className="h-12 w-12 text-purple-400 animate-pulse" />
            </div>
          ) : displayNodes.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Network className="h-12 w-12" />
              <p>لا توجد عقد — اضغط "إعادة البناء" لبناء المخطط</p>
            </div>
          ) : (
            <svg
              width={dims.w} height={dims.h}
              style={{ transform: `scale(${zoom})`, transformOrigin: "center center", transition: "transform 0.2s" }}
              onClick={() => setSelected(null)}
            >
              {/* Edges */}
              {displayEdges.map(edge => {
                const from = positions[edge.from_node_id];
                const to   = positions[edge.to_node_id];
                if (!from || !to) return null;
                return (
                  <line key={edge.id}
                    x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                    stroke="#CBD5E1" strokeWidth={edge.weight * 2}
                    strokeOpacity={0.6} strokeDasharray={edge.edge_type === "opposed_by" ? "5,3" : undefined}
                  />
                );
              })}
              {/* Nodes */}
              {displayNodes.map(node => {
                const pos = positions[node.id];
                if (!pos) return null;
                const cfg    = NODE_TYPES[node.node_type] ?? DEFAULT_TYPE;
                const radius = 18 + node.importance_score * 10;
                const isSelected = selected?.id === node.id;
                return (
                  <g key={node.id}
                    onClick={e => { e.stopPropagation(); setSelected(node); }}
                    style={{ cursor: "pointer" }}
                  >
                    <circle cx={pos.x} cy={pos.y} r={radius + 4} fill={cfg.color} opacity={0.15} />
                    <circle cx={pos.x} cy={pos.y} r={radius}
                      fill={cfg.color} opacity={0.9}
                      stroke={isSelected ? "#1e293b" : "white"} strokeWidth={isSelected ? 3 : 1.5}
                    />
                    <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle"
                      fontSize={radius * 0.7} style={{ userSelect: "none" }}>
                      {cfg.emoji}
                    </text>
                    <text x={pos.x} y={pos.y + radius + 12} textAnchor="middle"
                      fontSize="10" fill="#475569" style={{ userSelect: "none" }}>
                      {node.label.length > 12 ? node.label.slice(0, 12) + "…" : node.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}

          {/* Zoom controls */}
          <div className="absolute bottom-3 left-3 flex flex-col gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.min(z + 0.2, 2))}>
              <ZoomIn className="h-3 w-3" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.max(z - 0.2, 0.4))}>
              <ZoomOut className="h-3 w-3" />
            </Button>
          </div>

          {/* Selected node panel */}
          {selected && (
            <div className="absolute top-3 right-3 w-64 bg-background/95 backdrop-blur rounded-xl border shadow-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{(NODE_TYPES[selected.node_type] ?? DEFAULT_TYPE).emoji}</span>
                  <Badge variant="outline" className="text-xs">
                    {(NODE_TYPES[selected.node_type] ?? DEFAULT_TYPE).label}
                  </Badge>
                </div>
                <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="font-medium text-sm">{selected.label}</p>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>الأهمية</span>
                  <span>{(selected.importance_score * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>المصدر</span>
                  <span>{selected.is_auto ? "تلقائي" : "يدوي"}</span>
                </div>
                {Object.entries(selected.properties ?? {}).slice(0, 3).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span>{k}</span>
                    <span className="truncate max-w-24">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Edge types legend */}
      <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1"><span className="w-6 h-px bg-slate-400 inline-block" /> علاقة عادية</span>
        <span className="flex items-center gap-1"><span className="w-6 h-px border-t-2 border-dashed border-slate-400 inline-block" /> تعارض/خصومة</span>
      </div>
    </div>
  );
}
