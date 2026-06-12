import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Scale, User, Clock, Calendar, FileText, Loader2, Edit2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const API = "/api";
const fetchJson = (path: string) => fetch(`${API}${path}`).then(r => r.json());

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  open:        { label: "مفتوحة",       color: "bg-blue-500/20 text-blue-300" },
  in_progress: { label: "قيد التنفيذ",  color: "bg-amber-500/20 text-amber-300" },
  closed:      { label: "مغلقة",        color: "bg-slate-500/20 text-slate-300" },
};
const TYPE_MAP: Record<string, string> = {
  civil: "مدني", criminal: "جنائي", commercial: "تجاري",
  family: "أسري", administrative: "إداري", labor: "عمالي", other: "أخرى",
};

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export default function CaseDetail({ id }: { id: string }) {
  const qc = useQueryClient();
  const [, nav] = useLocation();
  const [editStatus, setEditStatus] = useState(false);
  const [newStatus, setNewStatus] = useState("");

  const { data: caseData, isLoading } = useQuery<any>({
    queryKey: ["case-detail-mobile", id],
    queryFn: () => fetchJson(`/cases/${id}`),
    enabled: !!id,
  });

  const { data: hub } = useQuery<any>({
    queryKey: ["case-hub-mobile", id],
    queryFn: () => fetchJson(`/cases/${id}/hub`),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (status: string) =>
      fetch(`${API}/cases/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then(r => r.json()),
    onSuccess: (data) => {
      if (data?.error) { toast.error(data.error); return; }
      qc.invalidateQueries({ queryKey: ["case-detail-mobile", id] });
      qc.invalidateQueries({ queryKey: ["cases"] });
      setEditStatus(false);
      toast.success("تم تحديث حالة القضية");
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-full">
        <div className="bg-card border-b border-border px-5 pt-12 pb-4 safe-top flex items-center gap-3">
          <button onClick={() => nav("/cases")} className="w-9 h-9 rounded-2xl bg-muted flex items-center justify-center">
            <ArrowLeft size={16} className="text-foreground rotate-180" />
          </button>
          <Skeleton className="h-6 w-40 rounded-lg" />
        </div>
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!caseData || caseData.error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full gap-4 p-8" dir="rtl">
        <Scale size={40} className="text-muted-foreground opacity-30" />
        <p className="text-muted-foreground text-sm">القضية غير موجودة</p>
        <button onClick={() => nav("/cases")} className="text-primary text-sm font-semibold">
          ← العودة للقضايا
        </button>
      </div>
    );
  }

  const status = STATUS_MAP[caseData.status] ?? { label: caseData.status, color: "bg-muted text-muted-foreground" };

  return (
    <div className="flex flex-col min-h-full" dir="rtl">
      {/* Header */}
      <div className="bg-card border-b border-border px-5 pt-12 pb-4 safe-top">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => nav("/cases")} className="w-9 h-9 rounded-2xl bg-muted flex items-center justify-center tap-effect">
            <ArrowLeft size={16} className="text-foreground rotate-180" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-foreground truncate">{caseData.title}</h1>
            <p className="text-xs text-muted-foreground">{TYPE_MAP[caseData.caseType] ?? caseData.caseType}</p>
          </div>
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${status.color}`}>{status.label}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {/* Info Card */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-bold text-foreground">معلومات القضية</p>
          </div>
          <div className="divide-y divide-border">
            {caseData.clientName && (
              <div className="flex items-center gap-3 px-4 py-3">
                <User size={16} className="text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">الموكل</p>
                  <p className="text-sm text-foreground font-medium">{caseData.clientName}</p>
                </div>
              </div>
            )}
            {caseData.assignedTo && (
              <div className="flex items-center gap-3 px-4 py-3">
                <User size={16} className="text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">المحامي المسؤول</p>
                  <p className="text-sm text-foreground font-medium">{caseData.assignedTo}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 px-4 py-3">
              <Clock size={16} className="text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">تاريخ الإنشاء</p>
                <p className="text-sm text-foreground">{new Date(caseData.createdAt).toLocaleDateString("ar-SA")}</p>
              </div>
            </div>
            {caseData.description && (
              <div className="flex items-start gap-3 px-4 py-3">
                <FileText size={16} className="text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">الوصف</p>
                  <p className="text-sm text-foreground leading-relaxed">{caseData.description}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status Update */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-foreground">تحديث الحالة</p>
            {!editStatus && (
              <button onClick={() => { setNewStatus(caseData.status); setEditStatus(true); }}
                className="flex items-center gap-1 text-xs text-primary tap-effect">
                <Edit2 size={12} />تعديل
              </button>
            )}
          </div>
          {editStatus ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(STATUS_MAP).map(([val, info]) => (
                  <button
                    key={val}
                    onClick={() => setNewStatus(val)}
                    className={`py-2 rounded-xl text-xs font-medium transition ${newStatus === val ? info.color + " ring-1 ring-current" : "bg-muted text-muted-foreground"}`}
                  >
                    {info.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => updateMutation.mutate(newStatus)}
                  disabled={updateMutation.isPending || newStatus === caseData.status}
                  className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-bold disabled:opacity-40 tap-effect flex items-center justify-center gap-1"
                >
                  {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  حفظ
                </button>
                <button onClick={() => setEditStatus(false)} className="w-12 bg-muted text-muted-foreground rounded-xl py-2.5 tap-effect flex items-center justify-center">
                  <X size={14} />
                </button>
              </div>
            </div>
          ) : (
            <span className={`inline-block text-sm px-4 py-1.5 rounded-full font-medium ${status.color}`}>{status.label}</span>
          )}
        </div>

        {/* Stats */}
        {hub && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "فواتير", count: hub.invoices?.length ?? 0, color: "text-amber-400" },
              { label: "عقود", count: hub.contracts?.length ?? 0, color: "text-violet-400" },
              { label: "جلسات", count: hub.events?.length ?? 0, color: "text-emerald-400" },
            ].map(({ label, count, color }) => (
              <div key={label} className="bg-card rounded-2xl border border-border p-3 text-center">
                <p className={`text-2xl font-black ${color}`}>{count}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Invoices */}
        {hub?.invoices?.length > 0 && (
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-bold text-foreground">الفواتير ({hub.invoices.length})</p>
            </div>
            <div className="divide-y divide-border">
              {hub.invoices.slice(0, 5).map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm text-foreground">{inv.invoice_number ?? inv.id}</p>
                    <p className="text-xs text-muted-foreground">{inv.status}</p>
                  </div>
                  <p className="text-sm font-semibold text-amber-400">{((inv.total ?? 0) / 100).toLocaleString("ar-SA")} ر.س</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Events */}
        {hub?.events?.length > 0 && (
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-bold text-foreground">المواعيد ({hub.events.length})</p>
            </div>
            <div className="divide-y divide-border">
              {hub.events.slice(0, 5).map((ev: any) => (
                <div key={ev.id} className="flex items-center gap-3 px-4 py-3">
                  <Calendar size={16} className="text-emerald-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{ev.title}</p>
                    <p className="text-xs text-muted-foreground">{new Date(ev.start_at).toLocaleDateString("ar-SA")}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
}
