import { useState } from "react";
import {
  Zap, FileText, Gavel, AlertTriangle, TrendingUp, Handshake,
  Bell, Scale, ChevronLeft, Loader2, Copy, Check, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const COMMANDS = [
  { key: "analyze_case", label: "تحليل قضية", icon: Gavel, color: "#6366F1", desc: "حلّل وقائع قضيتك واحصل على الاستراتيجية المثلى", placeholder: "صِف وقائع القضية: الأطراف، الوقائع، المطالبات..." },
  { key: "draft_memo", label: "إعداد مذكرة", icon: FileText, color: "#10B981", desc: "أعدّ مذكرة دفاع أو اتهام احترافية", placeholder: "قدّم معطيات القضية والموقف الذي تريد الدفاع عنه..." },
  { key: "review_contract", label: "مراجعة عقد", icon: Scale, color: "#F59E0B", desc: "راجع أي عقد واستخرج المخاطر والتوصيات", placeholder: "الصق نص العقد أو وصف موجز لبنوده الرئيسية..." },
  { key: "extract_risks", label: "استخراج المخاطر", icon: AlertTriangle, color: "#EF4444", desc: "صنّف المخاطر القانونية حسب الخطورة", placeholder: "الصق النص أو المستند الذي تريد تحليل مخاطره القانونية..." },
  { key: "predict_outcome", label: "التنبؤ بالمآل", icon: TrendingUp, color: "#8B5CF6", desc: "قدّر احتمالية النجاح والمدة والتكلفة", placeholder: "صِف القضية بالتفصيل: نوعها، أطرافها، الأدلة المتاحة..." },
  { key: "suggest_settlement", label: "اقتراح تسوية", icon: Handshake, color: "#06B6D4", desc: "صِغ إطار تسوية متوازن قبل التقاضي", placeholder: "صِف النزاع والمبالغ المطالَب بها والمواقف الحالية للطرفين..." },
  { key: "draft_notice", label: "صياغة إنذار", icon: Bell, color: "#F97316", desc: "أعدّ إنذاراً قانونياً رسمياً ومحكماً", placeholder: "حدد: من المُنذِر؟ من المُنذَر؟ ما سبب الإنذار؟ ما المطلوب؟" },
  { key: "legal_opinion", label: "رأي قانوني", icon: Sparkles, color: "#C9A84C", desc: "احصل على رأي قانوني مكتوب ومنظم", placeholder: "اطرح سؤالك القانوني أو المسألة التي تحتاج رأياً فيها..." },
];

function ResultDisplay({ result }: { result: string }) {
  const [copied, setCopied] = useState(false);
  const lines = result.split("\n").map((line, i) => {
    if (line.startsWith("**") && line.endsWith("**"))
      return <h3 key={i} className="font-bold text-primary mt-4 mb-1 text-sm first:mt-0">{line.slice(2, -2)}</h3>;
    if (line.startsWith("🔴") || line.startsWith("🟡") || line.startsWith("🟢") || line.startsWith("📊") || line.startsWith("⏱️") || line.startsWith("💰"))
      return <p key={i} className="text-sm font-semibold mt-2">{line}</p>;
    if (line.startsWith("- "))
      return <p key={i} className="text-sm text-foreground/80 flex items-start gap-2"><span className="text-primary mt-0.5">•</span>{line.slice(2)}</p>;
    if (/^\d+\./.test(line))
      return <p key={i} className="text-sm text-foreground/80">{line}</p>;
    if (!line.trim()) return <div key={i} className="h-2" />;
    return <p key={i} className="text-sm leading-relaxed text-foreground/90">{line}</p>;
  });

  const copy = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <Button variant="ghost" size="sm" onClick={copy} className="absolute top-2 left-2 h-7 text-xs gap-1">
        {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
        {copied ? "تم النسخ" : "نسخ"}
      </Button>
      <ScrollArea className="max-h-[60vh]">
        <div className="p-5 pt-10 space-y-0.5">{lines}</div>
      </ScrollArea>
    </div>
  );
}

export default function CommandCenter() {
  const [selected, setSelected] = useState<typeof COMMANDS[0] | null>(null);
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const execute = async () => {
    if (!input.trim() || !selected || loading) return;
    setLoading(true);
    setResult("");
    try {
      const res = await fetch("/api/command-center/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: selected.key, input }),
      });
      const data = await res.json();
      setResult(data.result);
    } catch {
      toast({ title: "خطأ في التنفيذ", variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-2">
          <Zap className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-black">مركز الأوامر الذكية</h1>
        <p className="text-muted-foreground text-sm">اختر أمراً قانونياً — أدخل البيانات — احصل على النتيجة فوراً</p>
      </div>

      {/* Command Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {COMMANDS.map(cmd => (
          <button key={cmd.key} onClick={() => { setSelected(cmd); setInput(""); setResult(""); }}
            className={cn("p-4 rounded-2xl border-2 text-right transition-all hover:scale-[1.02]",
              selected?.key === cmd.key
                ? "border-primary bg-primary/5"
                : "border-muted bg-card hover:border-muted-foreground/30"
            )}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2" style={{ background: `${cmd.color}18` }}>
              <cmd.icon className="w-4 h-4" style={{ color: cmd.color }} />
            </div>
            <div className="font-semibold text-sm">{cmd.label}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{cmd.desc}</div>
          </button>
        ))}
      </div>

      {/* Input Area */}
      {selected && (
        <Card className="border-primary/10">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${selected.color}18` }}>
                <selected.icon className="w-4 h-4" style={{ color: selected.color }} />
              </div>
              <span className="font-semibold">{selected.label}</span>
              <Badge variant="outline" className="text-[10px] mr-auto">AI مدعوم بـ</Badge>
            </div>
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={selected.placeholder}
              className="min-h-[110px] resize-none bg-muted/50 border-none focus-visible:ring-1"
              onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) execute(); }}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Ctrl+Enter للتنفيذ</p>
              <Button onClick={execute} disabled={!input.trim() || loading} className="gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {loading ? "جارٍ التنفيذ..." : "تنفيذ الأمر"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {result && (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-emerald-500/20">
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-400">النتيجة</span>
              <Badge variant="outline" className="text-[10px] mr-auto border-emerald-500/30 text-emerald-400">{selected?.label}</Badge>
            </div>
            <ResultDisplay result={result} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
