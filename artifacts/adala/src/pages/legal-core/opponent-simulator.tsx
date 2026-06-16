import { useState, useRef, useEffect } from "react";
import {
  Swords, Send, RotateCcw, Trophy, ChevronDown, AlertTriangle,
  CheckCircle, TrendingUp, Target, Lightbulb, Scale, Loader2,
  Play, Star, Shield, Gavel
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "opponent";
  content: string;
  round?: number;
}

interface Evaluation {
  overallScore: number;
  argumentStrength: number;
  legalAccuracy: number;
  persuasiveness: number;
  weakPoints: string[];
  strongPoints: string[];
  recommendation: string;
  verdict: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CASE_TYPES = [
  { value: "civil", label: "مدني — عقود ومسؤولية تقصيرية" },
  { value: "commercial", label: "تجاري — شركات وعقود تجارية" },
  { value: "labor", label: "عمالي — نزاعات العمل" },
  { value: "family", label: "أسري — طلاق ونفقة وحضانة" },
  { value: "real_estate", label: "عقاري — ملكية وإيجار" },
  { value: "criminal", label: "جنائي — دفاع وادعاء" },
];

const DIFFICULTIES = [
  { value: "beginner", label: "مبتدئ", color: "text-emerald-400", desc: "حجج بسيطة، أسلوب هادئ" },
  { value: "intermediate", label: "متوسط", color: "text-yellow-400", desc: "محترف، يستشهد بالنصوص" },
  { value: "expert", label: "خبير", color: "text-red-400", desc: "ضاغط، لا يُفوّت ثغرة" },
];

const SIDES = [
  { value: "plaintiff", label: "المدعي", icon: "⚖️", desc: "أنت تُقيم الدعوى" },
  { value: "defendant", label: "المدعى عليه", icon: "🛡️", desc: "أنت تدافع عن نفسك" },
];

const SAMPLE_CASES = [
  "موكلي يطالب بتعويض عن ضرر نتج عن إخلال المدعى عليه بعقد توريد بضائع. قيمة العقد 500,000 ريال وتأخر التسليم 3 أشهر ما تسبب في خسائر للمشروع.",
  "موكلي محامٍ يطالب بحقوقه العمالية بعد إنهاء خدمته تعسفياً دون مكافأة نهاية الخدمة رغم 8 سنوات من العمل.",
  "نزاع على حدود أرض، حيث يدّعي موكلي ملكيته لقطعة الأرض بموجب صك رسمي، فيما يدّعي الطرف الآخر التقادم.",
];

// ─── Score Ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = (score / 100) * circumference;
  const color = score >= 75 ? "#10B981" : score >= 55 ? "#F59E0B" : "#EF4444";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={6} className="text-muted/30" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={6}
          strokeDasharray={`${strokeDash} ${circumference}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black" style={{ color }}>{score}</span>
        <span className="text-[9px] text-muted-foreground leading-none">/ 100</span>
      </div>
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";

  const lines = msg.content.split("\n").map((line, i) => {
    if (line.startsWith("**") && line.endsWith("**"))
      return <div key={i} className="font-bold text-primary mt-2 mb-1 text-sm">{line.slice(2, -2)}</div>;
    if (line.trim() === "") return <div key={i} className="h-1" />;
    return <div key={i} className="leading-relaxed text-sm">{line}</div>;
  });

  return (
    <div className={cn("flex gap-3 group", isUser ? "flex-row-reverse" : "")}>
      {/* Avatar */}
      <div className={cn(
        "w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-sm font-bold",
        isUser ? "bg-primary/20 text-primary" : "bg-red-500/15 text-red-400"
      )}>
        {isUser ? <Scale className="w-4 h-4" /> : <Swords className="w-4 h-4" />}
      </div>

      <div className={cn("max-w-[80%] flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          {isUser ? "حجتك" : "الخصم"}
          {msg.round && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">جولة {msg.round}</Badge>}
        </div>
        <div className={cn(
          "px-4 py-3 rounded-2xl text-foreground",
          isUser
            ? "bg-primary/10 border border-primary/20 rounded-tl-sm"
            : "bg-red-500/8 border border-red-500/15 rounded-tr-sm"
        )}>
          {lines}
        </div>
      </div>
    </div>
  );
}

// ─── Evaluation Panel ─────────────────────────────────────────────────────────

function EvaluationPanel({ evaluation, onReset }: { evaluation: Evaluation; onReset: () => void }) {
  const scoreColor = evaluation.overallScore >= 75 ? "text-emerald-400" : evaluation.overallScore >= 55 ? "text-yellow-400" : "text-red-400";
  const scoreLabel = evaluation.overallScore >= 80 ? "ممتاز" : evaluation.overallScore >= 65 ? "جيد" : evaluation.overallScore >= 50 ? "مقبول" : "يحتاج تطوير";

  return (
    <div className="space-y-5">
      {/* Overall */}
      <Card className="overflow-hidden">
        <div className="p-6" style={{ background: "linear-gradient(135deg, rgba(201,168,76,0.08) 0%, transparent 100%)" }}>
          <div className="flex items-center gap-5">
            <ScoreRing score={evaluation.overallScore} size={90} />
            <div>
              <div className={cn("text-2xl font-black", scoreColor)}>{scoreLabel}</div>
              <div className="text-sm text-muted-foreground mt-1 max-w-xs leading-relaxed">{evaluation.verdict}</div>
            </div>
          </div>
        </div>

        <Separator />

        <div className="p-5 grid grid-cols-3 gap-4">
          {[
            { label: "قوة الحجج", value: evaluation.argumentStrength, icon: Target },
            { label: "الدقة القانونية", value: evaluation.legalAccuracy, icon: Scale },
            { label: "الإقناع", value: evaluation.persuasiveness, icon: TrendingUp },
          ].map(m => (
            <div key={m.label} className="text-center">
              <div className="flex justify-center mb-2">
                <ScoreRing score={m.value} size={56} />
              </div>
              <div className="text-xs text-muted-foreground">{m.label}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Strong / Weak */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2 text-emerald-400">
              <CheckCircle className="h-4 w-4" /> نقاط القوة
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {evaluation.strongPoints.map((p, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                <Star className="h-3 w-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                {p}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-4 w-4" /> نقاط الضعف
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {evaluation.weakPoints.map((p, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                <AlertTriangle className="h-3 w-3 text-red-400 mt-0.5 flex-shrink-0" />
                {p}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recommendation */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Lightbulb className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-sm font-semibold mb-1">توصية القاضي</div>
              <div className="text-sm text-muted-foreground leading-relaxed">{evaluation.recommendation}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={onReset} className="w-full" variant="outline">
        <RotateCcw className="h-4 w-4 ml-2" />
        محاكاة جديدة
      </Button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Stage = "setup" | "simulation" | "evaluation";

export default function OpponentSimulator() {
  const [stage, setStage] = useState<Stage>("setup");
  const [caseDescription, setCaseDescription] = useState("");
  const [side, setSide] = useState<"plaintiff" | "defendant">("plaintiff");
  const [caseType, setCaseType] = useState("civil");
  const [difficulty, setDifficulty] = useState("intermediate");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const round = messages.filter(m => m.role === "user").length;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startSimulation = () => {
    if (!caseDescription.trim()) {
      toast({ title: "وصف القضية مطلوب", variant: "destructive" });
      return;
    }
    const sideLabel = side === "plaintiff" ? "المدعي" : "المدعى عليه";
    const diffLabel = DIFFICULTIES.find(d => d.value === difficulty)?.label ?? "";
    const typeLabel = CASE_TYPES.find(t => t.value === caseType)?.label ?? "";

    setMessages([{
      role: "opponent",
      content: `**جلسة المحاكاة — جاهز للمرافعة**\n\nأنا محامي الخصم في هذه القضية ${typeLabel}. أنت تمثّل جانب **${sideLabel}**، وأنا في المقابل.\n\nالمستوى: ${diffLabel}\n\nابدأ بعرض حجتك الأولى — سأردّ عليها بكل ما أملكه من أدلة وحجج قانونية. الجلسة مفتوحة! 🏛️`,
      round: 0,
    }]);
    setStage("simulation");
  };

  const sendArgument = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Message = { role: "user", content: input.trim(), round: round + 1 };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/opponent-simulator/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseDescription, side, caseType, difficulty, history, userMessage: input.trim() }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "opponent", content: data.response, round: round + 1 }]);
    } catch {
      toast({ title: "خطأ في الاتصال", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const requestEvaluation = async () => {
    if (round < 2) {
      toast({ title: "قدّم على الأقل حجتين للحصول على تقييم", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/opponent-simulator/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseDescription, side, caseType, history }),
      });
      const data = await res.json();
      setEvaluation(data);
      setStage("evaluation");
    } catch {
      toast({ title: "تعذّر التقييم", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setStage("setup");
    setMessages([]);
    setEvaluation(null);
    setCaseDescription("");
  };

  const diffConfig = DIFFICULTIES.find(d => d.value === difficulty)!;

  // ── SETUP STAGE ────────────────────────────────────────────────────────────
  if (stage === "setup") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2 pb-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3" style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(201,168,76,0.15))" }}>
            <Swords className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-3xl font-black">محاكي الخصم</h1>
          <p className="text-muted-foreground">تدرّب على المرافعة في مواجهة محامٍ خصم مدعوم بالذكاء الاصطناعي</p>
        </div>

        <Card className="border-primary/10">
          <CardContent className="p-6 space-y-5">

            {/* Case Description */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">ملخص القضية</Label>
              <Textarea
                placeholder="اكتب ملخصاً موجزاً للقضية: الأطراف، الوقائع، وما تطالب به..."
                className="min-h-[100px] resize-none"
                value={caseDescription}
                onChange={e => setCaseDescription(e.target.value)}
              />
              <div className="flex gap-2 flex-wrap">
                {SAMPLE_CASES.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setCaseDescription(s)}
                    className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground transition-colors text-right"
                  >
                    مثال {i + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Side */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">موقفك في القضية</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SIDES.map(s => (
                  <button
                    key={s.value}
                    onClick={() => setSide(s.value as any)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                      side === s.value
                        ? "border-primary bg-primary/5"
                        : "border-muted bg-card hover:border-muted-foreground/30"
                    )}
                  >
                    <span className="text-2xl">{s.icon}</span>
                    <span className="font-semibold text-sm">{s.label}</span>
                    <span className="text-xs text-muted-foreground">{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Case Type */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">نوع القضية</Label>
              <Select value={caseType} onValueChange={setCaseType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CASE_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Difficulty */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">مستوى الخصم</Label>
              <div className="grid grid-cols-3 gap-2">
                {DIFFICULTIES.map(d => (
                  <button
                    key={d.value}
                    onClick={() => setDifficulty(d.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all",
                      difficulty === d.value ? "border-primary bg-primary/5" : "border-muted bg-card hover:border-muted-foreground/30"
                    )}
                  >
                    <span className={cn("text-sm font-bold", d.color)}>{d.label}</span>
                    <span className="text-[11px] text-muted-foreground text-center leading-tight">{d.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={startSimulation} className="w-full h-11 text-base font-bold" size="lg">
              <Play className="h-5 w-5 ml-2" />
              ابدأ المحاكاة
            </Button>
          </CardContent>
        </Card>

        {/* How it works */}
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { icon: Gavel, title: "قدّم حجتك", desc: "اكتب موقفك القانوني" },
            { icon: Swords, title: "الخصم يردّ", desc: "AI يعترض ويجادل" },
            { icon: Trophy, title: "احصل على تقييم", desc: "نقاط ضعف وقوة" },
          ].map(step => (
            <div key={step.title} className="p-3 rounded-xl bg-muted/30 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
                <step.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="text-xs font-semibold">{step.title}</div>
              <div className="text-[11px] text-muted-foreground">{step.desc}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── EVALUATION STAGE ───────────────────────────────────────────────────────
  if (stage === "evaluation" && evaluation) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw className="h-4 w-4 ml-1" />
            من البداية
          </Button>
          <div>
            <h1 className="text-xl font-bold">نتيجة التقييم</h1>
            <p className="text-xs text-muted-foreground">تحليل أداؤك في المرافعة ({round} جولة)</p>
          </div>
        </div>
        <EvaluationPanel evaluation={evaluation} onReset={reset} />
      </div>
    );
  }

  // ── SIMULATION STAGE ───────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={reset} className="text-muted-foreground hover:text-foreground">
            <RotateCcw className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Swords className="h-5 w-5 text-red-400" />
              جلسة المحاكاة
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className="text-xs py-0">
                {CASE_TYPES.find(t => t.value === caseType)?.label.split("—")[0].trim()}
              </Badge>
              <Badge variant="outline" className={cn("text-xs py-0", diffConfig.color)}>
                {diffConfig.label}
              </Badge>
              <span className="text-xs text-muted-foreground">جولة {round}</span>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={requestEvaluation}
          disabled={isLoading || round < 2}
          className="gap-2"
        >
          <Trophy className="h-4 w-4 text-primary" />
          طلب التقييم
          {round < 2 && <span className="text-[10px] text-muted-foreground">(بعد جولتين)</span>}
        </Button>
      </div>

      {/* Argument strength indicator */}
      <div className="mb-3 flex-shrink-0">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>تقدّم الجلسة</span>
          <span>{round} / 5+ جولات موصى بها</span>
        </div>
        <Progress value={Math.min(100, round * 20)} className="h-1.5" />
      </div>

      {/* Chat */}
      <div className="flex-1 rounded-2xl border bg-card overflow-hidden flex flex-col shadow-lg">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-5">
            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} />
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
                  <Swords className="w-4 h-4 text-red-400" />
                </div>
                <div className="bg-red-500/8 border border-red-500/15 rounded-2xl rounded-tr-sm px-4 py-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                  <span className="text-sm text-muted-foreground">الخصم يصوغ ردّه...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t p-4 bg-card space-y-2">
          <div className="flex gap-3">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="اكتب حجتك القانونية هنا..."
              className="flex-1 resize-none min-h-[70px] max-h-[140px] bg-muted/50 border-none focus-visible:ring-1 text-sm"
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendArgument();
                }
              }}
              disabled={isLoading}
            />
            <Button
              onClick={sendArgument}
              disabled={!input.trim() || isLoading}
              className="self-end px-4 h-10"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Enter للإرسال · Shift+Enter لسطر جديد</p>
            {round >= 2 && (
              <button
                onClick={requestEvaluation}
                className="text-xs text-primary hover:underline flex items-center gap-1"
                disabled={isLoading}
              >
                <Trophy className="h-3 w-3" />
                اطلب تقييمك الآن
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
