/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- pre-existing lint debt; authFetch migration */
import { useState } from "react";
import {
  Gavel, Send, RotateCcw, FileText, Shield, Scale, Users, DollarSign,
  ClipboardList, Lightbulb, AlertTriangle, CheckCircle2, ChevronDown,
  ChevronUp, BookOpen, Star, Target, Loader2, Copy, TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/authFetch";

const BASE_URL = import.meta.env.BASE_URL ?? "/";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = "أدلة" | "إجراءات" | "موضوعية" | "شهود" | "تعويضات";

interface JudgeQuestion {
  category: Category;
  question: string;
  suggestedAnswer: string;
  legalRef: string;
  strategy: string;
  difficulty: "high" | "medium" | "low";
}

interface PrepReport {
  readinessScore: number;
  openingStatement: string;
  questions: JudgeQuestion[];
  criticalTips: string[];
  requiredDocuments: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CASE_TYPES = [
  { value: "civil",       label: "مدني — عقود ومسؤولية تقصيرية", icon: "⚖️" },
  { value: "commercial",  label: "تجاري — شركات وعقود تجارية",    icon: "🏢" },
  { value: "labor",       label: "عمالي — نزاعات العمل",           icon: "👷" },
  { value: "family",      label: "أسري — طلاق ونفقة وحضانة",      icon: "👪" },
  { value: "real_estate", label: "عقاري — ملكية وإيجار",           icon: "🏠" },
  { value: "criminal",    label: "جنائي — دفاع وادعاء",            icon: "🔒" },
];

const JUDGE_STYLES = [
  { value: "strict",    label: "صارم",    icon: "⚡", desc: "دقيق في الشكليات، يقاطع عند الانحراف" },
  { value: "balanced",  label: "متوازن",  icon: "⚖️", desc: "يستمع بإنصاف، يطرح أسئلة التوضيح" },
  { value: "fast",      label: "سريع",    icon: "⏩", desc: "يريد الإيجاز، لا يتحمل التكرار" },
  { value: "technical", label: "تقني",    icon: "📖", desc: "يتعمق في النصوص، يطلب المراجع الدقيقة" },
];

const CATEGORY_CONFIG: Record<Category, { icon: any; color: string; bg: string }> = {
  "أدلة":      { icon: FileText,     color: "text-blue-600",   bg: "bg-blue-50 dark:bg-blue-950/30" },
  "إجراءات":  { icon: ClipboardList, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/30" },
  "موضوعية":  { icon: Scale,         color: "text-emerald-600",bg: "bg-emerald-50 dark:bg-emerald-950/30" },
  "شهود":     { icon: Users,         color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/30" },
  "تعويضات":  { icon: DollarSign,    color: "text-red-600",    bg: "bg-red-50 dark:bg-red-950/30" },
};

const DIFFICULTY_CONFIG = {
  high:   { label: "صعب",   color: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" },
  medium: { label: "متوسط", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400" },
  low:    { label: "سهل",   color: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" },
};

const CATEGORIES: Category[] = ["أدلة", "إجراءات", "موضوعية", "شهود", "تعويضات"];

// ─── Question Card ────────────────────────────────────────────────────────────

function QuestionCard({ q, index }: { q: JudgeQuestion; index: number }) {
  const [open, setOpen] = useState(false);
  const cfg = CATEGORY_CONFIG[q.category] ?? CATEGORY_CONFIG["أدلة"];
  const diff = DIFFICULTY_CONFIG[q.difficulty] ?? DIFFICULTY_CONFIG.medium;
  const Icon = cfg.icon;

  const copyAnswer = () => {
    navigator.clipboard.writeText(q.suggestedAnswer);
    toast.success("تم نسخ الإجابة");
  };

  return (
    <Card className={cn("border border-border/60 overflow-hidden transition-shadow hover:shadow-md", open && "shadow-md")}>
      <button
        className="w-full text-right p-4 flex items-start gap-3"
        onClick={() => setOpen(o => !o)}
      >
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5", cfg.bg)}>
          <Icon className={cn("h-4 w-4", cfg.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="outline" className={cn("text-xs", cfg.color)}>{q.category}</Badge>
            <Badge className={cn("text-xs", diff.color)}>{diff.label}</Badge>
            <span className="text-xs text-muted-foreground mr-auto">س{index + 1}</span>
          </div>
          <p className="text-sm font-semibold leading-snug text-right">{q.question}</p>
        </div>
        <div className="flex-shrink-0 mt-0.5">
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/40 pt-3">
          <div className="rounded-xl bg-primary/5 p-3 space-y-1 relative">
            <p className="text-xs font-semibold text-primary mb-1 flex items-center gap-1">
              <Scale className="h-3.5 w-3.5" />الإجابة المقترحة
            </p>
            <p className="text-sm leading-relaxed">{q.suggestedAnswer}</p>
            <Button size="icon" variant="ghost" className="absolute top-2 left-2 h-7 w-7" onClick={copyAnswer}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" />المرجع القانوني
              </p>
              <p className="text-xs leading-relaxed">{q.legalRef}</p>
            </div>
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 p-3 border border-amber-200 dark:border-amber-800">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1">
                <Target className="h-3.5 w-3.5" />النصيحة الاستراتيجية
              </p>
              <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">{q.strategy}</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Readiness Gauge ──────────────────────────────────────────────────────────

function ReadinessGauge({ score }: { score: number }) {
  const color = score >= 75 ? "text-emerald-500" : score >= 50 ? "text-yellow-500" : "text-red-500";
  const label = score >= 75 ? "استعداد ممتاز" : score >= 50 ? "استعداد متوسط" : "يحتاج تحسين";
  const barColor = score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-yellow-500" : "bg-red-500";

  return (
    <Card className="border border-border/60">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold">مؤشر الاستعداد للجلسة</span>
          <span className={cn("text-3xl font-extrabold tabular-nums", color)}>{score}%</span>
        </div>
        <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full transition-all duration-700", barColor)} style={{ width: `${score}%` }} />
        </div>
        <p className={cn("text-xs font-medium mt-1", color)}>{label}</p>
      </CardContent>
    </Card>
  );
}

// ─── Setup Form ───────────────────────────────────────────────────────────────

function SetupForm({ onGenerate }: { onGenerate: (report: PrepReport) => void }) {
  const [caseType, setCaseType] = useState("civil");
  const [judgeStyle, setJudgeStyle] = useState("balanced");
  const [factsummary, setFactsummary] = useState("");
  const [strengths, setStrengths] = useState("");
  const [weaknesses, setWeaknesses] = useState("");
  const [previousNotes, setPreviousNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!factsummary.trim()) {
      toast.error("ملخص الوقائع مطلوب");
      return;
    }
    setLoading(true);
    try {
      const res = await authFetch(`${BASE_URL}api/judge-prep/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseType, judgeStyle, factsummary, strengths, weaknesses, previousNotes }),
      });
      if (!res.ok) throw new Error("failed");
      const data: PrepReport = await res.json();
      onGenerate(data);
    } catch {
      toast.error("حدث خطأ، حاول مجدداً");
    } finally {
      setLoading(false);
    }
  };

  const selectedStyle = JUDGE_STYLES.find(s => s.value === judgeStyle);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-2">
          <Gavel className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">توقع أسئلة القاضي</h1>
        <p className="text-muted-foreground text-sm">أدخل تفاصيل القضية وسيولّد الذكاء الاصطناعي 12 سؤالاً محتملاً مع الإجابات والاستراتيجيات</p>
      </div>

      <Card className="border border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">تفاصيل القضية</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Case Type */}
          <div className="space-y-2">
            <Label>نوع القضية *</Label>
            <Select value={caseType} onValueChange={setCaseType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CASE_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.icon} {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Facts */}
          <div className="space-y-2">
            <Label>ملخص وقائع القضية *</Label>
            <Textarea
              value={factsummary}
              onChange={e => setFactsummary(e.target.value)}
              placeholder="اذكر وقائع القضية بإيجاز: الأطراف، موضوع النزاع، التواريخ الرئيسية، ما حدث..."
              rows={5}
              className="resize-none"
            />
          </div>

          {/* Judge Style */}
          <div className="space-y-2">
            <Label>أسلوب القاضي</Label>
            <div className="grid grid-cols-2 gap-2">
              {JUDGE_STYLES.map(s => (
                <button
                  key={s.value}
                  onClick={() => setJudgeStyle(s.value)}
                  className={cn(
                    "p-3 rounded-xl border-2 text-right transition-all",
                    judgeStyle === s.value
                      ? "border-primary bg-primary/5"
                      : "border-border/60 hover:border-primary/40 bg-muted/20"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{s.icon}</span>
                    <span className="font-semibold text-sm">{s.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="flex items-center gap-1 text-emerald-600">
                <TrendingUp className="h-3.5 w-3.5" />نقاط القوة
              </Label>
              <Textarea
                value={strengths}
                onChange={e => setStrengths(e.target.value)}
                placeholder="المستندات الداعمة، الشهود، الحجج القوية..."
                rows={3}
                className="resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1 text-red-500">
                <AlertTriangle className="h-3.5 w-3.5" />نقاط الضعف
              </Label>
              <Textarea
                value={weaknesses}
                onChange={e => setWeaknesses(e.target.value)}
                placeholder="الثغرات، المستندات الناقصة، الجوانب الغامضة..."
                rows={3}
                className="resize-none"
              />
            </div>
          </div>

          {/* Previous Notes */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1 text-muted-foreground">
              <ClipboardList className="h-3.5 w-3.5" />ملاحظات جلسات سابقة <span className="text-xs">(اختياري)</span>
            </Label>
            <Textarea
              value={previousNotes}
              onChange={e => setPreviousNotes(e.target.value)}
              placeholder="ما قاله القاضي في الجلسة الماضية، الملاحظات التي أبدتها المحكمة..."
              rows={3}
              className="resize-none"
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={generate} disabled={loading} size="lg" className="w-full gap-2 text-base py-6">
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            جارٍ تحليل القضية وتوليد الأسئلة...
          </>
        ) : (
          <>
            <Gavel className="h-5 w-5" />
            توليد تقرير الاستعداد للجلسة
          </>
        )}
      </Button>
    </div>
  );
}

// ─── Report View ──────────────────────────────────────────────────────────────

function ReportView({ report, onReset }: { report: PrepReport; onReset: () => void }) {
  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");

  const filtered = activeCategory === "all"
    ? report.questions
    : report.questions.filter(q => q.category === activeCategory);

  const categoryCounts = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = report.questions.filter(q => q.category === cat).length;
    return acc;
  }, {} as Record<Category, number>);

  const copyOpening = () => {
    navigator.clipboard.writeText(report.openingStatement);
    toast.success("تم نسخ الجملة الافتتاحية");
  };

  return (
    <div className="space-y-5">
      {/* Top Bar */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">تقرير الاستعداد للجلسة</h1>
          <p className="text-muted-foreground text-sm">{report.questions.length} سؤالاً محتملاً في {CATEGORIES.length} فئات</p>
        </div>
        <Button variant="outline" onClick={onReset} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          قضية جديدة
        </Button>
      </div>

      {/* Readiness Score */}
      <ReadinessGauge score={report.readinessScore} />

      {/* Opening Statement */}
      <Card className="border border-border/60 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            الجملة الافتتاحية أمام القاضي
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed font-medium mb-3">"{report.openingStatement}"</p>
          <Button size="sm" variant="outline" onClick={copyOpening} className="gap-2">
            <Copy className="h-3.5 w-3.5" />نسخ
          </Button>
        </CardContent>
      </Card>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={activeCategory === "all" ? "default" : "outline"}
          onClick={() => setActiveCategory("all")}
          className="text-xs"
        >
          الكل ({report.questions.length})
        </Button>
        {CATEGORIES.map(cat => {
          const cfg = CATEGORY_CONFIG[cat];
          const Icon = cfg.icon;
          return (
            <Button
              key={cat}
              size="sm"
              variant={activeCategory === cat ? "default" : "outline"}
              onClick={() => setActiveCategory(cat)}
              className="text-xs gap-1"
            >
              <Icon className="h-3.5 w-3.5" />
              {cat} ({categoryCounts[cat] || 0})
            </Button>
          );
        })}
      </div>

      {/* Questions */}
      <div className="space-y-3">
        {filtered.map((q, i) => (
          <QuestionCard key={i} q={q} index={report.questions.indexOf(q)} />
        ))}
      </div>

      <Separator />

      {/* Bottom Grid: Tips + Documents */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Critical Tips */}
        <Card className="border border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              نصائح حرجة قبل الجلسة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {report.criticalTips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">{i + 1}</span>
                  <span className="leading-snug">{tip}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Required Documents */}
        <Card className="border border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              قائمة المستندات المطلوبة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {report.requiredDocuments.map((doc, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                  <span>{doc}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Button variant="outline" onClick={onReset} className="w-full gap-2">
        <RotateCcw className="h-4 w-4" />
        تحليل قضية جديدة
      </Button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function JudgePrep() {
  const [report, setReport] = useState<PrepReport | null>(null);

  return (
    <div className="space-y-6">
      {report ? (
        <ReportView report={report} onReset={() => setReport(null)} />
      ) : (
        <SetupForm onGenerate={setReport} />
      )}
    </div>
  );
}
