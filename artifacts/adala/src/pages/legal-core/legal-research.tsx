import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BookOpen, Search, Loader2, Scale, Gavel, FileText, Briefcase,
  Home, Shield, AlertTriangle, ChevronLeft, Sparkles, BookMarked, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const CATEGORY_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  all: { label: "الكل", icon: BookOpen, color: "#6366F1" },
  civil: { label: "المدني", icon: Scale, color: "#3B82F6" },
  commercial: { label: "التجاري", icon: Briefcase, color: "#10B981" },
  labor: { label: "العمالي", icon: FileText, color: "#F59E0B" },
  family: { label: "الأسري", icon: Home, color: "#EC4899" },
  real_estate: { label: "العقاري", icon: Home, color: "#8B5CF6" },
  criminal: { label: "الجنائي", icon: Gavel, color: "#EF4444" },
  compliance: { label: "الامتثال", icon: Shield, color: "#06B6D4" },
};

const SAMPLE_QUERIES = [
  "ما هي مدة التقادم في المطالبات التجارية؟",
  "شروط صحة عقد الإيجار",
  "حقوق العامل عند إنهاء الخدمة",
  "متطلبات حماية البيانات الشخصية",
  "إجراءات تأسيس شركة محدودة المسؤولية",
  "أحكام الطلاق والنفقة",
];

export default function LegalResearch() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedResult, setSelectedResult] = useState<any>(null);

  const { data: featured = [] } = useQuery<any[]>({
    queryKey: ["legal-research-featured"],
    queryFn: () => fetch("/api/legal-research/featured").then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const searchMutation = useMutation({
    mutationFn: ({ q, cat }: { q: string; cat: string }) =>
      fetch("/api/legal-research/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, category: cat }),
      }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const handleSearch = (q = query) => {
    if (!q.trim()) return;
    searchMutation.mutate({ q, cat: category });
    setSelectedResult(null);
  };

  const results = searchMutation.data?.results ?? [];
  const summary = searchMutation.data?.summary ?? "";
  const hasSearched = searchMutation.isSuccess;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-2">
          <BookOpen className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-black">البحث القانوني الذكي</h1>
        <p className="text-muted-foreground text-sm">ابحث في الأنظمة واللوائح والأحكام السعودية بالذكاء الاصطناعي</p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSearch()}
          placeholder="ابحث في الأنظمة القانونية... مثال: مدة التقادم في العقود التجارية"
          className="pr-12 pl-32 h-12 text-base rounded-2xl border-primary/20 focus-visible:ring-primary/30"
        />
        <Button
          onClick={() => handleSearch()}
          disabled={!query.trim() || searchMutation.isPending}
          className="absolute left-2 top-1/2 -translate-y-1/2 h-8 rounded-xl gap-2"
        >
          {searchMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          بحث
        </Button>
      </div>

      {/* Category Filters */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setCategory(key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border",
              category === key
                ? "border-primary bg-primary/10 text-primary"
                : "border-muted bg-card text-muted-foreground hover:border-primary/30"
            )}
          >
            <cfg.icon className="h-3.5 w-3.5" style={{ color: category === key ? "#2563EB" : undefined }} />
            {cfg.label}
          </button>
        ))}
      </div>

      {/* Sample Queries */}
      {!hasSearched && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">أسئلة شائعة:</p>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_QUERIES.map(q => (
              <button key={q} onClick={() => { setQuery(q); handleSearch(q); }}
                className="text-xs px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground/70 border border-border hover:border-primary/30 transition-all">
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {searchMutation.isPending && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">جاري البحث في المكتبة القانونية...</p>
        </div>
      )}

      {hasSearched && !searchMutation.isPending && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Results list */}
          <div className="lg:col-span-2 space-y-3">
            {/* AI Summary */}
            {summary && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-primary mb-1">ملخص ذكي</p>
                      <p className="text-sm leading-relaxed text-foreground/85">{summary}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {results.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>لا توجد نتائج — جرّب كلمات مفتاحية مختلفة</p>
              </div>
            ) : (
              results.map((r: any, i: number) => {
                const catCfg = CATEGORY_CONFIG[r.category_key ?? "civil"] ?? CATEGORY_CONFIG.civil;
                return (
                  <Card key={i}
                    onClick={() => setSelectedResult(r)}
                    className={cn("cursor-pointer hover:border-primary/40 transition-all", selectedResult === r && "border-primary/50 bg-primary/5")}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant="outline" className="text-[10px] px-2 py-0" style={{ borderColor: `${catCfg.color}50`, color: catCfg.color }}>
                              {r.category}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">{r.ref}</span>
                          </div>
                          <h3 className="font-bold text-sm">{r.title}</h3>
                        </div>
                        <ChevronLeft className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{r.summary}</p>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* Detail Panel */}
          <div className="lg:col-span-1">
            {selectedResult ? (
              <Card className="sticky top-4 border-primary/20">
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm leading-tight">{selectedResult.title}</CardTitle>
                    <button onClick={() => setSelectedResult(null)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
                      <ChevronLeft className="h-4 w-4 rotate-180" />
                    </button>
                  </div>
                  <Badge variant="outline" className="text-[10px] w-fit mt-1">{selectedResult.ref}</Badge>
                </CardHeader>
                <Separator />
                <CardContent className="p-4">
                  <ScrollArea className="max-h-[400px]">
                    <p className="text-sm leading-relaxed text-foreground/85">{selectedResult.content}</p>
                  </ScrollArea>
                  <Separator className="my-3" />
                  <div className="text-xs text-muted-foreground">{selectedResult.summary}</div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="p-6 text-center text-muted-foreground">
                  <BookMarked className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">اختر نتيجة لعرض التفاصيل</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Featured (no search yet) */}
      {!hasSearched && featured.length > 0 && (
        <div>
          <h2 className="text-sm font-bold mb-3 text-muted-foreground">أبرز الأنظمة</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {featured.map((item: any, i: number) => {
              const catCfg = CATEGORY_CONFIG[item.category_key] ?? CATEGORY_CONFIG.civil;
              return (
                <Card key={i} className="hover:border-primary/30 transition-all cursor-pointer group"
                  onClick={() => { setQuery(item.title); handleSearch(item.title); }}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${catCfg.color}18` }}>
                        <catCfg.icon className="h-3.5 w-3.5" style={{ color: catCfg.color }} />
                      </div>
                      <Badge variant="outline" className="text-[10px] px-2 py-0">{item.category}</Badge>
                    </div>
                    <h3 className="text-xs font-bold mb-1 group-hover:text-primary transition-colors">{item.title}</h3>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{item.summary}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
