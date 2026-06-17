import React, { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Shield, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input }  from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function TwoFactorVerify() {
  const [, nav]  = useLocation();
  const { toast } = useToast();
  const [token, setToken] = useState("");
  const redirect = new URLSearchParams(window.location.search).get("redirect") ?? "/dashboard";

  const checkMut = useMutation({
    mutationFn: (t: string) =>
      fetch(`${BASE}/api/2fa/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t }),
      }).then(r => {
        if (!r.ok) throw new Error("invalid");
        return r.json();
      }),
    onSuccess: () => {
      sessionStorage.setItem("2fa_verified", "1");
      nav(redirect);
    },
    onError: () => toast({ title: "رمز غير صحيح", description: "تحقق من التطبيق وأعد المحاولة", variant: "destructive" }),
  });

  useEffect(() => {
    if (sessionStorage.getItem("2fa_verified") === "1") nav(redirect);
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl mx-auto">
            <Shield className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-xl font-bold">التحقق الثنائي</h1>
          <p className="text-muted-foreground text-sm">أدخل رمز تطبيق المصادقة لإكمال تسجيل الدخول</p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <Input
              placeholder="000 000"
              maxLength={6}
              value={token}
              onChange={e => setToken(e.target.value.replace(/\D/g, ""))}
              className="text-center text-3xl tracking-widest font-mono"
              autoFocus
              onKeyDown={e => e.key === "Enter" && token.length === 6 && checkMut.mutate(token)}
            />
            {checkMut.isError && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="w-4 h-4" /> الرمز غير صحيح أو منتهي الصلاحية
              </div>
            )}
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={token.length < 6 || checkMut.isPending}
              onClick={() => checkMut.mutate(token)}
            >
              {checkMut.isPending ? "جاري التحقق..." : "دخول →"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              يمكنك استخدام رمز الطوارئ بدلاً من رمز التطبيق
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
