import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Globe, Link2, Copy, CheckCircle2, Plus, Trash2, Clock,
  Eye, Shield, ExternalLink, RefreshCw, Loader2, Settings,
  GitCommitHorizontal, ShieldCheck, Users, Lock,
  UserPlus, KeyRound, Mail, Phone, EyeOff, ClipboardCopy, UserCheck,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL ?? "/";

type PortalToken = {
  id: string; case_id: string; token: string; client_email: string;
  client_name: string; expires_at: string; last_accessed: string;
  access_count: number; created_at: string;
  show_invoices: boolean; show_timeline: boolean; allowed_to_upload: boolean;
};

type Case = { id: string; title: string; status: string; caseType: string; clientName: string };

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
      {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

// ─── New Token Dialog ─────────────────────────────────────────────────────────
function NewTokenDialog({ cases, onCreated }: { cases: Case[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [caseId, setCaseId] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [expiryDays, setExpiryDays] = useState(30);
  const [showInvoices, setShowInvoices] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);
  const [allowedToUpload, setAllowedToUpload] = useState(false);
  const [result, setResult] = useState<{ url: string; token: string; expiresAt: string } | null>(null);

  const create = useMutation({
    mutationFn: () =>
      fetch(`${BASE}api/portal/create-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, clientEmail, clientName, expiryDays, showInvoices, showTimeline, allowedToUpload }),
      }).then(r => r.json()),
    onSuccess: (data) => {
      if (data?.error) { toast.error(data.error); return; }
      setResult(data);
      onCreated();
    },
    onError: () => toast.error("فشل إنشاء الرابط"),
  });

  const reset = () => { setResult(null); setCaseId(""); setClientEmail(""); setClientName(""); };

  return (
    <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />رابط بوابة جديد</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />إنشاء بوابة عميل
          </DialogTitle>
        </DialogHeader>
        {result ? (
          <div className="space-y-4 pt-2">
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto" />
              <p className="font-semibold text-green-400">تم إنشاء الرابط بنجاح!</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">رابط البوابة (أرسله للعميل)</Label>
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2.5">
                <span className="text-xs font-mono flex-1 truncate text-primary">{result.url}</span>
                <CopyButton text={result.url} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              صالح حتى: {new Date(result.expiresAt).toLocaleDateString("ar-SA")}
            </p>
            <div className="flex gap-2">
              <Button className="flex-1" variant="outline" asChild>
                <a href={result.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 ml-2" />معاينة
                </a>
              </Button>
              <Button className="flex-1" onClick={() => setOpen(false)}>إغلاق</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>القضية *</Label>
              <select value={caseId} onChange={e => setCaseId(e.target.value)}
                className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm">
                <option value="">اختر القضية</option>
                {cases.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>اسم العميل</Label>
                <Input placeholder="أحمد المطيري" value={clientName} onChange={e => setClientName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>البريد الإلكتروني</Label>
                <Input type="email" placeholder="client@mail.com" value={clientEmail} onChange={e => setClientEmail(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>مدة الصلاحية (يوم)</Label>
              <Input type="number" min={1} max={365} value={expiryDays} onChange={e => setExpiryDays(Number(e.target.value))} />
            </div>
            {/* Permissions */}
            <div className="space-y-2.5 rounded-xl border border-border/50 bg-muted/20 p-3">
              <p className="text-xs font-semibold text-muted-foreground">صلاحيات العميل في البوابة</p>
              {[
                { label: "إظهار الفواتير",        desc: "يرى الفواتير وروابط الدفع",        val: showInvoices,     set: setShowInvoices },
                { label: "إظهار مراحل القضية",    desc: "يرى الخط الزمني للتحديثات",       val: showTimeline,     set: setShowTimeline },
                { label: "السماح برفع مستندات",   desc: "يمكنه رفع ملفات مطلوبة منه",      val: allowedToUpload,  set: setAllowedToUpload },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch checked={item.val} onCheckedChange={item.set} />
                </div>
              ))}
            </div>
            <Button className="w-full" onClick={() => create.mutate()} disabled={!caseId || create.isPending}>
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Link2 className="h-4 w-4 ml-2" />}
              إنشاء الرابط
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Timeline Event Dialog ────────────────────────────────────────────────
function AddTimelineDialog({ caseId, onAdded }: { caseId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [entryType, setEntryType] = useState("note");
  const [happenedAt, setHappenedAt] = useState(new Date().toISOString().slice(0, 10));
  const [isShared, setIsShared] = useState(true);

  const add = useMutation({
    mutationFn: () =>
      fetch(`${BASE}api/portal/timeline/${caseId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, entryType, happenedAt, isShared }),
      }).then(r => r.json()),
    onSuccess: (d) => {
      if (d?.error) { toast.error(d.error); return; }
      toast.success(isShared ? "تم إضافة التحديث وإشعار العميل ✅" : "تم إضافة الحدث ✅");
      setOpen(false); setTitle(""); setDescription("");
      onAdded();
    },
    onError: () => toast.error("فشل إضافة الحدث"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10">
          <GitCommitHorizontal className="h-3 w-3" />إضافة تحديث
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCommitHorizontal className="h-4 w-4 text-primary" />إضافة حدث للخط الزمني
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>نوع الحدث</Label>
            <Select value={entryType} onValueChange={setEntryType}>
              <SelectTrigger dir="rtl"><SelectValue /></SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="note">ملاحظة</SelectItem>
                <SelectItem value="hearing">جلسة محكمة</SelectItem>
                <SelectItem value="meeting">اجتماع</SelectItem>
                <SelectItem value="document">وثيقة مضافة</SelectItem>
                <SelectItem value="status_change">تغيير الحالة</SelectItem>
                <SelectItem value="payment">دفعة مالية</SelectItem>
                <SelectItem value="reminder">تذكير</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>عنوان التحديث *</Label>
            <Input placeholder="مثال: تمت جلسة المحكمة بنجاح" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>التفاصيل (اختياري)</Label>
            <Textarea placeholder="أضف تفاصيل إضافية للعميل..." rows={2} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>تاريخ الحدث</Label>
            <Input type="date" value={happenedAt} onChange={e => setHappenedAt(e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 p-3">
            <div>
              <p className="text-xs font-medium">مشاركة مع العميل</p>
              <p className="text-[10px] text-muted-foreground">يظهر في بوابة العميل ويُرسل إشعار بالبريد</p>
            </div>
            <Switch checked={isShared} onCheckedChange={setIsShared} />
          </div>
          <Button className="w-full" onClick={() => add.mutate()} disabled={!title || add.isPending}>
            {add.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <CheckCircle2 className="h-4 w-4 ml-2" />}
            إضافة التحديث
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Settings Panel ───────────────────────────────────────────────────────────
function TokenSettingsPanel({ token, onSaved }: { token: PortalToken; onSaved: () => void }) {
  const [showInvoices, setShowInvoices] = useState(token.show_invoices !== false);
  const [showTimeline, setShowTimeline] = useState(token.show_timeline !== false);
  const [allowedToUpload, setAllowedToUpload] = useState(token.allowed_to_upload === true);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const r = await fetch(`${BASE}api/portal/tokens/${token.id}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showInvoices, showTimeline, allowedToUpload }),
    });
    const d = await r.json();
    if (d?.error) toast.error(d.error);
    else { toast.success("تم حفظ الإعدادات"); onSaved(); }
    setSaving(false);
  };

  return (
    <div className="mt-3 pt-3 border-t border-border/30 space-y-2.5">
      <p className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
        <Settings className="h-3 w-3" />صلاحيات البوابة
      </p>
      {[
        { label: "إظهار الفواتير",       val: showInvoices,    set: setShowInvoices },
        { label: "إظهار مراحل القضية",   val: showTimeline,    set: setShowTimeline },
        { label: "السماح برفع مستندات",  val: allowedToUpload, set: setAllowedToUpload },
      ].map(item => (
        <div key={item.label} className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <Switch checked={item.val} onCheckedChange={item.set} className="scale-75" />
        </div>
      ))}
      <Button size="sm" className="w-full h-7 text-xs mt-1" onClick={save} disabled={saving}>
        {saving && <Loader2 className="h-3 w-3 animate-spin ml-1" />}حفظ الإعدادات
      </Button>
    </div>
  );
}

// ─── Create Client Account Dialog ────────────────────────────────────────────
function CreateClientAccountDialog({ cases, onCreated }: { cases: Case[]; onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "done">("form");
  const [email, setEmail]   = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]     = useState("");
  const [phone, setPhone]   = useState("");
  const [caseId, setCaseId] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string; name: string | null } | null>(null);
  const [copied, setCopied] = useState(false);

  // auto-generate a strong readable password
  const genPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!";
    const pw = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    setPassword(pw); setShowPw(true);
  };

  const reset = () => {
    setStep("form"); setEmail(""); setPassword(""); setName(""); setPhone(""); setCaseId(""); setShowPw(false); setCreated(null); setCopied(false);
  };

  const submit = async () => {
    if (!email) { toast.error("البريد الإلكتروني مطلوب"); return; }
    if (!password || password.length < 6) { toast.error("كلمة مرور 6 أحرف على الأقل"); return; }
    setLoading(true);

    // If a case is selected, get the portal token for it if available
    let portalToken: string | undefined;
    if (caseId) {
      const r = await fetch(`${BASE}api/portal/tokens/${caseId}`).then(r => r.json()).catch(() => []);
      const tokens: any[] = Array.isArray(r) ? r : [];
      portalToken = tokens[0]?.token;
    }

    const r = await fetch(`${BASE}api/client-auth/admin-create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: name || null, phone: phone || null, caseId: caseId || null, portalToken }),
    });
    const d = await r.json();
    setLoading(false);

    if (d.error) { toast.error(d.error); return; }
    setCreated({ email, password, name: name || null });
    setStep("done");
    onCreated?.();
  };

  const credText = `بوابة عدالة AI — بيانات دخولك\n\nالرابط: ${window.location.origin}${BASE.replace(/\/$/, "")}/portal/login\nالبريد: ${created?.email}\nكلمة المرور: ${created?.password}\n\nيمكنك تغيير كلمة المرور بعد الدخول.`;

  const copyAll = () => {
    navigator.clipboard.writeText(credText);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
    toast.success("تم نسخ بيانات الدخول");
  };

  return (
    <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <UserPlus className="h-3.5 w-3.5" />إنشاء حساب عميل
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "form"
              ? <><UserPlus className="h-5 w-5 text-primary" />إنشاء حساب لعميل</>
              : <><UserCheck className="h-5 w-5 text-green-500" />تم إنشاء الحساب بنجاح</>}
          </DialogTitle>
        </DialogHeader>

        {step === "form" ? (
          <div className="space-y-4 pt-1">
            {/* Email */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-muted-foreground" />البريد الإلكتروني *</Label>
              <Input type="email" placeholder="client@example.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-muted-foreground" />كلمة المرور *</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showPw ? "text" : "password"}
                    placeholder="6 أحرف على الأقل"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="pl-9"
                  />
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={genPassword} className="shrink-0 text-xs px-3">
                  <KeyRound className="h-3.5 w-3.5 ml-1" />توليد
                </Button>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-xs">الاسم الكامل (اختياري)</Label>
              <Input placeholder="محمد الأحمدي" value={name} onChange={e => setName(e.target.value)} />
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" />رقم الجوال (اختياري)</Label>
              <Input placeholder="05xxxxxxxx" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>

            {/* Link to case */}
            {cases.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">ربط بقضية (اختياري)</Label>
                <Select value={caseId} onValueChange={setCaseId}>
                  <SelectTrigger dir="rtl"><SelectValue placeholder="اختر قضية — سيُربط الحساب بها تلقائياً" /></SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="">بدون ربط بقضية</SelectItem>
                    {cases.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.title} — {c.clientName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button className="w-full" onClick={submit} disabled={loading || !email || !password}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <UserPlus className="h-4 w-4 ml-2" />}
              إنشاء الحساب
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {/* Success banner */}
            <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                <UserCheck className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="font-bold text-green-400 text-sm">تم إنشاء الحساب بنجاح!</p>
                <p className="text-xs text-muted-foreground">شارك بيانات الدخول أدناه مع العميل مرة واحدة فقط</p>
              </div>
            </div>

            {/* Credentials box */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
              <p className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" />بيانات دخول العميل — احتفظ بها بأمان
              </p>
              <div className="space-y-2">
                {[
                  { label: "رابط الدخول", value: `${window.location.origin}${BASE.replace(/\/$/, "")}/portal/login` },
                  { label: "البريد",       value: created?.email ?? "" },
                  { label: "كلمة المرور", value: created?.password ?? "", mono: true },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between gap-2 bg-background/40 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground">{row.label}</p>
                      <p className={`text-xs truncate ${row.mono ? "font-mono font-bold tracking-wide" : ""}`}>{row.value}</p>
                    </div>
                    <button onClick={() => { navigator.clipboard.writeText(row.value); toast.success("تم النسخ"); }}
                      className="text-muted-foreground hover:text-foreground shrink-0">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <Button className="w-full gap-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30" variant="outline" onClick={copyAll}>
                {copied ? <CheckCircle2 className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
                نسخ جميع بيانات الدخول
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground text-center">
              ⚠️ لن تظهر كلمة المرور مرة أخرى — شاركها الآن أو اطبعها
            </p>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={reset}>إنشاء حساب آخر</Button>
              <Button className="flex-1" onClick={() => { setOpen(false); reset(); }}>تم</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Comm Settings Dialog ─────────────────────────────────────────────────────
const ACTION_LABELS: Record<string, { label: string; desc: string }> = {
  reply:    { label: "الرد على العملاء",        desc: "إرسال رسائل ومشاركة وثائق عبر بوابة العميل" },
  portal:   { label: "إدارة بوابة العملاء",     desc: "إنشاء وإلغاء وتعديل روابط البوابة" },
  timeline: { label: "إرسال تحديثات للعملاء",  desc: "إضافة أحداث مشتركة في الخط الزمني" },
  intake:   { label: "استقبال قضايا جديدة",    desc: "إنشاء قضايا من طلبات العملاء الواردة" },
};

type CommSettings = {
  reply_roles: string[];
  portal_roles: string[];
  timeline_roles: string[];
  intake_roles: string[];
  require_reply_approval: boolean;
  allRoles: { value: string; label: string }[];
  isAdmin: boolean;
  currentUserRole: string;
};

function CommSettingsDialog() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Partial<CommSettings>>({});

  const { data: settings, isLoading, refetch } = useQuery<CommSettings>({
    queryKey: ["comm-settings"],
    queryFn: () => fetch(`${BASE}api/comm-settings`).then(r => r.json()),
    enabled: open,
  });

  const merged = { ...settings, ...draft } as CommSettings;
  const allRoles = settings?.allRoles ?? [];

  const toggleRole = (action: string, role: string) => {
    const key = `${action}_roles` as keyof CommSettings;
    const current: string[] = (merged[key] as string[]) ?? [];
    const next = current.includes(role)
      ? current.filter(r => r !== role)
      : [...current, role];
    setDraft(d => ({ ...d, [key]: next }));
  };

  const save = async () => {
    setSaving(true);
    const body = {
      reply_roles:    merged.reply_roles,
      portal_roles:   merged.portal_roles,
      timeline_roles: merged.timeline_roles,
      intake_roles:   merged.intake_roles,
      require_reply_approval: merged.require_reply_approval,
    };
    const r = await fetch(`${BASE}api/comm-settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (d?.error) { toast.error(d.error); }
    else { toast.success("تم حفظ إعدادات صلاحيات التواصل ✅"); setDraft({}); setOpen(false); refetch(); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) setDraft({}); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" />صلاحيات التواصل
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />إعدادات صلاحيات التواصل مع العملاء
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !settings?.isAdmin ? (
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-600 flex gap-2 items-start">
            <Lock className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">عرض فقط</p>
              <p className="text-xs text-muted-foreground mt-0.5">يجب أن تكون مدير أو مالك المكتب لتعديل الصلاحيات.</p>
            </div>
          </div>
        ) : null}

        <div className="space-y-5 pt-1">
          {Object.entries(ACTION_LABELS).map(([action, { label, desc }]) => {
            const key = `${action}_roles` as keyof CommSettings;
            const selected: string[] = (merged[key] as string[]) ?? [];
            return (
              <div key={action} className="rounded-xl border border-border/40 p-3.5 space-y-2.5">
                <div className="flex items-start gap-2">
                  <Users className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {allRoles.map(role => {
                    const active = selected.includes(role.value);
                    return (
                      <button
                        key={role.value}
                        disabled={!settings?.isAdmin}
                        onClick={() => toggleRole(action, role.value)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                          active
                            ? "bg-primary text-primary-foreground border-primary font-medium"
                            : "bg-muted/40 text-muted-foreground border-border/50 hover:border-primary/40"
                        } ${!settings?.isAdmin ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        {role.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {settings?.isAdmin && (
            <div className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/20 p-3.5">
              <div>
                <p className="text-sm font-medium">طلب موافقة المدير على الردود</p>
                <p className="text-xs text-muted-foreground">يتطلب مراجعة ردود السكرتير والمتدربين قبل إرسالها</p>
              </div>
              <Switch
                checked={merged.require_reply_approval ?? false}
                onCheckedChange={v => setDraft(d => ({ ...d, require_reply_approval: v }))}
              />
            </div>
          )}
        </div>

        {settings?.isAdmin && (
          <Button className="w-full mt-2" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <CheckCircle2 className="h-4 w-4 ml-2" />}
            حفظ الإعدادات
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ClientPortal() {
  const qc = useQueryClient();
  const [expandedToken, setExpandedToken] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState<string | null>(null);

  const { data: cases = [] } = useQuery<Case[]>({
    queryKey: ["cases-list"],
    queryFn: () => fetch(`${BASE}api/cases`).then(r => r.json()).then(d => Array.isArray(d) ? d : d.cases ?? []),
  });

  const { data: allTokens = [], isLoading, refetch } = useQuery<PortalToken[]>({
    queryKey: ["portal-all-tokens"],
    queryFn: async () => {
      const results = await Promise.all(
        cases.slice(0, 30).map(c => fetch(`${BASE}api/portal/tokens/${c.id}`).then(r => r.json()))
      );
      return results.flat().filter(Boolean);
    },
    enabled: cases.length > 0,
  });

  const deleteToken = useMutation({
    mutationFn: (id: string) => fetch(`${BASE}api/portal/tokens/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => { toast.success("تم حذف الرابط"); qc.invalidateQueries({ queryKey: ["portal-all-tokens"] }); },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["portal-all-tokens"] });
  const getCaseName = (caseId: string) => cases.find(c => c.id === caseId)?.title ?? caseId;

  const stats = {
    total:    allTokens.length,
    active:   allTokens.filter(t => !t.expires_at || new Date(t.expires_at) > new Date()).length,
    accessed: allTokens.filter(t => t.access_count > 0).length,
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="h-7 w-7 text-primary" />بوابة العملاء
          </h1>
          <p className="text-muted-foreground mt-1">
            روابط آمنة • خط زمني للقضية • رفع مستندات • دفع إلكتروني
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button variant="outline" size="sm" onClick={refresh}><RefreshCw className="h-3.5 w-3.5" /></Button>
          <CreateClientAccountDialog cases={cases} onCreated={refresh} />
          <CommSettingsDialog />
          <NewTokenDialog cases={cases} onCreated={refresh} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "إجمالي الروابط", value: stats.total,    icon: Link2,  color: "text-primary",   bg: "bg-primary/10" },
          { label: "روابط نشطة",    value: stats.active,   icon: Shield, color: "text-green-400", bg: "bg-green-500/10" },
          { label: "تم الوصول",     value: stats.accessed, icon: Eye,    color: "text-blue-400",  bg: "bg-blue-500/10" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${s.bg}`}><Icon className={`h-4 w-4 ${s.color}`} /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* How It Works */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4 pb-4">
          <p className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />كيف تعمل بوابة العميل؟
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { step: "1", text: "أنشئ رابطاً مشفراً لقضية" },
              { step: "2", text: "أضف تحديثات للخط الزمني" },
              { step: "3", text: "العميل يتابع ويرفع مستندات" },
              { step: "4", text: "يدفع فواتيره إلكترونياً" },
            ].map(s => (
              <div key={s.step} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-bold shrink-0">{s.step}</span>
                {s.text}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tokens List */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-muted/30 animate-pulse" />)}</div>
      ) : allTokens.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Globe className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-muted-foreground">لا توجد روابط بعد</p>
            <p className="text-xs text-muted-foreground">أنشئ أول رابط لمشاركته مع عميلك</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {allTokens.map(token => {
            const isExpired = token.expires_at && new Date(token.expires_at) < new Date();
            const portalUrl = `${window.location.origin}/portal/${token.token}`;
            const isExpanded = expandedToken === token.id;
            const showSettings = settingsOpen === token.id;
            return (
              <Card key={token.id} className={isExpired ? "opacity-60 border-border/30" : "hover:border-primary/30 transition-all"}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-sm truncate">{getCaseName(token.case_id)}</span>
                        {token.client_name && <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400">{token.client_name}</Badge>}
                        <Badge variant="outline" className={`text-xs ${isExpired ? "border-red-500/30 text-red-400" : "border-green-500/30 text-green-400"}`}>
                          {isExpired ? "منتهي" : "نشط"}
                        </Badge>
                        {token.show_timeline && <Badge variant="outline" className="text-[10px] border-amber-500/20 text-amber-400">خط زمني</Badge>}
                        {token.allowed_to_upload && <Badge variant="outline" className="text-[10px] border-cyan-500/20 text-cyan-400">رفع ملفات</Badge>}
                      </div>
                      <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5 mt-2">
                        <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="text-xs font-mono flex-1 truncate text-muted-foreground">{portalUrl}</span>
                        <CopyButton text={portalUrl} />
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground flex-wrap">
                        {token.client_email && <span>{token.client_email}</span>}
                        <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{token.access_count} مشاهدة</span>
                        {token.last_accessed && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />آخر دخول: {new Date(token.last_accessed).toLocaleDateString("ar-SA")}</span>}
                        {token.expires_at && <span>ينتهي: {new Date(token.expires_at).toLocaleDateString("ar-SA")}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0 items-start">
                      <Button size="sm" variant="outline" className="text-xs h-7 gap-1 px-2" asChild>
                        <a href={portalUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3" />معاينة</a>
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-amber-400 hover:bg-amber-500/10"
                        title="إضافة تحديث للخط الزمني"
                        onClick={() => setExpandedToken(isExpanded ? null : token.id)}>
                        <GitCommitHorizontal className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground hover:text-foreground"
                        title="إعدادات البوابة"
                        onClick={() => setSettingsOpen(showSettings ? null : token.id)}>
                        <Settings className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 w-7 p-0"
                        onClick={() => deleteToken.mutate(token.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {showSettings && (
                    <TokenSettingsPanel token={token} onSaved={() => { setSettingsOpen(null); refresh(); }} />
                  )}

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-border/30">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-muted-foreground">أضف تحديثاً يظهر في بوابة العميل مباشرة</p>
                        <AddTimelineDialog caseId={token.case_id} onAdded={refresh} />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
