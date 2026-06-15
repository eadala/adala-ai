import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DollarSign, TrendingUp, BarChart2, BookOpen, ArrowRightLeft,
  CheckCircle2, AlertTriangle, RefreshCw, Zap, Building2,
  CreditCard, PieChart, Clock
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api  = (p: string) => `${BASE}${p}`;
async function get(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function post(url: string, body?: object) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const SAR = (n: number) => `${Number(n ?? 0).toLocaleString("ar-SA", { minimumFractionDigits: 2 })} ر.س`;

const TABS = [
  { id: "overview",      label: "لوحة التحكم",     icon: BarChart2 },
  { id: "transactions",  label: "المعاملات",         icon: CreditCard },
  { id: "ledger",        label: "دفتر الأستاذ",     icon: BookOpen },
  { id: "reconcile",     label: "المطابقة",          icon: ArrowRightLeft },
];

export default function FinancialEnginePage() {
  const qc  = useQueryClient();
  const [tab, setTab] = useState("overview");

  const summaryQ = useQuery({ queryKey: ["fe-summary"],   queryFn: () => get(api("/api/financial-engine/summary")),            refetchInterval: 30000 });
  const reconQ   = useQuery({ queryKey: ["fe-reconcile"], queryFn: () => get(api("/api/financial-engine/reconcile")),           enabled: tab === "reconcile", refetchInterval: 60000 });
  const txQ      = useQuery({ queryKey: ["fe-tx"],        queryFn: () => get(api("/api/financial-engine/transactions?limit=60")), enabled: tab === "transactions", refetchInterval: 20000 });
  const ledgerQ  = useQuery({ queryKey: ["fe-ledger"],    queryFn: () => get(api("/api/financial-engine/ledger?limit=60")),       enabled: tab === "ledger", refetchInterval: 20000 });
  const splitQ   = useQuery({ queryKey: ["fe-split"],     queryFn: () => get(api("/api/financial-engine/revenue-split?amount=1000")), enabled: tab === "overview" });
  const officesQ = useQuery({ queryKey: ["fe-offices"],   queryFn: () => get(api("/api/financial-engine/offices-summary")),      enabled: tab === "overview" });

  const testMut = useMutation({
    mutationFn: () => post(api("/api/financial-engine/test"), { officeId: "test-office", amount: 500 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fe-summary"] }); qc.invalidateQueries({ queryKey: ["fe-tx"] }); qc.invalidateQueries({ queryKey: ["fe-ledger"] }); },
  });

  const platform = summaryQ.data?.platform ?? {};
  const recon    = summaryQ.data?.reconciliation ?? {};
  const recent   = summaryQ.data?.recentTransactions ?? [];
  const split    = splitQ.data?.simulation ?? {};
  const actual   = splitQ.data?.actual ?? {};

  const STATUS_STYLE: Record<string, string> = {
    completed: "bg-emerald-100 text-emerald-700",
    pending:   "bg-amber-100 text-amber-700",
    failed:    "bg-red-100 text-red-700",
  };
  const GW_ICON: Record<string, string> = { stripe: "💳", manual: "✏️", system: "⚙️", moyasar: "🌐" };

  return (
    <div className="min-h-screen bg-gray-50 p-6 rtl" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">المحرك المالي</h1>
            <p className="text-sm text-gray-500">Financial Engine — Ledger · Revenue Split · Reconciliation</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { qc.invalidateQueries({ queryKey: ["fe-summary"] }); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
            <RefreshCw className="h-3 w-3" /> تحديث
          </button>
          <button onClick={() => testMut.mutate()} disabled={testMut.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-50">
            <Zap className="h-3 w-3" /> {testMut.isPending ? "جارٍ…" : "معاملة اختبارية"}
          </button>
        </div>
      </div>

      {/* Reconciliation Banner */}
      {recon.status && (
        <div className={`mb-4 p-3 rounded-xl border flex items-center gap-2 text-sm
          ${recon.status === "ok" ? "bg-emerald-50 border-emerald-300 text-emerald-800"
          : recon.status === "mismatch" ? "bg-red-50 border-red-300 text-red-800"
          : "bg-gray-50 border-gray-200 text-gray-600"}`}>
          {recon.status === "ok" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          <span className="font-medium">{recon.message}</span>
          <span className="text-xs opacity-70 mr-auto">
            دفتر الأستاذ: {SAR(recon.ledgerTotal ?? 0)} · المعاملات: {SAR(recon.transactionTotal ?? 0)}
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition
              ${tab === t.id ? "bg-emerald-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}>
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {tab === "overview" && (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "إجمالي الإيرادات",     value: SAR(platform.totalGross       ?? 0), icon: DollarSign,  color: "emerald" },
              { label: "صافي الإيرادات",        value: SAR(platform.totalNet         ?? 0), icon: TrendingUp,  color: "blue" },
              { label: "رسوم المنصة المحصّلة", value: SAR(platform.totalPlatformFees ?? 0), icon: PieChart,    color: "violet" },
              { label: "المعاملات المعالجة",    value: platform.transactionCount ?? 0,       icon: CreditCard,  color: "amber" },
            ].map((m, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-gray-500">{m.label}</div>
                  <div className={`w-7 h-7 rounded-lg bg-${m.color}-50 flex items-center justify-center`}>
                    <m.icon className={`h-4 w-4 text-${m.color}-600`} />
                  </div>
                </div>
                <div className="text-xl font-bold text-gray-900">{m.value}</div>
                <div className="text-xs text-gray-400 mt-1">{platform.officeCount ?? 0} مكتب</div>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* Revenue Split */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <PieChart className="h-4 w-4 text-emerald-600" /> توزيع الإيرادات (على 1000 ر.س)
              </div>
              <div className="space-y-3">
                {[
                  { label: "إجمالي الفاتورة",    value: SAR(split.gross       ?? 1000), pct: "100%",                          color: "bg-gray-200" },
                  { label: "رسوم المنصة (10%)",  value: SAR(split.platformFee ?? 100),  pct: "10%",                           color: "bg-violet-400" },
                  { label: "رسوم Stripe (2.9%+1)", value: SAR(split.stripeFee ?? 30),  pct: `${split.feePercent ?? 3}%`,     color: "bg-blue-400" },
                  { label: "الصافي للمكتب",       value: SAR(split.net        ?? 870),  pct: `${100 - (split.feePercent ?? 13)}%`, color: "bg-emerald-500" },
                ].map((r, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-sm shrink-0 ${r.color}`} />
                    <div className="flex-1 text-sm text-gray-700">{r.label}</div>
                    <div className="text-sm font-semibold text-gray-900">{r.value}</div>
                    <div className="text-xs text-gray-400 w-12 text-left">{r.pct}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400 flex justify-between">
                <span>رسوم فعلية محصّلة: {SAR(actual.platformFees ?? 0)}</span>
                <span>Stripe fees: {SAR(actual.stripeFees ?? 0)}</span>
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-600" /> آخر المعاملات
              </div>
              <div className="space-y-2">
                {recent.length === 0 && <div className="text-xs text-gray-400 text-center py-4">لا توجد معاملات بعد</div>}
                {recent.map((tx: any) => (
                  <div key={tx.id} className="flex items-center gap-2 py-1.5 border-b border-gray-50">
                    <span className="text-base">{GW_ICON[tx.gateway] ?? "💰"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-800 truncate">{tx.client_name ?? tx.description ?? "معاملة"}</div>
                      <div className="text-xs text-gray-400">{tx.office_id ?? ""} · {new Date(tx.created_at).toLocaleDateString("ar-SA")}</div>
                    </div>
                    <div className="text-sm font-semibold text-emerald-700">{SAR(tx.amount)}</div>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_STYLE[tx.status] ?? "bg-gray-100 text-gray-600"}`}>{tx.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Offices */}
          {(officesQ.data?.offices ?? []).length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-emerald-600" /> ملخص المكاتب
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-gray-100">
                      <th className="text-right pb-2 pr-1">المكتب</th>
                      <th className="text-right pb-2">الرصيد</th>
                      <th className="text-right pb-2">رسوم المنصة</th>
                      <th className="text-right pb-2">القيود</th>
                      <th className="text-right pb-2">آخر نشاط</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(officesQ.data?.offices ?? []).map((o: any) => (
                      <tr key={o.office_id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 pr-1 font-medium text-gray-800">{o.office_id}</td>
                        <td className="py-2 text-emerald-700 font-semibold">{SAR(o.net_balance)}</td>
                        <td className="py-2 text-violet-700">{SAR(o.platform_earned)}</td>
                        <td className="py-2 text-gray-600">{o.entry_count}</td>
                        <td className="py-2 text-gray-400 text-xs">{new Date(o.last_activity).toLocaleDateString("ar-SA")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Transactions Tab ── */}
      {tab === "transactions" && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          {txQ.isLoading && <div className="p-8 text-center text-gray-400 text-sm">جارٍ التحميل…</div>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-xs text-gray-500">
                  <th className="text-right px-4 py-3">العميل / الوصف</th>
                  <th className="text-right py-3">المبلغ</th>
                  <th className="text-right py-3">المنصة</th>
                  <th className="text-right py-3">الصافي</th>
                  <th className="text-right py-3">البوابة</th>
                  <th className="text-right py-3">الحالة</th>
                  <th className="text-right py-3">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {(txQ.data?.transactions ?? []).map((tx: any) => (
                  <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{tx.client_name ?? "—"}</div>
                      <div className="text-xs text-gray-400 truncate max-w-40">{tx.description ?? tx.office_id}</div>
                    </td>
                    <td className="py-3 font-semibold text-gray-900">{SAR(tx.amount)}</td>
                    <td className="py-3 text-violet-700">{SAR(tx.platform_fee ?? 0)}</td>
                    <td className="py-3 text-emerald-700 font-semibold">{SAR(tx.net_amount ?? 0)}</td>
                    <td className="py-3">{GW_ICON[tx.gateway] ?? "💰"} {tx.gateway}</td>
                    <td className="py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLE[tx.status] ?? "bg-gray-100 text-gray-600"}`}>{tx.status}</span>
                    </td>
                    <td className="py-3 text-xs text-gray-400">{new Date(tx.created_at).toLocaleDateString("ar-SA")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(txQ.data?.transactions ?? []).length === 0 && !txQ.isLoading && (
              <div className="p-8 text-center text-gray-400 text-sm">لا توجد معاملات</div>
            )}
          </div>
        </div>
      )}

      {/* ── Ledger Tab ── */}
      {tab === "ledger" && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          {ledgerQ.isLoading && <div className="p-8 text-center text-gray-400 text-sm">جارٍ التحميل…</div>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-xs text-gray-500">
                  <th className="text-right px-4 py-3">المكتب</th>
                  <th className="text-right py-3">النوع</th>
                  <th className="text-right py-3">المبلغ (صافي)</th>
                  <th className="text-right py-3">رسوم المنصة</th>
                  <th className="text-right py-3">رسوم Stripe</th>
                  <th className="text-right py-3">الرصيد التراكمي</th>
                  <th className="text-right py-3">المصدر</th>
                  <th className="text-right py-3">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {(ledgerQ.data?.entries ?? []).map((e: any) => (
                  <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50 font-mono text-xs">
                    <td className="px-4 py-2.5 font-sans text-gray-800">{e.office_id ?? "—"}</td>
                    <td className="py-2.5">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-sans
                        ${e.entry_type === "payment" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        {e.entry_type}
                      </span>
                    </td>
                    <td className="py-2.5 text-emerald-700 font-semibold">{SAR(e.amount)}</td>
                    <td className="py-2.5 text-violet-700">{SAR(e.platform_fee ?? 0)}</td>
                    <td className="py-2.5 text-blue-700">{SAR(e.stripe_fee ?? 0)}</td>
                    <td className="py-2.5 font-bold text-gray-900">{SAR(e.balance_after ?? 0)}</td>
                    <td className="py-2.5 text-gray-500 font-sans">{e.source ?? "—"}</td>
                    <td className="py-2.5 text-gray-400 font-sans">{new Date(e.created_at).toLocaleDateString("ar-SA")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(ledgerQ.data?.entries ?? []).length === 0 && !ledgerQ.isLoading && (
              <div className="p-8 text-center text-gray-400 text-sm">دفتر الأستاذ فارغ — أدخل معاملة اختبارية لترى النتيجة</div>
            )}
          </div>
        </div>
      )}

      {/* ── Reconcile Tab ── */}
      {tab === "reconcile" && (
        <div className="space-y-5">
          {/* Status Card */}
          <div className={`rounded-2xl p-6 border flex items-start gap-4
            ${reconQ.data?.status === "ok" ? "bg-emerald-50 border-emerald-300"
            : reconQ.data?.status === "mismatch" ? "bg-red-50 border-red-300"
            : "bg-gray-50 border-gray-200"}`}>
            {reconQ.data?.status === "ok"
              ? <CheckCircle2 className="h-8 w-8 text-emerald-500 shrink-0 mt-0.5" />
              : <AlertTriangle className="h-8 w-8 text-red-500 shrink-0 mt-0.5" />}
            <div>
              <div className="text-lg font-bold text-gray-900">{reconQ.data?.message ?? "جارٍ الفحص…"}</div>
              <div className="text-sm text-gray-600 mt-2 grid grid-cols-3 gap-4">
                <div>دفتر الأستاذ: <strong>{SAR(reconQ.data?.ledgerTotal ?? 0)}</strong></div>
                <div>المعاملات: <strong>{SAR(reconQ.data?.transactionTotal ?? 0)}</strong></div>
                <div>الفرق: <strong className={reconQ.data?.delta !== 0 ? "text-red-600" : "text-emerald-600"}>{SAR(reconQ.data?.delta ?? 0)}</strong></div>
              </div>
            </div>
          </div>

          {/* By Office */}
          {(reconQ.data?.byOffice ?? []).length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="font-semibold text-gray-800 mb-4">تفصيل حسب المكتب</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-gray-100">
                      <th className="text-right pb-2 pr-1">المكتب</th>
                      <th className="text-right pb-2">المعاملات</th>
                      <th className="text-right pb-2">الإجمالي</th>
                      <th className="text-right pb-2">الصافي</th>
                      <th className="text-right pb-2">رسوم المنصة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reconQ.data.byOffice.map((o: any) => (
                      <tr key={o.office_id} className="border-b border-gray-50">
                        <td className="py-2 pr-1 font-medium">{o.office_id}</td>
                        <td className="py-2 text-gray-600">{o.tx_count}</td>
                        <td className="py-2 text-gray-800 font-semibold">{SAR(o.gross_total)}</td>
                        <td className="py-2 text-emerald-700 font-semibold">{SAR(o.net_total)}</td>
                        <td className="py-2 text-violet-700">{SAR(o.fee_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700">
            <strong>كيف تعمل المطابقة؟</strong> — يقارن النظام مجموع الصافي في دفتر الأستاذ مع مجموع net_amount في جدول المعاملات.
            الفرق يعني وجود معاملة دخلت عبر Stripe لكن لم تُسجَّل في دفتر الأستاذ، أو العكس.
          </div>
        </div>
      )}
    </div>
  );
}
