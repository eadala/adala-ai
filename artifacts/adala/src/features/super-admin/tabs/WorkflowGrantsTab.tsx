import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API } from "../shared/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  GitBranch, Plus, Trash2, CheckCircle2, XCircle,
  Building2, Shield, Clock, Search, AlertTriangle, Loader2
} from "lucide-react";

export function WorkflowGrantsTab({ toast }: { toast: any }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [grantOfficeId, setGrantOfficeId] = useState("");
  const [grantNotes, setGrantNotes] = useState("");

  /* ── All offices (to pick from) ── */
  const { data: offices = [] } = useQuery<any[]>({
    queryKey: ["admin", "/offices"],
    queryFn: () => API("/offices"),
  });

  /* ── Active grants ── */
  const { data: grants = [], isLoading } = useQuery<any[]>({
    queryKey: ["admin", "workflow-grants"],
    queryFn: () => API("/admin/workflow-grants"),
    refetchInterval: 30_000,
  });

  /* ── Grant ── */
  const grantMut = useMutation({
    mutationFn: (body: any) => API("/admin/workflow-grants", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "workflow-grants"] });
      setGrantOfficeId("");
      setGrantNotes("");
      toast({ title: "✅ تم منح الصلاحية" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  /* ── Revoke ── */
  const revokeMut = useMutation({
    mutationFn: (officeId: string) => API(`/admin/workflow-grants/${officeId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "workflow-grants"] });
      toast({ title: "🚫 تم سحب الصلاحية" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const grantedIds = new Set(grants.filter((g: any) => g.is_active).map((g: any) => g.office_id));
  const filteredOffices = offices.filter((o: any) =>
    o.name?.includes(search) || o.slug?.includes(search) || o.plan?.includes(search)
  );

  return (
    <div className="space-y-6" dir="rtl">

      {/* Header */}
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-l from-indigo-500/5 to-purple-500/5 border border-indigo-200/30">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
          <GitBranch className="h-5 w-5 text-indigo-500" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-900">صلاحيات AI Workflow Builder</h2>
          <p className="text-xs text-gray-500">تحكم كامل — من يصل وإلى أي مكتب</p>
        </div>
        <div className="mr-auto flex gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 font-medium">
            <CheckCircle2 size={10} className="inline ml-1" />
            {grants.filter((g: any) => g.is_active).length} مكتب مصرّح
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 font-medium">
            <Shield size={10} className="inline ml-1" />
            السوبر أدمن دائماً ✓
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── LEFT: Grant form + office list ── */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">منح صلاحية لمكتب</h3>

          {/* Search offices */}
          <div className="relative">
            <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full pr-8 pl-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400"
              placeholder="ابحث عن مكتب…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Office list */}
          <div className="border border-gray-100 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
            {filteredOffices.slice(0, 30).map((o: any) => {
              const isGranted = grantedIds.has(o.id);
              return (
                <div key={o.id}
                  className={`flex items-center gap-3 px-3 py-2.5 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer
                    ${grantOfficeId === o.id ? "bg-indigo-50 border-indigo-200" : ""}`}
                  onClick={() => setGrantOfficeId(o.id)}
                >
                  <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Building2 size={13} className="text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{o.name}</p>
                    <p className="text-[10px] text-gray-400">{o.slug} · {o.plan}</p>
                  </div>
                  {isGranted
                    ? <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                    : <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-200 flex-shrink-0" />
                  }
                </div>
              );
            })}
            {filteredOffices.length === 0 && (
              <div className="py-8 text-center text-xs text-gray-400">لا توجد نتائج</div>
            )}
          </div>

          {/* Grant form */}
          {grantOfficeId && (
            <div className="p-3 rounded-xl border border-indigo-200 bg-indigo-50 space-y-3">
              <p className="text-xs font-semibold text-indigo-700">
                منح لـ: {offices.find(o => o.id === grantOfficeId)?.name}
              </p>
              <input
                className="w-full px-3 py-1.5 text-xs border border-indigo-200 rounded-lg bg-white focus:outline-none focus:border-indigo-400"
                placeholder="ملاحظة (اختياري)"
                value={grantNotes}
                onChange={e => setGrantNotes(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-7"
                  onClick={() => grantMut.mutate({ office_id: grantOfficeId, notes: grantNotes })}
                  disabled={grantMut.isPending}
                >
                  {grantMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                  <span className="mr-1">منح الصلاحية</span>
                </Button>
                <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setGrantOfficeId("")}>
                  إلغاء
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Active grants ── */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">المكاتب المصرّح لها</h3>

          {isLoading ? (
            <div className="py-12 flex items-center justify-center">
              <Loader2 size={20} className="animate-spin text-gray-300" />
            </div>
          ) : grants.filter((g: any) => g.is_active).length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl">
              <GitBranch size={28} className="mx-auto mb-2 opacity-20" />
              لا يوجد مكاتب مصرّح لها حتى الآن
            </div>
          ) : (
            <div className="space-y-2">
              {grants.filter((g: any) => g.is_active).map((g: any) => (
                <div key={g.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-white hover:border-indigo-200 transition-colors group">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 size={15} className="text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800">{g.office_name}</p>
                    <p className="text-[10px] text-gray-400">{g.office_slug} · {g.office_plan}</p>
                    {g.notes && <p className="text-[10px] text-indigo-500 mt-0.5">{g.notes}</p>}
                    <p className="text-[10px] text-gray-300 mt-0.5">
                      <Clock size={8} className="inline ml-0.5" />
                      {new Date(g.granted_at).toLocaleDateString("ar-SA")}
                    </p>
                  </div>
                  <button
                    onClick={() => revokeMut.mutate(g.office_id)}
                    disabled={revokeMut.isPending}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-all"
                    title="سحب الصلاحية"
                  >
                    <XCircle size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Notice */}
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-[11px] text-amber-700 flex items-start gap-2">
              <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
              <span>السوبر أدمن والمطور يملكان صلاحية دائمة بدون الحاجة لمنح. هذا الجدول للمكاتب الخارجية فقط.</span>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
