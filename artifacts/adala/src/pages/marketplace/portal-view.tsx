import { useState, useRef, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Scale, FileText, Receipt, MessageSquare, CheckCircle2, Clock,
  Send, Loader2, Shield, AlertCircle, User, Calendar,
  Upload, CloudUpload, UploadCloud, FileCheck, ChevronDown,
  GitCommitHorizontal, Gavel, FileSignature, BellRing,
  FileUp, Banknote, X, UserCircle2, LogIn, Sparkles,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL ?? "/";

// ─── Client Account Banner ─────────────────────────────────────────────────────
function ClientAccountBanner({ portalToken }: { portalToken: string }) {
  const [, nav] = useLocation();
  const [linked, setLinked] = useState(false);
  const [linking, setLinking] = useState(false);
  const clientInfo = typeof window !== "undefined" ? sessionStorage.getItem("client_info") : null;
  const client = clientInfo ? JSON.parse(clientInfo) : null;
  const [hasSession, setHasSession] = useState(false);

  // Check if user has active session via cookie (fire-and-forget auth check)
  useEffect(() => {
    fetch(`${BASE}/api/client-auth/me`, { credentials: "include" })
      .then(r => { if (r.ok) setHasSession(true); })
      .catch(() => {});
  }, []);

  // Auto-link token to account if logged in
  useEffect(() => {
    if (!hasSession || !portalToken || linked) return;
    fetch(`${BASE}/api/client-auth/link-token`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portalToken }),
    }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }).then(d => { if (!d.error) setLinked(true); }).catch(() => {});
  }, [hasSession, portalToken]);

  if (hasSession && client) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
            <UserCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-400">
              {linked ? "✓ تم ربط القضية بحسابك" : "مسجّل دخول كـ " + (client.name ?? client.email)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              يمكنك متابعة جميع قضاياك من حسابك
            </p>
          </div>
        </div>
        <button onClick={() => nav("/portal/my-cases")}
          className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl px-3 py-1.5 hover:bg-emerald-500/30 transition-colors font-medium whitespace-nowrap">
          قضاياي
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#C9A84C]/5 border border-[#C9A84C]/20 rounded-2xl p-3.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-[#C9A84C]/15 flex items-center justify-center shrink-0">
          <Sparkles className="h-4 w-4 text-[#C9A84C]" />
        </div>
        <div>
          <p className="text-xs font-bold text-[#C9A84C]">احفظ قضيتك في حسابك</p>
          <p className="text-[10px] text-muted-foreground">
            سجّل الدخول لتتابع جميع قضاياك من مكان واحد
          </p>
        </div>
      </div>
      <button onClick={() => nav("/portal/login")}
        className="text-xs bg-[#C9A84C] text-[#0d1b2a] font-bold rounded-xl px-3 py-1.5 hover:bg-[#b8933e] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0">
        <LogIn className="h-3.5 w-3.5" />دخول / تسجيل
      </button>
    </div>
  );
}

const STATUS_AR: Record<string, { label: string; color: string; bg: string }> = {
  open:        { label: "مفتوحة",      color: "text-blue-400",   bg: "bg-blue-500/15 border-blue-500/30" },
  in_progress: { label: "قيد التنفيذ", color: "text-amber-400",  bg: "bg-amber-500/15 border-amber-500/30" },
  closed:      { label: "مغلقة",       color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30" },
};

const INV_STATUS: Record<string, { label: string; color: string }> = {
  paid:    { label: "مدفوعة", color: "text-emerald-400" },
  sent:    { label: "مُرسَلة", color: "text-blue-400" },
  draft:   { label: "مسودة",  color: "text-gray-400" },
  overdue: { label: "متأخرة", color: "text-red-400" },
};

const CASE_TYPE: Record<string, string> = {
  criminal: "جنائية", civil: "مدنية", commercial: "تجارية",
  labor: "عمالية", real_estate: "عقارية",
};

const TIMELINE_ICONS: Record<string, React.ReactNode> = {
  hearing:       <Gavel className="h-4 w-4" />,
  meeting:       <User className="h-4 w-4" />,
  document:      <FileText className="h-4 w-4" />,
  note:          <FileSignature className="h-4 w-4" />,
  status_change: <GitCommitHorizontal className="h-4 w-4" />,
  upload:        <UploadCloud className="h-4 w-4" />,
  reminder:      <BellRing className="h-4 w-4" />,
  payment:       <Banknote className="h-4 w-4" />,
};

const TIMELINE_COLORS: Record<string, string> = {
  hearing:       "bg-red-500/20 text-red-400 border-red-500/30",
  meeting:       "bg-blue-500/20 text-blue-400 border-blue-500/30",
  document:      "bg-violet-500/20 text-violet-400 border-violet-500/30",
  note:          "bg-amber-500/20 text-amber-400 border-amber-500/30",
  status_change: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  upload:        "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  reminder:      "bg-orange-500/20 text-orange-400 border-orange-500/30",
  payment:       "bg-green-500/20 text-green-400 border-green-500/30",
};

export default function PortalView() {
  const [, params] = useRoute("/portal/:token");
  const token = params?.token ?? "";
  const [msgText, setMsgText] = useState("");
  const [msgSender, setMsgSender] = useState("");
  const [msgEmail, setMsgEmail] = useState("");
  const [msgSent, setMsgSent] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["portal-view", token],
    queryFn: () => fetch(`${BASE}/api/portal/${token}`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    enabled: !!token,
    retry: false,
  });

  const sendMessage = useMutation({
    mutationFn: () => fetch(`${BASE}/api/portal/${token}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msgText, senderName: msgSender, senderEmail: msgEmail }),
    }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: (d) => {
      if (d?.error) { toast.error(d.error); return; }
      toast.success("تم إرسال رسالتك ✅");
      setMsgSent(true); setMsgText("");
    },
    onError: () => toast.error("فشل إرسال الرسالة"),
  });

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const fileData = (e.target?.result as string)?.split(",")[1];
        const r = await fetch(`${BASE}/api/portal/${token}/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: uploadFile.name,
            fileType: uploadFile.type,
            fileSize: uploadFile.size,
            fileData,
          }),
        });
        const d = await r.json();
        if (d?.error) { toast.error(d.error); }
        else { toast.success("تم رفع المستند بنجاح ✅"); setUploadFile(null); refetch(); }
        setUploading(false);
      };
      reader.readAsDataURL(uploadFile);
    } catch {
      toast.error("فشل رفع الملف");
      setUploading(false);
    }
  };

  if (!token) return <ErrorPage msg="رابط غير صالح" />;
  if (isLoading) return <LoadingPage />;
  if (error || data?.error) return <ErrorPage msg={data?.error ?? "حدث خطأ"} />;

  const { portal, case: c, invoices = [], documents = [], timeline = [], uploads = [] } = data as any;
  const status = STATUS_AR[c?.status] ?? STATUS_AR.open;
  const unpaidInvoices = invoices.filter((i: any) => i.status === "sent" || i.status === "overdue");
  const totalUnpaid = unpaidInvoices.reduce((s: number, i: any) => s + Number(i.total ?? i.amount ?? 0), 0);

  return (
    <div dir="rtl" className="min-h-screen bg-[#0d1b2a] text-foreground" style={{ fontFamily: "'Cairo', sans-serif" }}>
      {/* Header */}
      <div className="bg-[#0a1520] border-b border-[#C9A84C]/20 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-[#C9A84C]" />
            <span className="font-black text-[#C9A84C]">عدالة AI</span>
            <span className="text-xs text-muted-foreground mr-1">| بوابة العميل</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-emerald-400">رابط آمن ومشفر</span>
            <Shield className="h-3 w-3 text-emerald-400" />
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* Welcome Banner */}
        {portal?.clientName && (
          <div className="bg-gradient-to-l from-[#C9A84C]/5 to-[#C9A84C]/15 border border-[#C9A84C]/30 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-[#C9A84C]/20 flex items-center justify-center">
                <User className="h-5 w-5 text-[#C9A84C]" />
              </div>
              <div>
                <p className="font-bold text-[#C9A84C] text-lg">مرحباً، {portal.clientName}</p>
                <p className="text-xs text-muted-foreground">هذه بوابتك الآمنة لمتابعة قضيتك القانونية</p>
              </div>
            </div>
            {portal.expiresAt && (
              <div className="mt-3 pt-3 border-t border-[#C9A84C]/20 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                صلاحية الوصول حتى: {new Date(portal.expiresAt).toLocaleDateString("ar-SA")}
              </div>
            )}
          </div>
        )}

        {/* Client Account Banner */}
        <ClientAccountBanner portalToken={token} />

        {/* Unpaid Invoice Alert */}
        {unpaidInvoices.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-amber-400 shrink-0" />
              <p className="text-sm text-amber-300">
                لديك {unpaidInvoices.length === 1 ? "فاتورة" : `${unpaidInvoices.length} فواتير`} مستحقة بإجمالي{" "}
                <span className="font-bold">{totalUnpaid.toLocaleString("ar-SA")} ر.س</span>
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-amber-400 shrink-0" />
          </div>
        )}

        {/* Case Card */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Scale className="h-4 w-4 text-[#C9A84C]" />تفاصيل القضية
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1">
                <h2 className="font-bold text-xl leading-tight">{c?.title}</h2>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant="outline" className={`text-xs ${status.bg} ${status.color}`}>{status.label}</Badge>
                  {c?.caseType && (
                    <Badge variant="outline" className="text-xs border-[#C9A84C]/30 text-[#C9A84C]">
                      {CASE_TYPE[c.caseType] ?? c.caseType}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            {c?.description && (
              <p className="text-sm text-muted-foreground leading-relaxed border-r-2 border-[#C9A84C]/40 pr-3">{c.description}</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {c?.clientName && (
                <div className="bg-muted/20 rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1"><User className="h-3 w-3" />المُوكّل</p>
                  <p className="text-sm font-semibold">{c.clientName}</p>
                </div>
              )}
              {c?.createdAt && (
                <div className="bg-muted/20 rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1"><Calendar className="h-3 w-3" />تاريخ الفتح</p>
                  <p className="text-sm font-semibold">{new Date(c.createdAt).toLocaleDateString("ar-SA")}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        {portal?.showTimeline !== false && timeline.length > 0 && (
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <GitCommitHorizontal className="h-4 w-4 text-[#C9A84C]" />مراحل القضية
                <Badge variant="outline" className="text-[10px] mr-auto">{timeline.length} تحديث</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute right-5 top-0 bottom-0 w-px bg-border/50" />
                <div className="space-y-5">
                  {timeline.map((event: any, idx: number) => {
                    const colorClass = TIMELINE_COLORS[event.entry_type] ?? TIMELINE_COLORS.note;
                    const icon = TIMELINE_ICONS[event.entry_type] ?? TIMELINE_ICONS.note;
                    const isLast = idx === timeline.length - 1;
                    return (
                      <div key={event.id} className="flex items-start gap-4">
                        {/* Icon dot */}
                        <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full border flex items-center justify-center ${colorClass}`}>
                          {icon}
                        </div>
                        {/* Content */}
                        <div className={`flex-1 pb-5 ${isLast ? "" : "border-b border-border/30"}`}>
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <p className="font-semibold text-sm">{event.title}</p>
                            <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {new Date(event.happened_at).toLocaleDateString("ar-SA", {
                                year: "numeric", month: "short", day: "numeric"
                              })}
                            </p>
                          </div>
                          {event.description && (
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{event.description}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Documents */}
        {documents.length > 0 && (
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#C9A84C]" />المستندات
                <Badge variant="outline" className="text-[10px] mr-auto">{documents.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {documents.map((doc: any) => (
                  <div key={doc.id} className="flex items-center gap-3 bg-muted/20 rounded-xl px-4 py-3">
                    <FileText className="h-4 w-4 text-violet-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.file_name ?? doc.fileName ?? "مستند"}</p>
                      <p className="text-xs text-muted-foreground">{new Date(doc.created_at ?? doc.createdAt).toLocaleDateString("ar-SA")}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {doc.file_type ?? doc.fileType ?? "—"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Client Uploads (previously uploaded by client) */}
        {uploads.length > 0 && (
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-cyan-400" />مستنداتك المرفوعة
                <Badge variant="outline" className="text-[10px] mr-auto border-cyan-500/30 text-cyan-400">{uploads.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {uploads.map((up: any) => (
                  <div key={up.id} className="flex items-center gap-3 bg-cyan-500/5 border border-cyan-500/20 rounded-xl px-4 py-2.5">
                    <FileUp className="h-4 w-4 text-cyan-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{up.file_name}</p>
                      <p className="text-xs text-muted-foreground">{new Date(up.uploaded_at).toLocaleDateString("ar-SA")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Invoices */}
        {portal?.showInvoices !== false && invoices.length > 0 && (
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Receipt className="h-4 w-4 text-[#C9A84C]" />الفواتير
                <Badge variant="outline" className="text-[10px] mr-auto">{invoices.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {invoices.map((inv: any) => {
                const invSt = INV_STATUS[inv.status] ?? INV_STATUS.draft;
                const total = Number(inv.total ?? inv.amount ?? 0) / 100;
                const isPayable = (inv.status === "sent" || inv.status === "overdue") && inv.stripe_payment_link_url;
                return (
                  <div key={inv.id} className={`rounded-xl overflow-hidden border ${invSt.color === "text-amber-400" || invSt.color === "text-red-400" ? "border-amber-500/20" : "border-border/30"}`}>
                    <div className="flex items-center justify-between bg-muted/20 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold">{inv.title}</p>
                        <p className={`text-xs ${invSt.color} mt-0.5`}>{invSt.label}</p>
                      </div>
                      <div className="text-left">
                        <p className="font-black text-xl text-[#C9A84C] font-mono">{total.toLocaleString("ar-SA")}</p>
                        <p className="text-xs text-muted-foreground">ريال سعودي</p>
                      </div>
                    </div>
                    {isPayable && (
                      <a href={inv.stripe_payment_link_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 bg-[#C9A84C] hover:bg-[#b8933e] text-[#0d1b2a] font-bold text-sm py-2.5 transition-colors">
                        <Banknote className="h-4 w-4" />
                        ادفع الآن — {total.toLocaleString("ar-SA")} ر.س
                      </a>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Client Upload Section */}
        {portal?.allowedToUpload && (
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CloudUpload className="h-4 w-4 text-[#C9A84C]" />رفع مستند للمكتب
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">يمكنك إرسال مستندات ووثائق مطلوبة منك مباشرة لمكتب المحاماة</p>
              {uploadFile ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
                    <FileText className="h-5 w-5 text-emerald-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{uploadFile.name}</p>
                      <p className="text-xs text-muted-foreground">{(uploadFile.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button onClick={() => setUploadFile(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <Button className="w-full bg-[#C9A84C] hover:bg-[#b8933e] text-[#0d1b2a] font-bold gap-2"
                    onClick={handleUpload} disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploading ? "جاري الرفع..." : "إرسال المستند"}
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-[#C9A84C]/30 rounded-xl py-8 flex flex-col items-center gap-3 text-muted-foreground hover:border-[#C9A84C]/60 hover:text-[#C9A84C] transition-all group">
                  <CloudUpload className="h-10 w-10 group-hover:scale-110 transition-transform" />
                  <div className="text-center">
                    <p className="text-sm font-medium">اضغط لاختيار ملف</p>
                    <p className="text-xs mt-0.5">PDF, Word, صور — حتى 5 ميغابايت</p>
                  </div>
                </button>
              )}
              <input ref={fileRef} type="file" className="hidden"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                onChange={e => setUploadFile(e.target.files?.[0] ?? null)} />
            </CardContent>
          </Card>
        )}

        {/* Contact Form */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[#C9A84C]" />التواصل مع المكتب
            </CardTitle>
          </CardHeader>
          <CardContent>
            {msgSent ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                </div>
                <p className="font-bold text-emerald-400">تم إرسال رسالتك بنجاح</p>
                <p className="text-xs text-muted-foreground">سيتواصل معك المكتب في أقرب وقت ممكن</p>
                <Button variant="outline" size="sm" onClick={() => setMsgSent(false)} className="mt-2">إرسال رسالة أخرى</Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">اسمك الكامل</Label>
                    <Input placeholder="الاسم" value={msgSender} onChange={e => setMsgSender(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">بريدك الإلكتروني</Label>
                    <Input type="email" placeholder="email@domain.com" value={msgEmail} onChange={e => setMsgEmail(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">رسالتك</Label>
                  <Textarea placeholder="اكتب استفسارك أو ملاحظتك..." rows={3} value={msgText}
                    onChange={e => setMsgText(e.target.value)} />
                </div>
                <Button className="w-full gap-2 bg-[#C9A84C] hover:bg-[#b8933e] text-[#0d1b2a] font-bold"
                  onClick={() => sendMessage.mutate()} disabled={!msgText || sendMessage.isPending}>
                  {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  إرسال الرسالة
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center pt-2 pb-10 space-y-1">
          <p className="text-xs text-muted-foreground">
            مدعوم بـ <span className="text-[#C9A84C] font-bold">عدالة AI</span> — نظام التشغيل القانوني
          </p>
          <p className="text-[10px] text-muted-foreground opacity-60">
            هذا الرابط شخصي وخاص بك — لا تشاركه مع أحد
          </p>
        </div>
      </div>
    </div>
  );
}

function LoadingPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-[#0d1b2a] flex flex-col items-center justify-center gap-4">
      <div className="relative">
        <Scale className="h-12 w-12 text-[#C9A84C]" />
        <Loader2 className="h-5 w-5 animate-spin text-[#C9A84C]/60 absolute -bottom-1 -left-1" />
      </div>
      <p className="text-[#C9A84C] font-black text-xl">عدالة AI</p>
      <p className="text-muted-foreground text-sm">جاري تحميل بيانات القضية...</p>
    </div>
  );
}

function ErrorPage({ msg }: { msg: string }) {
  return (
    <div dir="rtl" className="min-h-screen bg-[#0d1b2a] flex flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
        <AlertCircle className="h-10 w-10 text-red-400" />
      </div>
      <p className="font-bold text-xl">تعذّر فتح البوابة</p>
      <p className="text-muted-foreground text-sm max-w-xs">{msg}</p>
      <p className="text-xs text-muted-foreground">تواصل مع مكتب المحاماة للحصول على رابط جديد</p>
    </div>
  );
}
