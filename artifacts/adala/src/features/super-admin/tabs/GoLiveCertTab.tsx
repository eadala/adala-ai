/**
 * 🏆 Go-Live Certification Tab — شهادة الإطلاق النهائي
 * ──────────────────────────────────────────────────────
 * تقييم موزون 6 محاور + بوابة GO/CONDITIONAL/NO-GO +
 * إصدار شهادة رسمية + Governance Kernel controls.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ShieldCheck, AlertTriangle, XCircle, RefreshCw,
  Award, Lock, Unlock, CheckCircle2, Rocket,
  Activity, Database, Cpu, Bot, Eye,
} from "lucide-react";

/* ── helpers ──────────────────────────────────────────────────────── */
const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

let _getToken: (() => Promise<string | null>) | null = null;
export function setCertTokenGetter(fn: () => Promise<string | null>) { _getToken = fn; }

async function certFetch(path: string, method = "GET", body?: any) {
  const token = _getToken ? await _getToken() : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ── Score Ring ─────────────────────────────────────────────────── */
function ScoreRing({ score, status }: { score: number; status: string }) {
  const color =
    status === "GO"             ? "#10B981" :
    status === "CONDITIONAL_GO" ? "#F59E0B" : "#EF4444";
  const r = 56, c = 2 * Math.PI * r;
  const dash = c - (score / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="140" height="140" viewBox="0 0 140 140" className="rotate-[-90deg]">
        <circle cx="70" cy="70" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
        <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={c} strokeDashoffset={dash} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <div className="absolute text-center">
        <p className="text-4xl font-bold" style={{ color }}>{score}</p>
        <p className="text-xs text-muted-foreground">/ 100</p>
      </div>
    </div>
  );
}

/* ── Axis icons ─────────────────────────────────────────────────── */
const AXIS_META: Record<string, { label: string; icon: any; color: string }> = {
  identity:      { label: "هوية المستأجر (TIRE)", icon: ShieldCheck, color: "#3B82F6" },
  security:      { label: "الأمان والعزل (RBAC)",  icon: Lock,        color: "#EF4444" },
  stability:     { label: "الاستقرار",              icon: Activity,    color: "#10B981" },
  automation:    { label: "الأتمتة (AOL)",          icon: Cpu,         color: "#8B5CF6" },
  observability: { label: "المراقبة",               icon: Eye,         color: "#F59E0B" },
  dataSafety:    { label: "سلامة البيانات",         icon: Database,    color: "#06B6D4" },
};

const WEIGHT_PCT: Record<string, string> = {
  identity: "20%", security: "20%", stability: "15%",
  automation: "15%", observability: "15%", dataSafety: "15%",
};

const GOV_STATES = [
  { v: "NORMAL",      label: "طبيعي",   color: "bg-emerald-100 text-emerald-800" },
  { v: "STRICT",      label: "صارم",    color: "bg-blue-100 text-blue-800"      },
  { v: "RECOVERY",    label: "استعادة", color: "bg-amber-100 text-amber-800"    },
  { v: "MAINTENANCE", label: "صيانة",   color: "bg-orange-100 text-orange-800"  },
  { v: "LOCKED",      label: "مقفل",    color: "bg-red-100 text-red-800"        },
];

/* ── Main Component ─────────────────────────────────────────────── */
export function GoLiveCertTab({
  toast, getToken,
}: {
  toast: any;
  getToken?: () => Promise<string | null>;
}) {
  if (getToken) setCertTokenGetter(getToken);
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [stateLoading, setStateLoading] = useState<string | null>(null);

  const { data: score, isLoading: scoreLoading, refetch: refetchScore } = useQuery({
    queryKey: ["cert", "score"],
    queryFn: () => certFetch("/certification/score"),
    refetchInterval: 30_000,
  });

  const { data: latest } = useQuery({
    queryKey: ["cert", "latest"],
    queryFn: () => certFetch("/certification/latest"),
    refetchInterval: 60_000,
  });

  const { data: govInfo } = useQuery({
    queryKey: ["cert", "gov-state"],
    queryFn: () => certFetch("/certification/gov-state"),
    refetchInterval: 15_000,
  });

  const { data: govLog = [] } = useQuery({
    queryKey: ["cert", "gov-log"],
    queryFn: () => certFetch("/certification/gov-log"),
    refetchInterval: 30_000,
  });

  const total  = score?.total  ?? 0;
  const status = score?.status ?? "NO_GO";
  const risk   = score?.risk   ?? "HIGH";
  const axes   = score?.axes   ?? {};
  const blockers: string[] = score?.blockers ?? [];

  const statusAr  = status === "GO" ? "جاهز للإطلاق" : status === "CONDITIONAL_GO" ? "إطلاق مشروط" : "غير جاهز";
  const statusColor = status === "GO" ? "bg-emerald-100 text-emerald-800 border-emerald-200"
    : status === "CONDITIONAL_GO"     ? "bg-amber-100 text-amber-800 border-amber-200"
    :                                   "bg-red-100 text-red-800 border-red-200";
  const riskAr    = risk === "LOW" ? "منخفضة" : risk === "MEDIUM" ? "متوسطة" : "عالية";

  async function handleGenerate() {
    setGenerating(true);
    try {
      const r = await certFetch("/certification/generate", "POST");
      qc.invalidateQueries({ queryKey: ["cert"] });
      toast({
        title: r.certificateId ? `✅ شهادة مُصدرة: ${r.certificateId}` : "خطأ",
        description: r.message ?? `النتيجة: ${r.score}/100 — ${r.status}`,
      });
    } catch (err: any) {
      toast({ title: "فشل إصدار الشهادة", description: err.message, variant: "destructive" });
    }
    setGenerating(false);
  }

  async function handleGovState(state: string) {
    setStateLoading(state);
    try {
      await certFetch("/certification/gov-state", "POST", { state });
      qc.invalidateQueries({ queryKey: ["cert"] });
      toast({ title: `تم تغيير الحالة إلى ${state}` });
    } catch {
      toast({ title: "خطأ", variant: "destructive" });
    }
    setStateLoading(null);
  }

  return (
    <div className="space-y-5" dir="rtl">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold">شهادة الإطلاق النهائي</h2>
          <Badge variant="outline" className="text-xs">Production Certification</Badge>
        </div>
        <Button size="sm" variant="outline" onClick={() => { refetchScore(); qc.invalidateQueries({ queryKey: ["cert"] }); }}>
          <RefreshCw className="h-3 w-3 ml-1" /> تحديث
        </Button>
      </div>

      {/* ── Score + Verdict ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="flex flex-col items-center justify-center p-6">
          {scoreLoading
            ? <div className="text-sm text-muted-foreground py-8">جاري الحساب…</div>
            : <>
              <ScoreRing score={total} status={status} />
              <div className={`mt-3 px-4 py-1.5 rounded-full border text-sm font-bold ${statusColor}`}>
                {status === "GO" ? "🟢" : status === "CONDITIONAL_GO" ? "🟡" : "🔴"} {statusAr}
              </div>
              <p className="text-xs text-muted-foreground mt-1">مخاطرة: {riskAr}</p>
            </>}
        </Card>

        {/* Axes summary */}
        <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Object.entries(axes).map(([key, ax]: [string, any]) => {
            const meta = AXIS_META[key] ?? { label: key, icon: Activity, color: "#6B7280" };
            const Icon = meta.icon;
            const axColor = ax.score >= 90 ? "#10B981" : ax.score >= 70 ? "#F59E0B" : "#EF4444";
            return (
              <Card key={key} className="p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon className="h-3.5 w-3.5" style={{ color: meta.color }} />
                  <span className="text-[11px] text-muted-foreground truncate">{meta.label}</span>
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-xl font-bold" style={{ color: axColor }}>{ax.score}</span>
                  <span className="text-xs text-muted-foreground mb-0.5">/{WEIGHT_PCT[key]}</span>
                </div>
                <div className="h-1 rounded-full bg-muted mt-1 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${ax.score}%`, background: axColor, transition: "width 0.8s ease" }} />
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── Blockers ── */}
      {blockers.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-red-700 flex items-center gap-2">
            <XCircle className="h-4 w-4" /> موانع الإطلاق ({blockers.length})
          </p>
          {blockers.map((b, i) => (
            <div key={i} className="flex items-center gap-2 p-3 rounded-lg border border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-800">{b}</p>
            </div>
          ))}
        </div>
      )}
      {!scoreLoading && blockers.length === 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          <p className="text-sm font-medium">لا موانع — النظام مؤهل للإطلاق</p>
        </div>
      )}

      {/* ── Generate Certificate ── */}
      <Card className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="font-semibold">إصدار شهادة إطلاق رسمية</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              تُصدر شهادة بـ Certificate ID صالحة 7 أيام — مطلوبة قبل الإطلاق التجاري
            </p>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={generating || status === "NO_GO"}
            className={status === "GO" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
          >
            {generating
              ? <RefreshCw className="h-4 w-4 animate-spin ml-2" />
              : <Rocket className="h-4 w-4 ml-2" />}
            {generating ? "جاري الإصدار…" : "إصدار الشهادة"}
          </Button>
        </div>

        {latest && (
          <div className="mt-4 p-3 rounded-lg border bg-muted/30">
            <p className="text-xs text-muted-foreground mb-2">آخر شهادة مُصدرة:</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div><span className="text-muted-foreground">ID: </span><span className="font-mono font-bold">{latest.certificate_id}</span></div>
              <div><span className="text-muted-foreground">النتيجة: </span><span className="font-bold">{latest.score}/100</span></div>
              <div><span className="text-muted-foreground">الحالة: </span>
                <span className={`font-bold ${latest.status === "GO" ? "text-emerald-600" : latest.status === "CONDITIONAL_GO" ? "text-amber-600" : "text-red-600"}`}>
                  {latest.status}
                </span>
              </div>
              <div><span className="text-muted-foreground">صالحة حتى: </span><span>{new Date(latest.valid_until).toLocaleDateString("ar-SA")}</span></div>
            </div>
          </div>
        )}
      </Card>

      <Tabs defaultValue="checks">
        <TabsList>
          <TabsTrigger value="checks">فحوصات المحاور</TabsTrigger>
          <TabsTrigger value="governance">نواة الحوكمة</TabsTrigger>
          <TabsTrigger value="gov-log">سجل الحوكمة</TabsTrigger>
        </TabsList>

        {/* ── Axis Checks ── */}
        <TabsContent value="checks">
          <div className="space-y-4 pt-3">
            {Object.entries(axes).map(([key, ax]: [string, any]) => {
              const meta = AXIS_META[key] ?? { label: key, icon: Activity, color: "#6B7280" };
              const Icon = meta.icon;
              return (
                <Card key={key}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Icon className="h-4 w-4" style={{ color: meta.color }} />
                      {meta.label}
                      <span className="mr-auto text-base font-bold" style={{ color: ax.score >= 90 ? "#10B981" : ax.score >= 70 ? "#F59E0B" : "#EF4444" }}>{ax.score}/100</span>
                      <span className="text-xs text-muted-foreground font-normal">وزن: {WEIGHT_PCT[key]}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {(ax.checks ?? []).map((c: any, i: number) => (
                        <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                          c.passed ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
                        }`}>
                          {c.passed
                            ? <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                            : <XCircle     className="h-3.5 w-3.5 flex-shrink-0 text-red-500"     />}
                          <span className="flex-1">{c.label}</span>
                          <span className="text-xs opacity-70">{c.detail}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ── Governance Kernel Controls ── */}
        <TabsContent value="governance">
          <div className="pt-3 space-y-4">
            {govInfo && (
              <Card className="p-4">
                <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Bot className="h-4 w-4 text-purple-500" />
                  حالة نواة الحوكمة
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {[
                    { label: "Gov State",      value: govInfo.govState,    highlight: govInfo.govState !== "NORMAL" },
                    { label: "System Mode",    value: govInfo.systemMode,  highlight: govInfo.systemMode !== "stable" },
                    { label: "AI Lock",        value: govInfo.aiLock ? "مقفل" : "مفتوح", highlight: govInfo.aiLock },
                    { label: "Queue Size",     value: govInfo.queueSize,   highlight: govInfo.queueSize > 0 },
                    { label: "Recovery",       value: govInfo.recoveryRunning ? "جارية" : "لا", highlight: govInfo.recoveryRunning },
                    { label: "Prod Mode",      value: govInfo.productionMode ? "✓" : "✗", highlight: !govInfo.productionMode },
                  ].map(item => (
                    <div key={item.label} className={`p-2 rounded border ${item.highlight ? "border-amber-200 bg-amber-50" : "border-border bg-muted/20"}`}>
                      <p className="text-muted-foreground mb-0.5">{item.label}</p>
                      <p className="font-bold">{String(item.value)}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card className="p-4">
              <p className="text-sm font-semibold mb-3">تغيير حالة نواة الحوكمة</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {GOV_STATES.map(gs => (
                  <button key={gs.v}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all hover:opacity-80 disabled:opacity-40 ${
                      govInfo?.govState === gs.v
                        ? gs.color + " ring-2 ring-offset-1"
                        : "bg-muted/30 border-border text-foreground"
                    }`}
                    disabled={stateLoading !== null}
                    onClick={() => handleGovState(gs.v)}>
                    {stateLoading === gs.v ? <RefreshCw className="h-3 w-3 animate-spin inline ml-1" /> : null}
                    {gs.label} ({gs.v})
                  </button>
                ))}
              </div>
              <div className="mt-3 p-3 rounded bg-muted/30 text-xs text-muted-foreground">
                <p><strong>NORMAL</strong> — وضع طبيعي</p>
                <p><strong>STRICT</strong> — يمنع cache flush من غير ADMIN</p>
                <p><strong>RECOVERY</strong> — يمنع SCALE_UP وإصلاح مزدوج</p>
                <p><strong>MAINTENANCE</strong> — يمنع AI switch + SCALE_UP</p>
                <p><strong>LOCKED 🔴</strong> — يمنع جميع إجراءات Governance Queue</p>
              </div>
            </Card>

            {govInfo?.queue?.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">طابور الإجراءات المنتظرة</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">النوع</TableHead>
                        <TableHead className="text-right">المصدر</TableHead>
                        <TableHead className="text-right">الأولوية</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {govInfo.queue.map((a: any) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-mono text-xs">{a.type}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{a.source}</Badge></TableCell>
                          <TableCell className="text-xs">{a.priority}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── Governance Log ── */}
        <TabsContent value="gov-log">
          <div className="pt-3 rounded-md border overflow-auto max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الإجراء</TableHead>
                  <TableHead className="text-right">المصدر</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">الوقت</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(govLog as any[]).map((row: any) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.action_type}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{row.source}</Badge></TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        row.status === "success" ? "bg-emerald-100 text-emerald-800" :
                        row.status === "failed"  ? "bg-red-100 text-red-800"         :
                        row.status === "blocked" ? "bg-orange-100 text-orange-800"   :
                                                   "bg-muted text-muted-foreground"
                      }`}>{row.status}</span>
                    </TableCell>
                    <TableCell className="text-xs">{new Date(row.created_at).toLocaleString("ar-SA")}</TableCell>
                  </TableRow>
                ))}
                {!(govLog as any[]).length && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">لا سجلات بعد</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
