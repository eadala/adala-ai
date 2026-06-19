import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard, Copy, ExternalLink, Loader2, Check,
  FileText, User, Mail, DollarSign, Calendar, AlignLeft,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type BillingType = "one_time" | "monthly" | "annual";

interface InvoiceResult {
  url: string;
  sessionId: string;
  qrCode?: string;
  amount: number;
  planName: string;
}

export function CustomInvoiceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<InvoiceResult | null>(null);
  const [copied,   setCopied]   = useState(false);

  const [form, setForm] = useState({
    clientName:   "",
    clientEmail:  "",
    planName:     "باقة مخصصة",
    description:  "",
    amount:       "",
    billingType:  "one_time" as BillingType,
    notes:        "",
  });

  function update(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }));
  }

  const billingTypes: { id: BillingType; label: string; desc: string; icon: string }[] = [
    { id: "one_time", label: "دفعة واحدة",  desc: "فاتورة مرة واحدة",    icon: "💳" },
    { id: "monthly",  label: "شهري",         desc: "اشتراك شهري متكرر",   icon: "📅" },
    { id: "annual",   label: "سنوي",          desc: "اشتراك سنوي متكرر",   icon: "🗓️" },
  ];

  function reset() {
    setResult(null);
    setForm({ clientName: "", clientEmail: "", planName: "باقة مخصصة", description: "", amount: "", billingType: "one_time", notes: "" });
  }

  async function handleCreate() {
    if (!form.clientName.trim())  { toast({ title: "أدخل اسم العميل",     variant: "destructive" }); return; }
    if (!form.clientEmail.trim()) { toast({ title: "أدخل بريد العميل",    variant: "destructive" }); return; }
    if (!form.planName.trim())    { toast({ title: "أدخل اسم الباقة",     variant: "destructive" }); return; }
    const amt = parseFloat(form.amount);
    if (!form.amount || isNaN(amt) || amt <= 0) { toast({ title: "أدخل مبلغاً صحيحاً", variant: "destructive" }); return; }

    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/billing/custom-invoice-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName:  form.clientName,
          clientEmail: form.clientEmail,
          planName:    form.planName,
          description: form.description,
          amount:      amt,
          billingType: form.billingType,
          notes:       form.notes,
        }),
      });
      const data = await r.json();
      if (!r.ok || data.error) {
        toast({ title: "خطأ", description: data.error ?? "فشل إنشاء رابط الدفع", variant: "destructive" });
      } else {
        setResult({ url: data.url, sessionId: data.sessionId, amount: amt, planName: form.planName });
      }
    } catch {
      toast({ title: "خطأ في الاتصال", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!result) return;
    await navigator.clipboard.writeText(result.url);
    setCopied(true);
    toast({ title: "✅ تم نسخ الرابط!", description: "أرسل الرابط للعميل لإتمام الدفع" });
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border-border/60"
        style={{ background: "linear-gradient(160deg,#0F1729 0%,#111827 100%)" }}>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/5"
          style={{ background: "rgba(245,158,11,0.04)" }}>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border-2 border-amber-500/30 flex items-center justify-center">
                <FileText className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black">فاتورة مخصصة</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  أنشئ رابط دفع لأي عميل بمبلغ ومواصفات مخصصة
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {!result ? (
          /* ── Form ── */
          <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">

            {/* Client info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <User className="h-3 w-3" /> اسم العميل *
                </label>
                <Input placeholder="مثال: مكتب الأنصاري"
                  value={form.clientName} onChange={e => update("clientName", e.target.value)}
                  className="bg-white/5 border-white/10 text-sm h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Mail className="h-3 w-3" /> البريد الإلكتروني *
                </label>
                <Input placeholder="client@example.com" type="email"
                  value={form.clientEmail} onChange={e => update("clientEmail", e.target.value)}
                  className="bg-white/5 border-white/10 text-sm h-9 text-left" dir="ltr" />
              </div>
            </div>

            {/* Plan name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <CreditCard className="h-3 w-3" /> اسم الباقة / الخدمة *
              </label>
              <Input placeholder="مثال: باقة النخبة المخصصة — مكتب الأنصاري"
                value={form.planName} onChange={e => update("planName", e.target.value)}
                className="bg-white/5 border-white/10 text-sm h-9" />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <AlignLeft className="h-3 w-3" /> وصف الباقة (سيظهر في صفحة الدفع)
              </label>
              <Input placeholder="مثال: قضايا غير محدودة · ١٠٠ مستخدم · دعم مخصص ٢٤/٧"
                value={form.description} onChange={e => update("description", e.target.value)}
                className="bg-white/5 border-white/10 text-sm h-9" />
            </div>

            {/* Amount + billing type */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <DollarSign className="h-3 w-3" /> المبلغ (ريال سعودي) *
                </label>
                <div className="relative">
                  <Input placeholder="0.00" type="number" min="1" step="0.01"
                    value={form.amount} onChange={e => update("amount", e.target.value)}
                    className="bg-white/5 border-white/10 text-sm h-9 pl-12 text-left" dir="ltr" />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-bold">SAR</span>
                </div>
                {form.amount && !isNaN(parseFloat(form.amount)) && (
                  <p className="text-[10px] text-amber-400">
                    + ضريبة 15% = {(parseFloat(form.amount) * 1.15).toFixed(2)} ر.س
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" /> نوع الدفع
                </label>
                <div className="flex flex-col gap-1">
                  {billingTypes.map(bt => (
                    <button key={bt.id} onClick={() => update("billingType", bt.id)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border text-right",
                        form.billingType === bt.id
                          ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                          : "bg-white/3 border-white/8 text-muted-foreground hover:text-foreground"
                      )}>
                      <span>{bt.icon}</span>
                      <span className="font-semibold">{bt.label}</span>
                      <span className="text-[10px] opacity-60 mr-auto">{bt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">ملاحظات داخلية (لا تظهر للعميل)</label>
              <Input placeholder="مثال: عقد مخصص — تم التفاوض بتاريخ ١٥/٦"
                value={form.notes} onChange={e => update("notes", e.target.value)}
                className="bg-white/5 border-white/10 text-sm h-9" />
            </div>

            {/* Footer */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 border-white/10 bg-white/5" onClick={() => { reset(); onClose(); }}>
                إلغاء
              </Button>
              <Button className="flex-1 gap-2 bg-amber-500 hover:bg-amber-600 text-black font-bold"
                onClick={handleCreate} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                إنشاء رابط الدفع
              </Button>
            </div>
          </div>
        ) : (
          /* ── Result ── */
          <div className="px-6 py-6 space-y-5">
            {/* Success state */}
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/30 flex items-center justify-center animate-in zoom-in-50 duration-300">
                <Check className="h-8 w-8 text-emerald-400" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-black text-emerald-400">تم إنشاء رابط الدفع!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  فاتورة لـ <span className="font-bold text-foreground">{form.clientName}</span>
                  {" · "}
                  <span className="text-amber-400 font-bold">{result.amount.toLocaleString("ar-SA")} ر.س</span>
                  {form.billingType !== "one_time" && ` / ${form.billingType === "monthly" ? "شهر" : "سنة"}`}
                </p>
              </div>
            </div>

            {/* Plan summary */}
            <div className="rounded-2xl bg-amber-500/5 border border-amber-500/20 p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">الباقة</span>
                <span className="font-bold">{result.planName}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">نوع الدفع</span>
                <Badge className="text-[10px] bg-amber-500/10 text-amber-300 border-amber-500/25 border">
                  {form.billingType === "one_time" ? "💳 دفعة واحدة" : form.billingType === "monthly" ? "📅 شهري" : "🗓️ سنوي"}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">المبلغ (شامل الضريبة)</span>
                <span className="font-black text-lg text-amber-400">{(result.amount * 1.15).toFixed(2)} ر.س</span>
              </div>
            </div>

            {/* Link box */}
            <div className="rounded-xl bg-white/5 border border-white/10 p-3">
              <p className="text-[10px] text-muted-foreground mb-1.5">رابط الدفع للعميل</p>
              <p className="text-xs font-mono text-foreground/80 truncate mb-3 select-all">{result.url}</p>
              <div className="flex gap-2">
                <Button className="flex-1 gap-2 font-bold" onClick={copyLink}
                  variant={copied ? "default" : "outline"}
                  style={copied ? { background: "rgb(16,185,129)", color: "#fff" } : {}}>
                  {copied ? <><Check className="h-4 w-4" /> تم النسخ!</> : <><Copy className="h-4 w-4" /> نسخ الرابط</>}
                </Button>
                <Button className="gap-2" variant="outline"
                  onClick={() => window.open(result.url, "_blank", "noopener,noreferrer")}>
                  <ExternalLink className="h-4 w-4" /> فتح
                </Button>
              </div>
            </div>

            {/* Share tips */}
            <div className="rounded-xl bg-blue-500/5 border border-blue-500/15 p-3 space-y-1.5 text-xs text-muted-foreground">
              <p className="font-semibold text-blue-400 text-[11px]">كيف تشارك الرابط؟</p>
              <p>📧 أرسله عبر البريد الإلكتروني أو واتساب لـ {form.clientEmail}</p>
              <p>🔒 الدفع مشفّر عبر Stripe — آمن 100% للعميل</p>
              <p>⚡ بمجرد السداد، يُفعَّل الاشتراك تلقائياً</p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 border-white/10 bg-white/5 text-xs"
                onClick={reset}>
                + إنشاء فاتورة جديدة
              </Button>
              <Button className="flex-1 text-xs gap-1.5" onClick={() => { reset(); onClose(); }}>
                <Check className="h-3.5 w-3.5" /> تم
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
