import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Cpu, Database, FileCode2, GitBranch, Package, Key, Bot,
  Plus, Trash2, RefreshCw, Loader2, CheckCircle, XCircle,
  ToggleLeft, ToggleRight, Zap, Copy, Eye, EyeOff, ChevronRight,
  Table, AlignLeft, Hash, Calendar, ToggleLeft as Bool, List,
  Play, Pause, BarChart3, Layers, Globe, Shield, Sparkles,
  Code2, Send, Clock, CircleCheck,
} from "lucide-react";

const BASE = (() => {
  const b = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  return (path: string, opts?: RequestInit) =>
    fetch(`${b}/api${path}`, { headers: { "Content-Type": "application/json" }, ...opts });
})();

/* ─────────────────────────────────────────────
   SECTION IDs
───────────────────────────────────────────── */
const SECTIONS = [
  { id: "overview",   label: "نظرة عامة",       icon: BarChart3   },
  { id: "database",   label: "Database Studio",  icon: Database    },
  { id: "forms",      label: "Form Builder",     icon: FileCode2   },
  { id: "workflows",  label: "Workflow Builder", icon: GitBranch   },
  { id: "plugins",    label: "Plugin Store",     icon: Package     },
  { id: "api",        label: "API Center",       icon: Key         },
  { id: "ai",         label: "AI Developer",     icon: Bot         },
];

const FIELD_TYPES = [
  { value: "text",     label: "نص",          icon: AlignLeft  },
  { value: "number",   label: "رقم",         icon: Hash       },
  { value: "date",     label: "تاريخ",       icon: Calendar   },
  { value: "boolean",  label: "نعم/لا",      icon: Bool       },
  { value: "select",   label: "قائمة",       icon: List       },
  { value: "textarea", label: "نص طويل",     icon: AlignLeft  },
];

const TRIGGERS = [
  { value: "case_created",    label: "عند إنشاء قضية جديدة"     },
  { value: "invoice_paid",    label: "عند دفع فاتورة"           },
  { value: "client_added",    label: "عند إضافة عميل"           },
  { value: "document_upload", label: "عند رفع مستند"            },
  { value: "task_due",        label: "عند اقتراب موعد مهمة"     },
  { value: "manual",          label: "يدوي (تشغيل يدوي)"       },
];

const ACTIONS = [
  { value: "send_email",     label: "إرسال بريد إلكتروني"    },
  { value: "send_sms",       label: "إرسال SMS"               },
  { value: "send_whatsapp",  label: "إرسال رسالة واتساب"      },
  { value: "create_task",    label: "إنشاء مهمة تلقائية"      },
  { value: "create_invoice", label: "إنشاء فاتورة"            },
  { value: "send_notif",     label: "إرسال إشعار داخلي"       },
  { value: "webhook",        label: "استدعاء Webhook"         },
];

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════ */
export default function AdalaBuildStudio() {
  const { user } = useUser();
  const [, nav] = useLocation();
  const { toast } = useToast();
  const [section, setSection] = useState("overview");

  /* Super-admin guard */
  const isSA = user?.publicMetadata?.role === "super_admin"
    || (import.meta.env.VITE_SUPER_ADMIN_EMAILS ?? "").split(",").map((e: string) => e.trim()).includes(user?.primaryEmailAddress?.emailAddress ?? "");

  useEffect(() => { if (user && !isSA) nav("/dashboard"); }, [user, isSA]);

  if (!user) return <div className="flex justify-center items-center min-h-screen"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background">
      {/* TOP BAR */}
      <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-600/20 to-cyan-600/20 border border-violet-500/20">
              <Cpu className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground leading-none">Adala Studio</h1>
              <p className="text-[10px] text-muted-foreground mt-0.5">Low-Code / No-Code Builder</p>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto flex-1">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  section === s.id
                    ? "bg-violet-600 text-white shadow"
                    : "hover:bg-muted text-muted-foreground"
                }`}
              >
                <s.icon className="h-3.5 w-3.5" />
                {s.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* BODY */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {section === "overview"  && <OverviewSection toast={toast} onNav={setSection} />}
        {section === "database"  && <DatabaseSection toast={toast} />}
        {section === "forms"     && <FormsSection toast={toast} />}
        {section === "workflows" && <WorkflowSection toast={toast} />}
        {section === "plugins"   && <PluginsSection toast={toast} />}
        {section === "api"       && <ApiSection toast={toast} />}
        {section === "ai"        && <AiSection toast={toast} />}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   OVERVIEW
══════════════════════════════════════════════════ */
function OverviewSection({ toast, onNav }: any) {
  const [stats, setStats] = useState<any>(null);
  useEffect(() => {
    BASE("/studio/stats").then(r => r.json()).then(setStats).catch(() => {});
  }, []);

  const cards = [
    { id: "database",  label: "جداول مخصصة",    value: stats?.customTables ?? "—",    icon: Database,   color: "violet" },
    { id: "forms",     label: "نماذج",          value: stats?.forms ?? "—",           icon: FileCode2,  color: "blue"   },
    { id: "workflows", label: "سير عمل نشط",    value: stats?.activeWorkflows ?? "—", icon: GitBranch,  color: "emerald"},
    { id: "plugins",   label: "إضافات مفعّلة",  value: stats?.enabledPlugins ?? "—",  icon: Package,    color: "yellow" },
    { id: "api",       label: "مفاتيح API",     value: stats?.activeApiKeys ?? "—",   icon: Key,        color: "orange" },
    { id: "ai",        label: "مهام AI",        value: stats?.aiTasks ?? "—",         icon: Bot,        color: "pink"   },
  ];

  const quickActions = [
    { id: "database",  label: "إنشاء جدول جديد",      icon: Table,     desc: "أضف بنية بيانات مخصصة" },
    { id: "forms",     label: "بناء نموذج",           icon: FileCode2, desc: "نماذج ديناميكية للعملاء" },
    { id: "workflows", label: "أتمتة سير عمل",        icon: Zap,       desc: "ربط المشغلات بالإجراءات" },
    { id: "ai",        label: "توليد وحدة بالذكاء",   icon: Sparkles,  desc: "صف ما تريد وسنبنيه لك" },
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-violet-900/30 via-background to-cyan-900/20 border border-violet-500/20 p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-violet-500/5 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-violet-400" />
            <span className="text-xs font-medium text-violet-300 uppercase tracking-wider">Adala Studio</span>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-1">مرحباً بك في مركز البناء</h2>
          <p className="text-sm text-muted-foreground max-w-lg">
            أنشئ جداول وحقول ونماذج وسير عمل مخصصة — بدون كتابة كود واحد.
            استخدم AI Developer لتوليد وحدات كاملة من جملة واحدة.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map(c => (
          <button key={c.id} onClick={() => onNav(c.id)}
            className="text-right bg-card border border-border/50 rounded-xl p-4 hover:border-violet-500/40 hover:bg-muted/20 transition-all group">
            <c.icon className={`h-5 w-5 text-${c.color}-400 mb-2`} />
            <p className="text-2xl font-bold text-foreground">{c.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{c.label}</p>
          </button>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">إجراءات سريعة</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map(a => (
            <button key={a.id} onClick={() => onNav(a.id)}
              className="text-right bg-card border border-border/50 rounded-xl p-4 hover:border-violet-500/40 hover:bg-muted/20 transition-all flex items-start gap-3 group">
              <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20 group-hover:bg-violet-500/20 transition-colors flex-shrink-0 mt-0.5">
                <a.icon className="h-4 w-4 text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{a.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 mr-auto mt-1 group-hover:text-violet-400 transition-colors" />
            </button>
          ))}
        </div>
      </div>

      {/* Studio map */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">خريطة Adala Studio</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { icon: Database,  title: "Database Studio",  desc: "جداول وحقول ديناميكية" },
            { icon: FileCode2, title: "Form Builder",     desc: "نماذج تفاعلية للمستخدمين" },
            { icon: GitBranch, title: "Workflow Builder", desc: "أتمتة قائمة على المشغلات" },
            { icon: Bot,       title: "AI Developer",     desc: "توليد وحدات بالذكاء الاصطناعي" },
            { icon: Package,   title: "Plugin Store",     desc: "إضافات جاهزة للتفعيل" },
            { icon: Key,       title: "API Center",       desc: "مفاتيح API للتكامل الخارجي" },
            { icon: Globe,     title: "DevOps Center",    desc: "الاستضافة والنطاقات" },
            { icon: Shield,    title: "Developer Center", desc: "رموز المطور وصلاحياتهم" },
          ].map(m => (
            <div key={m.title} className="flex items-start gap-2.5 bg-muted/30 rounded-lg p-3 border border-border/40">
              <m.icon className="h-4 w-4 text-violet-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold">{m.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   DATABASE STUDIO
══════════════════════════════════════════════════ */
function DatabaseSection({ toast }: any) {
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [fields, setFields] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newTable, setNewTable] = useState({ tableName: "", displayName: "", icon: "table", description: "" });
  const [showFieldForm, setShowFieldForm] = useState(false);
  const [newField, setNewField] = useState({ fieldName: "", fieldLabel: "", fieldType: "text", required: false });

  const load = async () => {
    setLoading(true);
    try { const d = await (await BASE("/studio/tables")).json(); setTables(Array.isArray(d) ? d : []); }
    finally { setLoading(false); }
  };

  const loadFields = async (tId: string) => {
    const d = await (await BASE(`/studio/tables/${tId}/fields`)).json();
    setFields(Array.isArray(d) ? d : []);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (selectedTable) loadFields(selectedTable.id); }, [selectedTable]);

  const addTable = async () => {
    if (!newTable.tableName.trim()) return;
    const r = await BASE("/studio/tables", { method: "POST", body: JSON.stringify(newTable) });
    if (!r.ok) { toast({ title: (await r.json()).error, variant: "destructive" }); return; }
    toast({ title: "تم إنشاء الجدول ✓" });
    setNewTable({ tableName: "", displayName: "", icon: "table", description: "" });
    setShowForm(false); load();
  };

  const delTable = async (id: string) => {
    if (!confirm("حذف الجدول وجميع حقوله؟")) return;
    await BASE(`/studio/tables/${id}`, { method: "DELETE" });
    if (selectedTable?.id === id) setSelectedTable(null);
    load();
  };

  const addField = async () => {
    if (!newField.fieldName.trim()) return;
    const r = await BASE(`/studio/tables/${selectedTable.id}/fields`, { method: "POST", body: JSON.stringify(newField) });
    if (!r.ok) { toast({ title: (await r.json()).error, variant: "destructive" }); return; }
    toast({ title: "تم إضافة الحقل ✓" });
    setNewField({ fieldName: "", fieldLabel: "", fieldType: "text", required: false });
    setShowFieldForm(false);
    loadFields(selectedTable.id);
  };

  const delField = async (id: string) => {
    await BASE(`/studio/fields/${id}`, { method: "DELETE" });
    loadFields(selectedTable.id);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Tables list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-1.5"><Database className="h-4 w-4 text-violet-400" />الجداول</h3>
          <Button size="sm" variant="outline" onClick={() => setShowForm(v => !v)}><Plus className="h-3.5 w-3.5 ml-1" />جديد</Button>
        </div>

        {showForm && (
          <Card className="border-violet-500/30 bg-violet-500/5">
            <CardContent className="p-3 space-y-2">
              <Input placeholder="اسم الجدول (بالإنجليزية)" value={newTable.tableName} dir="ltr"
                onChange={e => setNewTable(p => ({ ...p, tableName: e.target.value }))} className="text-sm h-8" />
              <Input placeholder="الاسم المعروض (بالعربية)" value={newTable.displayName}
                onChange={e => setNewTable(p => ({ ...p, displayName: e.target.value }))} className="text-sm h-8" />
              <Input placeholder="الوصف (اختياري)" value={newTable.description}
                onChange={e => setNewTable(p => ({ ...p, description: e.target.value }))} className="text-sm h-8" />
              <div className="flex gap-1.5 justify-end">
                <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>إلغاء</Button>
                <Button size="sm" onClick={addTable}>إنشاء</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? <div className="flex justify-center py-8"><Loader2 className="animate-spin h-5 w-5 text-violet-400" /></div>
          : tables.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Table className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">لا توجد جداول بعد</p>
            </div>
          ) : tables.map((t: any) => (
            <div key={t.id}
              onClick={() => setSelectedTable(t)}
              className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                selectedTable?.id === t.id ? "border-violet-500/50 bg-violet-500/10" : "border-border/50 hover:bg-muted/30"
              }`}>
              <Table className="h-4 w-4 text-violet-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{t.display_name}</p>
                <p className="text-[10px] text-muted-foreground font-mono" dir="ltr">{t.table_name}</p>
              </div>
              <span className="text-[10px] bg-muted/60 px-1.5 py-0.5 rounded-full text-muted-foreground">{t.fields_count} حقل</span>
              <button onClick={e => { e.stopPropagation(); delTable(t.id); }} className="text-muted-foreground hover:text-red-400 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
      </div>

      {/* Fields panel */}
      <div className="md:col-span-2 space-y-3">
        {selectedTable ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">{selectedTable.display_name} — الحقول</h3>
                <p className="text-[10px] text-muted-foreground font-mono" dir="ltr">{selectedTable.table_name}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowFieldForm(v => !v)}><Plus className="h-3.5 w-3.5 ml-1" />حقل</Button>
            </div>

            {showFieldForm && (
              <Card className="border-blue-500/30 bg-blue-500/5">
                <CardContent className="p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="اسم الحقل (بالإنجليزية)" value={newField.fieldName} dir="ltr"
                      onChange={e => setNewField(p => ({ ...p, fieldName: e.target.value }))} className="text-sm h-8" />
                    <Input placeholder="التسمية (بالعربية)" value={newField.fieldLabel}
                      onChange={e => setNewField(p => ({ ...p, fieldLabel: e.target.value }))} className="text-sm h-8" />
                    <select value={newField.fieldType} onChange={e => setNewField(p => ({ ...p, fieldType: e.target.value }))}
                      className="bg-background border border-input rounded-md px-2 py-1 text-sm h-8">
                      {FIELD_TYPES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={newField.required} onChange={e => setNewField(p => ({ ...p, required: e.target.checked }))} />
                      مطلوب
                    </label>
                  </div>
                  <div className="flex gap-1.5 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => setShowFieldForm(false)}>إلغاء</Button>
                    <Button size="sm" onClick={addField}>إضافة</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {fields.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground border border-dashed border-border/50 rounded-xl">
                <Layers className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">لا توجد حقول — أضف حقلاً للبدء</p>
              </div>
            ) : (
              <Card className="border-border/50"><CardContent className="p-0">
                <div className="divide-y divide-border/50">
                  {fields.map((f: any) => {
                    const ft = FIELD_TYPES.find(t => t.value === f.field_type);
                    return (
                      <div key={f.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                        {ft && <ft.icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{f.field_label}</span>
                            {f.required && <span className="text-[10px] bg-red-500/10 text-red-400 px-1 rounded">مطلوب</span>}
                          </div>
                          <code className="text-[10px] text-muted-foreground font-mono" dir="ltr">{f.field_name} ({f.field_type})</code>
                        </div>
                        <button onClick={() => delField(f.id)} className="text-muted-foreground hover:text-red-400 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </CardContent></Card>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border border-dashed border-border/50 rounded-xl">
            <Database className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-sm">اختر جدولاً لعرض حقوله</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   FORM BUILDER
══════════════════════════════════════════════════ */
function FormsSection({ toast }: any) {
  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", description: "", isPublic: false });
  const [selectedForm, setSelectedForm] = useState<any>(null);
  const [editFields, setEditFields] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    try { const d = await (await BASE("/studio/forms")).json(); setForms(Array.isArray(d) ? d : []); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (selectedForm) {
      try { setEditFields(typeof selectedForm.fields === "string" ? JSON.parse(selectedForm.fields) : (selectedForm.fields ?? [])); }
      catch { setEditFields([]); }
    }
  }, [selectedForm]);

  const createForm = async () => {
    if (!newForm.name.trim()) return;
    const r = await BASE("/studio/forms", { method: "POST", body: JSON.stringify(newForm) });
    if (!r.ok) { toast({ title: (await r.json()).error, variant: "destructive" }); return; }
    toast({ title: "تم إنشاء النموذج ✓" });
    setNewForm({ name: "", description: "", isPublic: false });
    setShowForm(false); load();
  };

  const deleteForm = async (id: string) => {
    if (!confirm("حذف هذا النموذج؟")) return;
    await BASE(`/studio/forms/${id}`, { method: "DELETE" });
    if (selectedForm?.id === id) setSelectedForm(null);
    load();
  };

  const addFormField = () => {
    setEditFields(f => [...f, { id: Date.now(), label: "حقل جديد", type: "text", required: false }]);
  };

  const saveFields = async () => {
    await BASE(`/studio/forms/${selectedForm.id}`, { method: "PATCH", body: JSON.stringify({ fields: editFields }) });
    toast({ title: "تم الحفظ ✓" });
    load();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Forms list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-1.5"><FileCode2 className="h-4 w-4 text-blue-400" />النماذج</h3>
          <Button size="sm" variant="outline" onClick={() => setShowForm(v => !v)}><Plus className="h-3.5 w-3.5 ml-1" />جديد</Button>
        </div>

        {showForm && (
          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardContent className="p-3 space-y-2">
              <Input placeholder="اسم النموذج" value={newForm.name} onChange={e => setNewForm(p => ({ ...p, name: e.target.value }))} className="text-sm h-8" />
              <Input placeholder="الوصف (اختياري)" value={newForm.description} onChange={e => setNewForm(p => ({ ...p, description: e.target.value }))} className="text-sm h-8" />
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={newForm.isPublic} onChange={e => setNewForm(p => ({ ...p, isPublic: e.target.checked }))} />
                متاح للعموم
              </label>
              <div className="flex gap-1.5 justify-end">
                <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>إلغاء</Button>
                <Button size="sm" onClick={createForm}>إنشاء</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? <div className="flex justify-center py-8"><Loader2 className="animate-spin h-5 w-5 text-blue-400" /></div>
          : forms.map((f: any) => (
            <div key={f.id}
              onClick={() => setSelectedForm(f)}
              className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                selectedForm?.id === f.id ? "border-blue-500/50 bg-blue-500/10" : "border-border/50 hover:bg-muted/30"
              }`}>
              <FileCode2 className="h-4 w-4 text-blue-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.name}</p>
                <p className="text-[10px] text-muted-foreground">{f.is_public ? "عام" : "خاص"}</p>
              </div>
              <button onClick={e => { e.stopPropagation(); deleteForm(f.id); }} className="text-muted-foreground hover:text-red-400">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

        {!loading && forms.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <FileCode2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">لا توجد نماذج بعد</p>
          </div>
        )}
      </div>

      {/* Form editor */}
      <div className="md:col-span-2 space-y-3">
        {selectedForm ? (
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{selectedForm.name} — الحقول</h3>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" onClick={addFormField}><Plus className="h-3.5 w-3.5 ml-1" />حقل</Button>
                <Button size="sm" onClick={saveFields}><CheckCircle className="h-3.5 w-3.5 ml-1" />حفظ</Button>
              </div>
            </div>

            {editFields.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground border border-dashed border-border/50 rounded-xl">
                <Layers className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">اضغط "+ حقل" لإضافة حقل للنموذج</p>
              </div>
            ) : (
              <div className="space-y-2">
                {editFields.map((f: any, idx: number) => (
                  <Card key={f.id} className="border-border/50">
                    <CardContent className="p-3 flex items-center gap-2">
                      <div className="grid grid-cols-3 gap-2 flex-1">
                        <Input value={f.label} onChange={e => setEditFields(fds => fds.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))}
                          placeholder="التسمية" className="text-sm h-8" />
                        <select value={f.type} onChange={e => setEditFields(fds => fds.map((x, i) => i === idx ? { ...x, type: e.target.value } : x))}
                          className="bg-background border border-input rounded-md px-2 py-1 text-sm h-8">
                          {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <input type="checkbox" checked={f.required} onChange={e => setEditFields(fds => fds.map((x, i) => i === idx ? { ...x, required: e.target.checked } : x))} />
                          مطلوب
                        </label>
                      </div>
                      <button onClick={() => setEditFields(fds => fds.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-red-400">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border border-dashed border-border/50 rounded-xl">
            <FileCode2 className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-sm">اختر نموذجاً لتعديله</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   WORKFLOW BUILDER
══════════════════════════════════════════════════ */
function WorkflowSection({ toast }: any) {
  const [wfs, setWfs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newWf, setNewWf] = useState({ name: "", description: "", trigger: "case_created", actions: [] as string[] });

  const load = async () => {
    setLoading(true);
    try { const d = await (await BASE("/studio/workflows")).json(); setWfs(Array.isArray(d) ? d : []); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!newWf.name.trim()) return;
    const r = await BASE("/studio/workflows", { method: "POST", body: JSON.stringify({ ...newWf, actions: newWf.actions.map(a => ({ type: a })) }) });
    if (!r.ok) { toast({ title: (await r.json()).error, variant: "destructive" }); return; }
    toast({ title: "تم إنشاء سير العمل ✓" });
    setNewWf({ name: "", description: "", trigger: "case_created", actions: [] });
    setShowForm(false); load();
  };

  const toggle = async (id: string) => {
    await BASE(`/studio/workflows/${id}/toggle`, { method: "PATCH" });
    load();
  };

  const del = async (id: string) => {
    if (!confirm("حذف سير العمل هذا؟")) return;
    await BASE(`/studio/workflows/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5"><GitBranch className="h-4 w-4 text-emerald-400" />سير العمل الآلي ({wfs.length})</h3>
        <Button size="sm" onClick={() => setShowForm(v => !v)}><Plus className="h-3.5 w-3.5 ml-1" />جديد</Button>
      </div>

      {/* Info banner */}
      <Card className="border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="p-3 flex gap-2.5">
          <Zap className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            حدد <strong>المشغّل</strong> (ما الذي يبدأ سير العمل؟) ثم أضف <strong>الإجراءات</strong> (ماذا يحدث؟).
            يدعم المنصة حالياً التشغيل اليدوي وسيُضاف التشغيل التلقائي قريباً.
          </p>
        </CardContent>
      </Card>

      {showForm && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold text-emerald-300">سير عمل جديد</p>
            <Input placeholder="الاسم" value={newWf.name} onChange={e => setNewWf(p => ({ ...p, name: e.target.value }))} className="text-sm h-8" />
            <Input placeholder="الوصف (اختياري)" value={newWf.description} onChange={e => setNewWf(p => ({ ...p, description: e.target.value }))} className="text-sm h-8" />

            {/* Trigger */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">⚡ المشغّل</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                {TRIGGERS.map(t => (
                  <button key={t.value} onClick={() => setNewWf(p => ({ ...p, trigger: t.value }))}
                    className={`text-xs px-2.5 py-2 rounded-lg border text-right transition-all ${newWf.trigger === t.value ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300" : "border-border/50 hover:bg-muted/30"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">🔧 الإجراءات</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                {ACTIONS.map(a => (
                  <button key={a.value}
                    onClick={() => setNewWf(p => ({
                      ...p,
                      actions: p.actions.includes(a.value) ? p.actions.filter(x => x !== a.value) : [...p.actions, a.value],
                    }))}
                    className={`text-xs px-2.5 py-2 rounded-lg border text-right transition-all ${newWf.actions.includes(a.value) ? "border-blue-500/50 bg-blue-500/15 text-blue-300" : "border-border/50 hover:bg-muted/30"}`}>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-1.5 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>إلغاء</Button>
              <Button size="sm" onClick={create}>إنشاء</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin h-6 w-6 text-emerald-400" /></div>
        : wfs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border border-dashed border-border/50 rounded-xl">
            <GitBranch className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">لا توجد سير عمل — أنشئ أول أتمتة لك</p>
          </div>
        ) : wfs.map((w: any) => {
          const triggerLabel = TRIGGERS.find(t => t.value === w.trigger)?.label ?? w.trigger;
          let actions: any[] = [];
          try { actions = typeof w.actions === "string" ? JSON.parse(w.actions) : (w.actions ?? []); } catch {}
          return (
            <Card key={w.id} className={`border-border/50 ${w.is_active ? "" : "opacity-60"}`}>
              <CardContent className="p-4 flex items-start gap-3">
                <div className={`p-2 rounded-lg ${w.is_active ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-muted/30 border border-border/50"}`}>
                  <GitBranch className={`h-4 w-4 ${w.is_active ? "text-emerald-400" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{w.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${w.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-muted/60 text-muted-foreground"}`}>
                      {w.is_active ? "نشط" : "متوقف"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded">⚡ {triggerLabel}</span>
                    {actions.slice(0, 3).map((a: any, i: number) => (
                      <span key={i} className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                        {ACTIONS.find(x => x.value === (a.type ?? a))?.label ?? a.type ?? a}
                      </span>
                    ))}
                    {actions.length > 3 && <span className="text-xs text-muted-foreground">+{actions.length - 3}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => toggle(w.id)} className="p-1.5 rounded hover:bg-muted transition-colors">
                    {w.is_active ? <Pause className="h-4 w-4 text-yellow-400" /> : <Play className="h-4 w-4 text-emerald-400" />}
                  </button>
                  <button onClick={() => del(w.id)} className="p-1.5 rounded hover:bg-muted transition-colors">
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-400" />
                  </button>
                </div>
              </CardContent>
            </Card>
          );
        })}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   PLUGIN STORE
══════════════════════════════════════════════════ */
function PluginsSection({ toast }: any) {
  const [plugins, setPlugins] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    try { const d = await (await BASE("/studio/plugins")).json(); setPlugins(Array.isArray(d) ? d : []); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggle = async (id: string) => {
    await BASE(`/studio/plugins/${id}/toggle`, { method: "PATCH" });
    load();
    toast({ title: "تم تحديث حالة الإضافة" });
  };

  const categories = ["all", ...Array.from(new Set(plugins.map((p: any) => p.category).filter(Boolean)))];
  const filtered = filter === "all" ? plugins : plugins.filter((p: any) => p.category === filter);

  const CATEGORY_LABELS: Record<string, string> = {
    all: "الكل", messaging: "المراسلة", productivity: "الإنتاجية",
    legal: "قانوني", documents: "المستندات", integrations: "التكاملات",
    reporting: "التقارير", localization: "اللغة",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-1.5"><Package className="h-4 w-4 text-yellow-400" />متجر الإضافات ({plugins.length})</h3>
        <div className="flex gap-1.5 flex-wrap">
          {categories.map(c => (
            <button key={c} onClick={() => setFilter(c)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${filter === c ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-300" : "border-border/50 hover:bg-muted/30 text-muted-foreground"}`}>
              {CATEGORY_LABELS[c] ?? c}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin h-6 w-6 text-yellow-400" /></div>
        : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((p: any) => (
              <Card key={p.id} className={`border-border/50 transition-all ${p.is_enabled ? "border-emerald-500/30 bg-emerald-500/5" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`p-2 rounded-lg border flex-shrink-0 ${p.is_enabled ? "bg-emerald-500/10 border-emerald-500/20" : "bg-muted/30 border-border/50"}`}>
                      <Package className={`h-5 w-5 ${p.is_enabled ? "text-emerald-400" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{p.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">v{p.version}</span>
                        <span className="text-[10px] text-muted-foreground">·</span>
                        <span className="text-[10px] text-muted-foreground">{CATEGORY_LABELS[p.category] ?? p.category}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{p.description}</p>
                  <Button
                    size="sm" variant={p.is_enabled ? "default" : "outline"}
                    className={`w-full text-xs ${p.is_enabled ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
                    onClick={() => toggle(p.id)}>
                    {p.is_enabled ? (
                      <><CircleCheck className="h-3.5 w-3.5 ml-1.5" />مفعّل</>
                    ) : (
                      <><Plus className="h-3.5 w-3.5 ml-1.5" />تفعيل</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   API CENTER
══════════════════════════════════════════════════ */
function ApiSection({ toast }: any) {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newKey, setNewKey] = useState({ name: "", scope: "read" });
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const d = await (await BASE("/studio/api-keys")).json(); setKeys(Array.isArray(d) ? d : []); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!newKey.name.trim()) return;
    const r = await BASE("/studio/api-keys", { method: "POST", body: JSON.stringify(newKey) });
    if (!r.ok) { toast({ title: (await r.json()).error, variant: "destructive" }); return; }
    const data = await r.json();
    setNewKeyValue(data.api_key);
    setRevealed(true);
    setNewKey({ name: "", scope: "read" });
    setShowForm(false); load();
  };

  const toggle = async (id: string) => {
    await BASE(`/studio/api-keys/${id}/toggle`, { method: "PATCH" });
    load();
  };

  const del = async (id: string) => {
    if (!confirm("حذف هذا المفتاح؟")) return;
    await BASE(`/studio/api-keys/${id}`, { method: "DELETE" });
    load();
  };

  const SCOPE_LABELS: Record<string, string> = { read: "قراءة فقط", write: "قراءة وكتابة", admin: "إدارة كاملة" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5"><Key className="h-4 w-4 text-orange-400" />مفاتيح API ({keys.length})</h3>
        <Button size="sm" onClick={() => setShowForm(v => !v)}><Plus className="h-3.5 w-3.5 ml-1" />مفتاح جديد</Button>
      </div>

      {/* New key alert */}
      {newKeyValue && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-emerald-300 mb-2">🎉 تم إنشاء المفتاح — احفظه الآن، لن يُعرض مجدداً!</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-muted/50 p-2 rounded" dir="ltr">
                {revealed ? newKeyValue : "•".repeat(newKeyValue.length)}
              </code>
              <button onClick={() => setRevealed(v => !v)} className="p-1.5 hover:bg-muted rounded">
                {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button onClick={() => { navigator.clipboard.writeText(newKeyValue); toast({ title: "تم النسخ!" }); }} className="p-1.5 hover:bg-muted rounded">
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <Button size="sm" variant="ghost" className="mt-2 text-xs" onClick={() => setNewKeyValue(null)}>
              حسناً، حفظته ✓
            </Button>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardContent className="p-4 space-y-2">
            <Input placeholder="اسم المفتاح (مثال: Mobile App)" value={newKey.name} onChange={e => setNewKey(p => ({ ...p, name: e.target.value }))} className="text-sm h-8" />
            <select value={newKey.scope} onChange={e => setNewKey(p => ({ ...p, scope: e.target.value }))}
              className="w-full bg-background border border-input rounded-md px-2 py-1 text-sm h-8">
              {Object.entries(SCOPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <div className="flex gap-1.5 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>إلغاء</Button>
              <Button size="sm" onClick={create}>إنشاء</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin h-6 w-6 text-orange-400" /></div>
        : keys.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border border-dashed border-border/50 rounded-xl">
            <Key className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">لا توجد مفاتيح API — أنشئ أول مفتاح</p>
          </div>
        ) : (
          <Card className="border-border/50"><CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {keys.map((k: any) => (
                <div key={k.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                  <Key className={`h-4 w-4 ${k.is_active ? "text-orange-400" : "text-muted-foreground"} flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{k.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${k.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                        {k.is_active ? "نشط" : "معطّل"}
                      </span>
                      <span className="text-[10px] bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded-full">{SCOPE_LABELS[k.scope] ?? k.scope}</span>
                    </div>
                    <code className="text-[10px] text-muted-foreground font-mono" dir="ltr">{k.api_key_preview}</code>
                  </div>
                  <button onClick={() => toggle(k.id)} className="p-1.5 rounded hover:bg-muted transition-colors">
                    {k.is_active ? <ToggleRight className="h-4 w-4 text-emerald-400" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  <button onClick={() => del(k.id)} className="p-1.5 rounded hover:bg-muted transition-colors">
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent></Card>
        )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   AI DEVELOPER
══════════════════════════════════════════════════ */
function AiSection({ toast }: any) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const EXAMPLES = [
    "أضف قسم المصاريف اليومية مع تقرير شهري",
    "أنشئ صفحة لإدارة الشهود في القضايا",
    "أضف نظام إدارة المهام مع الأولويات والمواعيد",
    "أنشئ قسماً لتتبع العقود ومدة صلاحيتها",
  ];

  const load = async () => {
    setLoading(true);
    try { const d = await (await BASE("/studio/ai-tasks")).json(); setTasks(Array.isArray(d) ? d : []); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  /* Poll for task completion */
  useEffect(() => {
    const pending = tasks.filter((t: any) => t.status === "pending");
    if (pending.length === 0) return;
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [tasks]);

  const send = async () => {
    if (!prompt.trim()) return;
    setSending(true);
    try {
      const r = await BASE("/studio/ai-tasks", { method: "POST", body: JSON.stringify({ prompt, taskType: "generate_module" }) });
      if (!r.ok) throw new Error((await r.json()).error);
      toast({ title: "تم إرسال الطلب — جاري المعالجة…" });
      setPrompt(""); load();
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    finally { setSending(false); }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      {/* Input panel */}
      <div className="md:col-span-2 space-y-4">
        {/* AI hero */}
        <div className="rounded-xl bg-gradient-to-br from-violet-900/30 to-pink-900/20 border border-violet-500/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-violet-400" />
            <span className="text-sm font-bold">AI Developer</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            اكتب بالعربية ما تريد إضافته للمنصة، وسيقوم النظام بتوليد:
          </p>
          <ul className="mt-2 space-y-1">
            {["Drizzle Schema", "API Routes", "React Page", "Nav Item"].map(i => (
              <li key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CircleCheck className="h-3 w-3 text-violet-400" />{i}
              </li>
            ))}
          </ul>
        </div>

        {/* Prompt */}
        <div className="space-y-2">
          <Textarea ref={promptRef} value={prompt} onChange={e => setPrompt(e.target.value)}
            placeholder="مثال: أضف قسم المصاريف اليومية مع تقرير شهري"
            className="text-sm min-h-[100px] resize-none" rows={4} />
          <Button className="w-full" onClick={send} disabled={sending || !prompt.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin ml-1.5" /> : <Send className="h-4 w-4 ml-1.5" />}
            إرسال للذكاء الاصطناعي
          </Button>
        </div>

        {/* Examples */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">أمثلة جاهزة:</p>
          <div className="space-y-1.5">
            {EXAMPLES.map(ex => (
              <button key={ex} onClick={() => { setPrompt(ex); promptRef.current?.focus(); }}
                className="w-full text-right text-xs px-3 py-2 rounded-lg border border-border/50 hover:bg-muted/30 hover:border-violet-500/30 transition-all text-muted-foreground">
                {ex}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tasks list + result */}
      <div className="md:col-span-3 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">سجل المهام ({tasks.length})</h3>
          <Button size="sm" variant="ghost" onClick={load}><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /></Button>
        </div>

        {loading && tasks.length === 0 ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin h-6 w-6 text-violet-400" /></div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border border-dashed border-border/50 rounded-xl">
            <Bot className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">لا توجد مهام بعد — أرسل أول طلب</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((t: any) => {
              let result: any = null;
              try { result = typeof t.result === "string" ? JSON.parse(t.result) : t.result; } catch {}
              return (
                <div key={t.id}>
                  <div
                    onClick={() => setSelectedTask(selectedTask?.id === t.id ? null : t)}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedTask?.id === t.id ? "border-violet-500/40 bg-violet-500/10" : "border-border/50 hover:bg-muted/20"
                    }`}>
                    <div className="mt-0.5">
                      {t.status === "pending" && <Loader2 className="h-4 w-4 animate-spin text-yellow-400" />}
                      {t.status === "completed" && <CircleCheck className="h-4 w-4 text-emerald-400" />}
                      {t.status === "failed" && <XCircle className="h-4 w-4 text-red-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{t.prompt}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleString("ar-SA")}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          t.status === "completed" ? "bg-emerald-500/15 text-emerald-400"
                          : t.status === "pending" ? "bg-yellow-500/15 text-yellow-400"
                          : "bg-red-500/15 text-red-400"
                        }`}>
                          {t.status === "completed" ? "مكتمل" : t.status === "pending" ? "جاري المعالجة" : "فشل"}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${selectedTask?.id === t.id ? "rotate-90" : ""}`} />
                  </div>

                  {selectedTask?.id === t.id && result && (
                    <Card className="mt-1 border-violet-500/20 bg-violet-500/5 rounded-t-none">
                      <CardContent className="p-4 space-y-3">
                        <p className="text-xs font-semibold text-violet-300">📄 الكود المُولَّد</p>
                        {Object.entries(result).map(([key, val]) => (
                          <div key={key}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-mono text-muted-foreground">{key}</span>
                              <button onClick={() => { navigator.clipboard.writeText(String(val)); toast({ title: "تم النسخ!" }); }}
                                className="text-[10px] text-violet-400 hover:text-violet-300 flex items-center gap-1">
                                <Copy className="h-3 w-3" />نسخ
                              </button>
                            </div>
                            <pre className="text-[10px] font-mono bg-muted/50 p-2.5 rounded-lg overflow-x-auto leading-relaxed text-muted-foreground" dir="ltr">
                              {String(val)}
                            </pre>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
