import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Scale, FileText, Receipt, MessageSquare, CheckCircle2, Clock,
  Download, Send, Loader2, Shield, AlertCircle, Globe,
  Eye, Calendar, User
} from "lucide-react";

const BASE = import.meta.env.BASE_URL ?? "/";

const STATUS_AR: Record<string, { label: string; color: string }> = {
  open:        { label: "مفتوحة",      color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  in_progress: { label: "قيد التنفيذ", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  closed:      { label: "مغلقة",       color: "bg-green-500/10 text-green-400 border-green-500/20" },
};
const INV_STATUS: Record<string, { label: string; color: string }> = {
  paid:    { label: "مدفوعة", color: "text-green-400" },
  sent:    { label: "مُرسَلة", color: "text-blue-400" },
  draft:   { label: "مسودة",  color: "text-gray-400" },
  overdue: { label: "متأخرة", color: "text-red-400" },
};
const CASE_TYPE: Record<string, string> = {
  criminal: "جنائية", civil: "مدنية", commercial: "تجارية",
  labor: "عمالية", real_estate: "عقارية",
};

export default function PortalView() {
  const [, params] = useRoute("/portal/:token");
  const token = params?.token ?? "";
  const [msgText, setMsgText] = useState("");
  const [msgSender, setMsgSender] = useState("");
  const [msgEmail, setMsgEmail] = useState("");
  const [msgSent, setMsgSent] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["portal-view", token],
    queryFn: () => fetch(`${BASE}api/portal/${token}`).then(r => r.json()),
    enabled: !!token,
    retry: false,
  });

  const sendMessage = useMutation({
    mutationFn: () => fetch(`${BASE}api/portal/${token}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msgText, senderName: msgSender, senderEmail: msgEmail }),
    }).then(r => r.json()),
    onSuccess: (d) => {
      if (d?.error) { toast.error(d.error); return; }
      toast.success("تم إرسال رسالتك ✅");
      setMsgSent(true); setMsgText("");
    },
    onError: () => toast.error("فشل إرسال الرسالة"),
  });

  // Error / expiry
  if (!token) return <ErrorPage msg="رابط غير صالح" />;
  if (isLoading) return <LoadingPage />;
  if (error || data?.error) return <ErrorPage msg={data?.error ?? "حدث خطأ"} />;

  const { portal, case: c, invoices, documents } = data as any;
  const status = STATUS_AR[c?.status] ?? STATUS_AR.open;

  return (
    <div dir="rtl" className="min-h-screen bg-[#0d1b2a] text-foreground" style={{ fontFamily: "'Cairo', sans-serif" }}>
      {/* Header */}
      <div className="bg-[#0d1b2a] border-b border-border/30 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-[#C9A84C]" />
            <span className="font-black text-[#C9A84C]">عدالة AI</span>
            <span className="text-xs text-muted-foreground">| بوابة العميل</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-green-500" />
            <span className="text-xs text-green-400">رابط آمن ومشفر</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Welcome */}
        {portal?.clientName && (
          <div className="bg-[#C9A84C]/10 border border-[#C9A84C]/30 rounded-2xl p-4">
            <p className="font-semibold text-[#C9A84C]">مرحباً، {portal.clientName} 👋</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              يمكنك متابعة قضيتك وتواصل مع المكتب من خلال هذه الصفحة
            </p>
          </div>
        )}

        {/* Case Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="h-4 w-4 text-[#C9A84C]" />تفاصيل القضية
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-bold text-xl">{c?.title}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="outline" className={`text-xs ${status.color}`}>{status.label}</Badge>
                  {c?.caseType && (
                    <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                      {CASE_TYPE[c.caseType] ?? c.caseType}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            {c?.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{c.description}</p>
            )}
            <div className="grid grid-cols-2 gap-3 pt-2">
              {c?.clientName && (
                <div className="bg-muted/30 rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                    <User className="h-3 w-3" />المُوكّل
                  </p>
                  <p className="text-sm font-medium">{c.clientName}</p>
                </div>
              )}
              {c?.createdAt && (
                <div className="bg-muted/30 rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />تاريخ الفتح
                  </p>
                  <p className="text-sm font-medium">{new Date(c.createdAt).toLocaleDateString("ar-SA")}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Invoices */}
        {invoices?.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4 text-[#C9A84C]" />الفواتير
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {invoices.map((inv: any) => {
                const invSt = INV_STATUS[inv.status] ?? INV_STATUS.draft;
                const total = (inv.total ?? inv.amount ?? 0) / 100;
                return (
                  <div key={inv.id} className="flex items-center justify-between bg-muted/30 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{inv.title}</p>
                      <p className={`text-xs ${invSt.color}`}>{invSt.label}</p>
                    </div>
                    <div className="text-left">
                      <p className="font-bold font-mono text-lg text-[#C9A84C]">{total.toLocaleString("ar-SA", { minimumFractionDigits: 2 })}</p>
                      <p className="text-xs text-muted-foreground">ر.س</p>
                    </div>
                  </div>
                );
              })}
              {invoices.some((i: any) => i.status === "sent" && i.stripe_payment_link_url) && (
                <div className="pt-2">
                  {invoices.filter((i: any) => i.status === "sent" && i.stripe_payment_link_url).map((inv: any) => (
                    <Button key={inv.id} className="w-full gap-2" asChild>
                      <a href={inv.stripe_payment_link_url} target="_blank" rel="noopener noreferrer">
                        <Receipt className="h-4 w-4" />دفع الفاتورة الإلكترونية
                      </a>
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Documents */}
        {documents?.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#C9A84C]" />المستندات
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {documents.map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between bg-muted/30 rounded-xl px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{doc.file_name ?? doc.fileName ?? "مستند"}</p>
                      <p className="text-xs text-muted-foreground">{new Date(doc.created_at ?? doc.createdAt).toLocaleDateString("ar-SA")}</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Contact Form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[#C9A84C]" />تواصل مع المكتب
            </CardTitle>
          </CardHeader>
          <CardContent>
            {msgSent ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
                <p className="font-semibold text-green-400">تم إرسال رسالتك بنجاح</p>
                <p className="text-xs text-muted-foreground">سيتواصل معك المكتب في أقرب وقت</p>
                <Button variant="outline" size="sm" onClick={() => setMsgSent(false)}>إرسال رسالة أخرى</Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">اسمك</Label>
                    <Input placeholder="الاسم الكامل" value={msgSender} onChange={e => setMsgSender(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">بريدك الإلكتروني</Label>
                    <Input type="email" placeholder="email@domain.com" value={msgEmail} onChange={e => setMsgEmail(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">رسالتك</Label>
                  <Textarea placeholder="اكتب استفسارك أو ملاحظتك هنا..." rows={3} value={msgText}
                    onChange={e => setMsgText(e.target.value)} />
                </div>
                <Button className="w-full gap-2" onClick={() => sendMessage.mutate()} disabled={!msgText || sendMessage.isPending}>
                  {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  إرسال الرسالة
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center pt-4 pb-8">
          <p className="text-xs text-muted-foreground">
            منصة <span className="text-[#C9A84C]">عدالة AI</span> — نظام التشغيل القانوني
          </p>
          {portal?.expiresAt && (
            <p className="text-[10px] text-muted-foreground mt-1">
              صلاحية الرابط تنتهي: {new Date(portal.expiresAt).toLocaleDateString("ar-SA")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-[#0d1b2a] flex flex-col items-center justify-center gap-4">
      <Scale className="h-10 w-10 text-[#C9A84C] animate-pulse" />
      <p className="text-[#C9A84C] font-bold text-lg">عدالة AI</p>
      <p className="text-muted-foreground text-sm">جاري تحميل بيانات القضية...</p>
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

function ErrorPage({ msg }: { msg: string }) {
  return (
    <div dir="rtl" className="min-h-screen bg-[#0d1b2a] flex flex-col items-center justify-center gap-4 px-4 text-center">
      <AlertCircle className="h-12 w-12 text-red-400" />
      <p className="font-bold text-xl">الرابط غير صالح</p>
      <p className="text-muted-foreground text-sm">{msg}</p>
      <p className="text-xs text-muted-foreground">إذا كان الرابط صحيحاً، تواصل مع المكتب للحصول على رابط جديد.</p>
    </div>
  );
}
