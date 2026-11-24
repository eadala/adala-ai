 
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Copy, CheckCircle, AlertCircle, Smartphone, Key } from "lucide-react";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge }    from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/authFetch";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function TwoFactorSetup() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [token, setToken]         = useState("");
  const [step, setStep]           = useState<"info" | "qr" | "verify" | "done">("info");
  const [qrData, setQrData]       = useState<{ qrCodeUrl: string; manualCode: string } | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disableToken, setDisableToken] = useState("");

  const { data: status } = useQuery<{ enabled: boolean; configured: boolean }>({
    queryKey: ["2fa-status"],
    queryFn: () => authFetch(`${BASE}/api/2fa/status`).then(r => r.json()),
  });

  const setupMut = useMutation({
    mutationFn: () => authFetch(`${BASE}/api/2fa/setup`, { method: "POST" }).then(r => r.json()),
    onSuccess: (data) => {
      setQrData(data);
      setStep("qr");
    },
    onError: () => toast({ title: "خطأ", description: "فشل إنشاء الإعداد", variant: "destructive" }),
  });

  const verifyMut = useMutation({
    mutationFn: (t: string) =>
      authFetch(`${BASE}/api/2fa/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: t }) }).then(r => {
        if (!r.ok) throw new Error("invalid");
        return r.json();
      }),
    onSuccess: (data) => {
      setBackupCodes(data.backupCodes ?? []);
      setStep("done");
      qc.invalidateQueries({ queryKey: ["2fa-status"] });
    },
    onError: () => toast({ title: "رمز غير صحيح", description: "تحقق من التطبيق وأعد المحاولة", variant: "destructive" }),
  });

  const disableMut = useMutation({
    mutationFn: (t: string) =>
      authFetch(`${BASE}/api/2fa/disable`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: t }) }).then(r => {
        if (!r.ok) throw new Error("invalid");
        return r.json();
      }),
    onSuccess: () => {
      toast({ title: "✅ تم إيقاف المصادقة الثنائية" });
      qc.invalidateQueries({ queryKey: ["2fa-status"] });
      setDisableToken("");
    },
    onError: () => toast({ title: "رمز غير صحيح", variant: "destructive" }),
  });

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "تم النسخ" });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-lg space-y-6">

        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl mx-auto">
            <Shield className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold">المصادقة الثنائية (2FA)</h1>
          <p className="text-muted-foreground text-sm">طبقة حماية إضافية لحسابك</p>
        </div>

        {/* ── Status badge ── */}
        {status && (
          <div className="flex justify-center">
            <Badge variant={status.enabled ? "default" : "secondary"} className={status.enabled ? "bg-green-500 text-white" : ""}>
              {status.enabled ? "✅ المصادقة الثنائية مفعّلة" : "⚠️ المصادقة الثنائية غير مفعّلة"}
            </Badge>
          </div>
        )}

        {/* ── If enabled — show disable option ── */}
        {status?.enabled && step !== "done" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">إيقاف المصادقة الثنائية</CardTitle>
              <CardDescription>أدخل رمز التطبيق للإيقاف</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="000000"
                maxLength={6}
                value={disableToken}
                onChange={e => setDisableToken(e.target.value.replace(/\D/g, ""))}
                className="text-center text-2xl tracking-widest font-mono"
              />
              <Button
                variant="destructive"
                className="w-full"
                disabled={disableToken.length < 6 || disableMut.isPending}
                onClick={() => disableMut.mutate(disableToken)}
              >
                {disableMut.isPending ? "جاري الإيقاف..." : "إيقاف 2FA"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Step: info ── */}
        {!status?.enabled && step === "info" && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-3">
                {[
                  { icon: Smartphone, title: "حمّل تطبيق المصادقة", desc: "Google Authenticator أو Microsoft Authenticator" },
                  { icon: Key,        title: "امسح رمز QR",          desc: "ستتلقى رموزاً كل 30 ثانية" },
                  { icon: Shield,     title: "حسابك محمي",           desc: "لا يمكن الدخول بدون الرمز حتى لو سُرّبت كلمة المرور" },
                ].map((item, i) => (
                  <div key={i} className="flex gap-3 items-start p-3 rounded-xl bg-muted/50">
                    <item.icon className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => setupMut.mutate()} disabled={setupMut.isPending}>
                {setupMut.isPending ? "جاري الإعداد..." : "ابدأ إعداد 2FA"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Step: QR ── */}
        {step === "qr" && qrData && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">امسح رمز QR</CardTitle>
              <CardDescription>افتح تطبيق المصادقة وامسح الرمز أدناه</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center">
                <img src={qrData.qrCodeUrl} alt="QR Code" className="w-48 h-48 border-4 border-white rounded-xl shadow-md" />
              </div>
              <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
                <code className="flex-1 text-xs font-mono break-all">{qrData.manualCode}</code>
                <button onClick={() => copy(qrData.manualCode)} className="shrink-0">
                  <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground text-center">إذا لم تستطع مسح الرمز، أدخل الكود يدوياً في التطبيق</p>
              <Button className="w-full" onClick={() => setStep("verify")}>التالي — أدخل رمز التحقق</Button>
            </CardContent>
          </Card>
        )}

        {/* ── Step: verify ── */}
        {step === "verify" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">أدخل رمز التحقق</CardTitle>
              <CardDescription>الرمز المكوّن من 6 أرقام من تطبيق المصادقة</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="000000"
                maxLength={6}
                value={token}
                onChange={e => setToken(e.target.value.replace(/\D/g, ""))}
                className="text-center text-3xl tracking-widest font-mono"
                autoFocus
                onKeyDown={e => e.key === "Enter" && token.length === 6 && verifyMut.mutate(token)}
              />
              {verifyMut.isError && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4" /> الرمز غير صحيح، حاول مجدداً
                </div>
              )}
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={token.length < 6 || verifyMut.isPending}
                onClick={() => verifyMut.mutate(token)}
              >
                {verifyMut.isPending ? "جاري التحقق..." : "تفعيل 2FA"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Step: done ── */}
        {step === "done" && (
          <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
            <CardContent className="pt-6 text-center space-y-4">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
              <div>
                <h3 className="font-bold text-lg">🎉 تم تفعيل المصادقة الثنائية!</h3>
                <p className="text-sm text-muted-foreground mt-1">حسابك الآن محمي بطبقة إضافية</p>
              </div>
              {backupCodes.length > 0 && (
                <div className="bg-white dark:bg-background rounded-xl border p-4 text-right space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">رموز الطوارئ</p>
                    <button onClick={() => copy(backupCodes.join("\n"))} className="text-xs text-blue-600 flex items-center gap-1">
                      <Copy className="w-3 h-3" /> نسخ الكل
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">احفظها في مكان آمن — كل رمز يُستخدم مرة واحدة فقط</p>
                  <div className="grid grid-cols-2 gap-2">
                    {backupCodes.map((code, i) => (
                      <code key={i} className="bg-muted rounded px-2 py-1 text-xs font-mono text-center">{code}</code>
                    ))}
                  </div>
                </div>
              )}
              <Button className="w-full" onClick={() => window.history.back()}>العودة للإعدادات</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
