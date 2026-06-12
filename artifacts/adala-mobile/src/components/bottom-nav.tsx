import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Home, Scale, Users, Bell, Plus, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const tabs = [
  { path: "/",          label: "الرئيسية",  icon: Home  },
  { path: "/cases",     label: "القضايا",   icon: Scale },
  { path: "/clients",   label: "العملاء",   icon: Users },
  { path: "/reminders", label: "التذكيرات", icon: Bell  },
];

const API = "/api";

type QuickSheet = "menu" | "case" | "client" | "reminder" | null;

export default function BottomNav() {
  const [location] = useLocation();
  const [sheet, setSheet] = useState<QuickSheet>(null);

  const { data: remindersData } = useQuery({
    queryKey: ["reminders-count-mobile"],
    queryFn: () => fetch(`${API}/reminders/count`).then(r => r.json()),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const pendingCount: number = remindersData?.count ?? 0;

  return (
    <>
      {/* Bottom Nav */}
      <nav className="bottom-nav fixed bottom-0 inset-x-0 bg-card z-50 safe-bottom">
        <div className="flex items-stretch h-16 relative">
          {/* Left 2 tabs */}
          {tabs.slice(0, 2).map(({ path, label, icon: Icon }) => {
            const active = path === "/" ? location === "/" : location.startsWith(path);
            return (
              <Link key={path} href={path}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 tap-effect relative"
              >
                <Icon size={22}
                  className={active ? "text-primary" : "text-muted-foreground"}
                  strokeWidth={active ? 2.5 : 1.8}
                />
                <span className={`text-[10px] font-semibold leading-none ${active ? "text-primary" : "text-muted-foreground"}`}>
                  {label}
                </span>
                {active && <span className="absolute top-0 h-0.5 w-10 bg-primary rounded-b-full" />}
              </Link>
            );
          })}

          {/* Center FAB */}
          <div className="flex-1 flex items-center justify-center">
            <button
              onClick={() => setSheet(s => s ? null : "menu")}
              className="w-14 h-14 -mt-5 rounded-full bg-primary shadow-lg shadow-primary/40 flex items-center justify-center tap-effect transition-transform active:scale-90"
            >
              {sheet
                ? <X size={22} className="text-primary-foreground" />
                : <Plus size={22} className="text-primary-foreground" />}
            </button>
          </div>

          {/* Right 2 tabs */}
          {tabs.slice(2).map(({ path, label, icon: Icon }) => {
            const active = location.startsWith(path);
            const showBadge = path === "/reminders" && pendingCount > 0;
            return (
              <Link key={path} href={path}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 tap-effect relative"
              >
                <div className="relative">
                  <Icon size={22}
                    className={active ? "text-primary" : "text-muted-foreground"}
                    strokeWidth={active ? 2.5 : 1.8}
                  />
                  {showBadge && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[8px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                      {pendingCount > 9 ? "9+" : pendingCount}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-semibold leading-none ${active ? "text-primary" : "text-muted-foreground"}`}>
                  {label}
                </span>
                {active && <span className="absolute top-0 h-0.5 w-10 bg-primary rounded-b-full" />}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Quick-add overlay */}
      {sheet && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
            onClick={() => setSheet(null)}
          />

          {/* Sheet */}
          <div className="fixed bottom-0 inset-x-0 z-50 bg-card rounded-t-3xl border-t border-border pb-safe px-4 pt-4 pb-8 safe-bottom"
            style={{ animation: "slideUp .22s ease-out" }}
          >
            {sheet === "menu" && (
              <QuickMenu onSelect={setSheet} onClose={() => setSheet(null)} />
            )}
            {sheet === "case" && (
              <QuickCaseForm onClose={() => setSheet(null)} />
            )}
            {sheet === "client" && (
              <QuickClientForm onClose={() => setSheet(null)} />
            )}
            {sheet === "reminder" && (
              <QuickReminderForm onClose={() => setSheet(null)} />
            )}
          </div>
        </>
      )}
    </>
  );
}

function QuickMenu({ onSelect, onClose }: { onSelect: (s: QuickSheet) => void; onClose: () => void }) {
  const items = [
    { id: "case"     as QuickSheet, icon: Scale,    label: "قضية جديدة",   color: "bg-blue-500/20 text-blue-400"    },
    { id: "client"   as QuickSheet, icon: Users,    label: "عميل جديد",    color: "bg-violet-500/20 text-violet-400" },
    { id: "reminder" as QuickSheet, icon: Bell,     label: "تذكير جديد",   color: "bg-rose-500/20 text-rose-400"    },
  ];
  return (
    <div>
      <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-5" />
      <p className="text-sm font-bold text-foreground text-center mb-4">إضافة سريعة</p>
      <div className="flex gap-3">
        {items.map(({ id, icon: Icon, label, color }) => (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className="flex-1 flex flex-col items-center gap-2 bg-muted/50 rounded-2xl py-4 tap-effect border border-border/40"
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
              <Icon size={22} />
            </div>
            <span className="text-xs font-semibold text-foreground leading-tight text-center">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function QuickCaseForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", clientName: "", caseType: "" });

  const mut = useMutation({
    mutationFn: (body: object) =>
      fetch(`${API}/cases`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess: (data) => {
      if (data?.error) { toast.error(data.error); return; }
      qc.invalidateQueries({ queryKey: ["cases"] });
      toast.success("تم إنشاء القضية ✓");
      onClose();
    },
    onError: () => toast.error("حدث خطأ"),
  });

  return (
    <div>
      <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-4" />
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center">
          <Scale size={16} className="text-blue-400" />
        </div>
        <p className="text-sm font-bold text-foreground">قضية جديدة</p>
      </div>
      <div className="flex flex-col gap-3">
        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="عنوان القضية *"
          className="w-full bg-muted border border-border rounded-xl py-2.5 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
        />
        <input value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
          placeholder="اسم الموكل (اختياري)"
          className="w-full bg-muted border border-border rounded-xl py-2.5 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
        />
        <select value={form.caseType} onChange={e => setForm(f => ({ ...f, caseType: e.target.value }))}
          className="w-full bg-muted border border-border rounded-xl py-2.5 px-4 text-sm text-foreground outline-none focus:border-primary/50"
        >
          <option value="">نوع القضية</option>
          <option value="civil">مدني</option>
          <option value="criminal">جنائي</option>
          <option value="commercial">تجاري</option>
          <option value="family">أسري</option>
          <option value="administrative">إداري</option>
          <option value="labor">عمالي</option>
          <option value="other">أخرى</option>
        </select>
        <div className="flex gap-2 mt-1">
          <button onClick={onClose} className="flex-1 border border-border text-muted-foreground rounded-xl py-2.5 text-sm font-medium tap-effect">إلغاء</button>
          <button onClick={() => { if (!form.title.trim()) { toast.error("أدخل عنوان القضية"); return; } mut.mutate({ ...form, status: "open" }); }}
            disabled={mut.isPending}
            className="flex-[2] bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold tap-effect disabled:opacity-60"
          >
            {mut.isPending ? "جاري الإنشاء..." : "إنشاء القضية"}
          </button>
        </div>
      </div>
    </div>
  );
}

function QuickClientForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ fullName: "", type: "individual", phone: "" });

  const mut = useMutation({
    mutationFn: (body: object) =>
      fetch(`${API}/clients`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess: (data) => {
      if (data?.error) { toast.error(data.error); return; }
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("تم إضافة العميل ✓");
      onClose();
    },
    onError: () => toast.error("حدث خطأ"),
  });

  return (
    <div>
      <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-4" />
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-xl bg-violet-500/20 flex items-center justify-center">
          <Users size={16} className="text-violet-400" />
        </div>
        <p className="text-sm font-bold text-foreground">عميل جديد</p>
      </div>
      <div className="flex flex-col gap-3">
        <input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
          placeholder="الاسم الكامل *"
          className="w-full bg-muted border border-border rounded-xl py-2.5 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
        />
        <div className="flex gap-2">
          {[{ value: "individual", label: "👤 فرد" }, { value: "company", label: "🏢 شركة" }].map(opt => (
            <button key={opt.value} onClick={() => setForm(f => ({ ...f, type: opt.value }))}
              className={`flex-1 py-2 rounded-xl text-sm font-medium tap-effect border transition-colors ${
                form.type === opt.value ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
          placeholder="رقم الهاتف (اختياري)" type="tel"
          className="w-full bg-muted border border-border rounded-xl py-2.5 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
        />
        <div className="flex gap-2 mt-1">
          <button onClick={onClose} className="flex-1 border border-border text-muted-foreground rounded-xl py-2.5 text-sm font-medium tap-effect">إلغاء</button>
          <button onClick={() => { if (!form.fullName.trim()) { toast.error("أدخل اسم العميل"); return; } mut.mutate(form); }}
            disabled={mut.isPending}
            className="flex-[2] bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold tap-effect disabled:opacity-60"
          >
            {mut.isPending ? "جاري الإضافة..." : "إضافة العميل"}
          </button>
        </div>
      </div>
    </div>
  );
}

function QuickReminderForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", dueDate: "", priority: "medium" });

  const mut = useMutation({
    mutationFn: (body: object) =>
      fetch(`${API}/reminders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess: (data) => {
      if (data?.error) { toast.error(data.error); return; }
      qc.invalidateQueries({ queryKey: ["reminders"] });
      toast.success("تم إضافة التذكير ✓");
      onClose();
    },
    onError: () => toast.error("حدث خطأ"),
  });

  return (
    <div>
      <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-4" />
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-xl bg-rose-500/20 flex items-center justify-center">
          <Bell size={16} className="text-rose-400" />
        </div>
        <p className="text-sm font-bold text-foreground">تذكير جديد</p>
      </div>
      <div className="flex flex-col gap-3">
        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="عنوان التذكير *"
          className="w-full bg-muted border border-border rounded-xl py-2.5 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">تاريخ الاستحقاق</label>
            <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
              className="w-full bg-muted border border-border rounded-xl py-2 px-3 text-sm text-foreground outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">الأولوية</label>
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
              className="w-full bg-muted border border-border rounded-xl py-2 px-3 text-sm text-foreground outline-none focus:border-primary/50"
            >
              <option value="low">منخفضة</option>
              <option value="medium">متوسطة</option>
              <option value="high">عالية</option>
              <option value="urgent">عاجل</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-1">
          <button onClick={onClose} className="flex-1 border border-border text-muted-foreground rounded-xl py-2.5 text-sm font-medium tap-effect">إلغاء</button>
          <button onClick={() => { if (!form.title.trim()) { toast.error("أدخل عنوان التذكير"); return; } mut.mutate({ ...form, officeId: "default" }); }}
            disabled={mut.isPending}
            className="flex-[2] bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold tap-effect disabled:opacity-60"
          >
            {mut.isPending ? "جاري الإضافة..." : "إضافة التذكير"}
          </button>
        </div>
      </div>
    </div>
  );
}
