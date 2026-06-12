import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, FileSignature, Loader2, AlertTriangle, Scale } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export default function SignPage({ token }: { token: string }) {
  const [fullName, setFullName] = useState("");
  const [signatureText, setSignatureText] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [done, setDone] = useState(false);

  const { data: request, isLoading, isError } = useQuery<any>({
    queryKey: ["sign-request", token],
    queryFn: () =>
      fetch(`${BASE}/api/signatures/token/${token}`).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error);
        return r.json();
      }),
    enabled: !!token,
    retry: false,
  });

  const signMutation = useMutation({
    mutationFn: () =>
      fetch(`${BASE}/api/signatures/token/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureText, fullName }),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error);
        return r.json();
      }),
    onSuccess: () => setDone(true),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f1c35] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#C9A84C]" />
      </div>
    );
  }

  if (isError || !request) {
    return (
      <div className="min-h-screen bg-[#0f1c35] flex flex-col items-center justify-center gap-4 p-6" dir="rtl">
        <AlertTriangle className="h-12 w-12 text-red-400" />
        <h2 className="text-white text-xl font-bold">رابط التوقيع غير صالح</h2>
        <p className="text-white/50 text-sm text-center">قد يكون الرابط منتهياً أو غير صحيح. تواصل مع مكتب المحاماة.</p>
      </div>
    );
  }

  if (done || request.status === "signed") {
    return (
      <div className="min-h-screen bg-[#0f1c35] flex flex-col items-center justify-center gap-5 p-6" dir="rtl">
        <div className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-400" />
        </div>
        <h2 className="text-white text-2xl font-bold">تم التوقيع بنجاح</h2>
        <p className="text-white/60 text-sm text-center max-w-sm">
          تم توقيعك على الوثيقة بنجاح. سيصلك نسخة عبر البريد الإلكتروني قريباً.
        </p>
        <div className="mt-4 text-xs text-white/30">
          تاريخ التوقيع: {request.signed_at ? new Date(request.signed_at).toLocaleString("ar-SA") : new Date().toLocaleString("ar-SA")}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1c35]" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-l from-[#0f1c35] to-[#1A2744] border-b border-white/10 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Scale className="h-6 w-6 text-[#C9A84C]" />
          <div>
            <h1 className="text-white font-bold text-lg">عدالة AI — التوقيع الإلكتروني</h1>
            <p className="text-white/50 text-xs">يُرجى مراجعة الوثيقة بعناية قبل التوقيع</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Request info */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <FileSignature className="h-4 w-4 text-[#C9A84C]" />
              طلب توقيع
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between py-1 border-b border-white/5">
              <span className="text-white/50">الوثيقة</span>
              <span className="text-white font-medium">{request.document_title}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/5">
              <span className="text-white/50">الموجهة إلى</span>
              <span className="text-white">{request.signer_name}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-white/50">تاريخ الطلب</span>
              <span className="text-white">{new Date(request.created_at).toLocaleDateString("ar-SA")}</span>
            </div>
          </CardContent>
        </Card>

        {/* Document content */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm">نص الوثيقة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-72 overflow-y-auto bg-white/[0.03] rounded-lg p-4 text-sm text-white/80 leading-relaxed whitespace-pre-wrap border border-white/5">
              {request.document_content}
            </div>
          </CardContent>
        </Card>

        {/* Signature form */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm">التوقيع</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">الاسم الكامل (للتأكيد)</Label>
              <Input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder={request.signer_name}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">التوقيع (اكتب اسمك كتوقيع إلكتروني)</Label>
              <Textarea
                value={signatureText}
                onChange={e => setSignatureText(e.target.value)}
                placeholder="اكتب توقيعك هنا..."
                rows={3}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 font-arabic text-lg"
                style={{ fontFamily: "'Amiri', 'Cairo', serif", fontSize: "1.3rem" }}
              />
            </div>
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                className="mt-1 accent-[#C9A84C]"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
              />
              <span className="text-white/60 text-sm leading-relaxed">
                أقر بأنني قرأت الوثيقة أعلاه بالكامل وأوافق على محتواها، وأن توقيعي الإلكتروني هذا يعادل التوقيع الخطي من الناحية القانونية.
              </span>
            </label>

            {signMutation.isError && (
              <p className="text-red-400 text-xs">{(signMutation.error as any)?.message}</p>
            )}

            <Button
              className="w-full bg-[#C9A84C] hover:bg-[#b8973e] text-black font-bold"
              disabled={!signatureText.trim() || !agreed || signMutation.isPending}
              onClick={() => signMutation.mutate()}
            >
              {signMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin ml-2" /> جارٍ التوقيع...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 ml-2" /> توقيع الوثيقة</>
              )}
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-white/25 pb-4">
          منصة عدالة AI · التوقيع الإلكتروني آمن ومشفر · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
