import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Bot, Zap, AlertTriangle, Gavel, FileText, CalendarDays, ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/";

type Briefing = {
  todayEvents: any[];
  stats: {
    hearingsToday: number;
    overdueInvoices: number;
    overdueTotal: number;
    openCases: number;
    pendingContracts: number;
    draftInvoices: number;
  };
};

function getHour() { return new Date().getHours(); }
function greetMsg() {
  const h = getHour();
  if (h < 12) return "صباح الخير";
  if (h < 17) return "مساء الخير";
  return "مساء النور";
}

export function ExecutiveAssistant() {
  const { data, isLoading } = useQuery<Briefing>({
    queryKey: ["ai-briefing"],
    queryFn: () => fetch(`${BASE}api/ai-agent/briefing`).then(r => r.json()),
    refetchInterval: 120_000,
  });

  const s = data?.stats;
  const hasAlerts = s && (s.hearingsToday > 0 || s.overdueInvoices > 0 || s.openCases > 0);

  const items = [
    { label: "جلسات اليوم",   value: s?.hearingsToday   ?? 0, icon: Gavel,       href: "/calendar",  urgent: (s?.hearingsToday ?? 0) > 0, color: "text-blue-400",   bg: "bg-blue-500/10"   },
    { label: "فواتير متأخرة", value: s?.overdueInvoices ?? 0, icon: AlertTriangle,href: "/invoices",  urgent: (s?.overdueInvoices ?? 0) > 0, color: "text-red-400", bg: "bg-red-500/10"    },
    { label: "قضايا نشطة",   value: s?.openCases        ?? 0, icon: Gavel,       href: "/cases",     urgent: false,                         color: "text-amber-400",bg: "bg-amber-500/10"  },
    { label: "عقود نشطة",     value: s?.pendingContracts ?? 0, icon: FileText,    href: "/contracts", urgent: false,                         color: "text-green-400",bg: "bg-green-500/10"  },
  ];

  return (
    <div className="rounded-2xl border border-primary/10 bg-gradient-to-l from-primary/5 to-transparent p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
      {/* Avatar + Greeting */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="relative">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-400 border-2 border-background" />
        </div>
        <div>
          <p className="text-xs font-semibold">{greetMsg()} — الوكيل التنفيذي</p>
          {isLoading ? (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Loader2 className="h-2.5 w-2.5 animate-spin" />يحضّر الإحاطة...</p>
          ) : hasAlerts ? (
            <p className="text-[10px] text-muted-foreground">
              لديك {[
                s!.hearingsToday > 0 && `${s!.hearingsToday} جلسة`,
                s!.overdueInvoices > 0 && `${s!.overdueInvoices} فاتورة متأخرة`,
              ].filter(Boolean).join(" · ")} تحتاج متابعة
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground">لا توجد تنبيهات عاجلة اليوم ✓</p>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex gap-2 flex-wrap flex-1">
        {isLoading
          ? Array(4).fill(0).map((_, i) => <div key={i} className="h-12 w-24 rounded-lg bg-muted/30 animate-pulse" />)
          : items.map(item => {
              const Icon = item.icon;
              return (
                <Link key={item.label} href={item.href}>
                  <div className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-all hover:scale-105",
                    item.urgent ? `${item.bg} border-current/20` : "bg-muted/20 border-border/20 hover:bg-muted/40"
                  )}>
                    <Icon className={cn("h-3.5 w-3.5 shrink-0", item.urgent ? item.color : "text-muted-foreground")} />
                    <div>
                      <p className={cn("text-base font-black leading-none", item.urgent ? item.color : "text-foreground")}>{item.value}</p>
                      <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">{item.label}</p>
                    </div>
                    {item.urgent && item.value > 0 && (
                      <div className="h-1.5 w-1.5 rounded-full bg-current animate-pulse mr-0.5 self-start mt-1" />
                    )}
                  </div>
                </Link>
              );
            })
        }
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 shrink-0">
        <Button size="sm" className="h-8 text-xs gap-1.5" asChild>
          <Link href="/command-center">
            <Zap className="h-3.5 w-3.5" />مركز الأوامر
          </Link>
        </Button>
        {(s?.overdueInvoices ?? 0) > 0 && (
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-red-500/20 text-red-400 hover:bg-red-500/5" asChild>
            <Link href="/invoices">
              <AlertTriangle className="h-3.5 w-3.5" />تحصيل
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
