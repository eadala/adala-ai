import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, FileSignature, Loader2, AlertTriangle, Scale,
  PenLine, Type, Trash2, Shield, Calendar, Globe
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export default function SignPage({ token }: { token: string }) {
  const [fullName, setFullName]         = useState("");
  const [signatureText, setSignatureText] = useState("");
  const [agreed, setAgreed]             = useState(false);
  const [done, setDone]                 = useState(false);
  const [signMode, setSignMode]         = useState<"draw" | "type">("draw");
  const [isDrawing, setIsDrawing]       = useState(false);
  const [hasDrawing, setHasDrawing]     = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPos   = useRef<{ x: number; y: number } | null>(null);

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

  /* ── Canvas helpers ── */
  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.strokeStyle = "#1A2744";
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    return ctx;
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    lastPos.current = getPos(e, canvas);
  }, []);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx || !lastPos.current) return;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    setHasDrawing(true);
  }, [isDrawing, getCtx]);

  const stopDraw = useCallback(() => {
    setIsDrawing(false);
    lastPos.current = null;
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasDrawing(false);
    }
  }, [getCtx]);

  const getSignatureData = useCallback((): string => {
    if (signMode === "type") return signatureText;
    return canvasRef.current?.toDataURL("image/png") ?? "";
  }, [signMode, signatureText]);

  const isReady = agreed && fullName.trim() &&
    (signMode === "draw" ? hasDrawing : signatureText.trim().length > 0);

  const signMutation = useMutation({
    mutationFn: () =>
      fetch(`${BASE}/api/signatures/token/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureText: getSignatureData(), fullName, signMode }),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error);
        return r.json();
      }),
    onSuccess: () => setDone(true),
  });

  /* ── Loading ── */
  if (isLoading) return (
    <div className="min-h-screen bg-[#0f1c35] flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  /* ── Error ── */
  if (isError || !request) return (
    <div className="min-h-screen bg-[#0f1c35] flex flex-col items-center justify-center gap-4 p-6" dir="rtl">
      <AlertTriangle className="h-12 w-12 text-red-400" />
      <h2 className="text-white text-xl font-bold">رابط التوقيع غير صالح</h2>
      <p className="text-white/50 text-sm text-center">قد يكون الرابط منتهياً أو غير صحيح. تواصل مع مكتب المحاماة.</p>
    </div>
  );

  /* ── Signed ── */
  if (done || request.status === "signed") return (
    <div className="min-h-screen bg-[#0f1c35] flex flex-col items-center justify-center gap-5 p-6" dir="rtl">
      <div className="w-24 h-24 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-400" />
      </div>
      <h2 className="text-white text-2xl font-bold">تم التوقيع بنجاح</h2>
      <p className="text-white/60 text-sm text-center max-w-sm">
        تم توقيعك على الوثيقة بنجاح. سيصلك نسخة بالبريد الإلكتروني قريباً.
      </p>
      <div className="mt-2 flex items-center gap-4 text-xs text-white/30">
        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{request.signed_at ? new Date(request.signed_at).toLocaleString("ar-SA") : new Date().toLocaleString("ar-SA")}</span>
        <span className="flex items-center gap-1"><Shield className="h-3 w-3" />توقيع قانوني مُحكم</span>
      </div>
    </div>
  );

  /* ── Main ── */
  return (
    <div className="min-h-screen bg-[#0f1c35]" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-l from-[#0f1c35] to-[#1A2744] border-b border-white/10 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Scale className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-white font-bold">عدالة AI — التوقيع الإلكتروني</h1>
              <p className="text-white/40 text-xs">راجع الوثيقة بعناية قبل التوقيع</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px]">
              <Shield className="h-2.5 w-2.5 ml-1" />آمن ومشفّر
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-5 space-y-4">
        {/* Request info */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <FileSignature className="h-4 w-4 text-primary" />طلب توقيع
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            {[
              { label: "الوثيقة",      value: request.document_title },
              { label: "الموجهة إلى", value: request.signer_name },
              { label: "تاريخ الطلب", value: new Date(request.created_at).toLocaleDateString("ar-SA") },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between py-2 border-b border-white/5 last:border-0">
                <span className="text-white/40 text-sm">{label}</span>
                <span className="text-white text-sm font-medium">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Document */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-sm">نص الوثيقة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-y-auto bg-white/[0.03] rounded-xl p-4 text-sm text-white/80 leading-relaxed whitespace-pre-wrap border border-white/5">
              {request.document_content}
            </div>
          </CardContent>
        </Card>

        {/* Signature */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-sm">التوقيع الإلكتروني</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Full name */}
            <div className="space-y-1.5">
              <Label className="text-white/60 text-xs">الاسم الكامل (للتحقق)</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder={request.signer_name}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20" />
            </div>

            {/* Signature tabs */}
            <div className="space-y-1.5">
              <Label className="text-white/60 text-xs">التوقيع</Label>
              <Tabs value={signMode} onValueChange={v => setSignMode(v as "draw" | "type")}>
                <TabsList className="bg-white/5 border border-white/10 h-8">
                  <TabsTrigger value="draw" className="text-xs gap-1 h-6 data-[state=active]:bg-primary data-[state=active]:text-black">
                    <PenLine className="h-3 w-3" />رسم التوقيع
                  </TabsTrigger>
                  <TabsTrigger value="type" className="text-xs gap-1 h-6 data-[state=active]:bg-primary data-[state=active]:text-black">
                    <Type className="h-3 w-3" />كتابة التوقيع
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="draw" className="mt-2">
                  <div className="relative rounded-xl border border-white/15 overflow-hidden bg-white">
                    <canvas
                      ref={canvasRef}
                      width={600}
                      height={160}
                      className="w-full h-40 cursor-crosshair touch-none"
                      onMouseDown={startDraw}
                      onMouseMove={draw}
                      onMouseUp={stopDraw}
                      onMouseLeave={stopDraw}
                      onTouchStart={startDraw}
                      onTouchMove={draw}
                      onTouchEnd={stopDraw}
                    />
                    {!hasDrawing && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-gray-300 text-sm">ارسم توقيعك هنا...</span>
                      </div>
                    )}
                    <Button size="sm" variant="ghost" onClick={clearCanvas}
                      className="absolute top-2 left-2 h-7 w-7 p-0 text-muted-foreground hover:text-red-400 hover:bg-red-50">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-white/30 text-[10px] mt-1 text-center">استخدم الفأرة أو إصبعك للتوقيع في المربع أعلاه</p>
                </TabsContent>

                <TabsContent value="type" className="mt-2">
                  <Input
                    value={signatureText}
                    onChange={e => setSignatureText(e.target.value)}
                    placeholder="اكتب اسمك كتوقيع..."
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/20 text-xl"
                    style={{ fontFamily: "'Amiri', 'Cairo', serif" }}
                  />
                  <p className="text-white/30 text-[10px] mt-1">يُعدّ الاسم المكتوب توقيعاً إلكترونياً ذا حجية قانونية</p>
                </TabsContent>
              </Tabs>
            </div>

            {/* Agreement */}
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input type="checkbox" className="mt-1 accent-[#2563EB]" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
              <span className="text-white/50 text-sm leading-relaxed">
                أُقرّ بأنني قرأت الوثيقة أعلاه بالكامل وأوافق على محتواها، وأن توقيعي الإلكتروني يُعادل التوقيع الخطي من الناحية القانونية.
              </span>
            </label>

            {signMutation.isError && (
              <p className="text-red-400 text-xs">{(signMutation.error as any)?.message}</p>
            )}

            <Button className="w-full bg-primary hover:bg-[#b8973e] text-black font-bold h-11"
              disabled={!isReady || signMutation.isPending}
              onClick={() => signMutation.mutate()}>
              {signMutation.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin ml-2" />جارٍ التوقيع...</>
                : <><CheckCircle2 className="h-4 w-4 ml-2" />توقيع الوثيقة رسمياً</>}
            </Button>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="flex items-center justify-center gap-4 text-[10px] text-white/20 pb-4">
          <span className="flex items-center gap-1"><Globe className="h-3 w-3" />عدالة AI</span>
          <span>·</span>
          <span className="flex items-center gap-1"><Shield className="h-3 w-3" />SSL مُشفَّر</span>
          <span>·</span>
          <span>{new Date().getFullYear()}</span>
        </div>
      </div>
    </div>
  );
}
