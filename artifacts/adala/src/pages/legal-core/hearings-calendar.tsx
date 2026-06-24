/**
 * Hearings Calendar — تقويم جلسات المحكمة
 * عرض كل جلسات المكتب القادمة والسابقة في مكان واحد
 */
import { useState }   from "react";
import { useQuery }   from "@tanstack/react-query";
import { Link }       from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button }     from "@/components/ui/button";
import { Badge }      from "@/components/ui/badge";
import { Skeleton }   from "@/components/ui/skeleton";
import { Input }      from "@/components/ui/input";
import {
  Gavel, CalendarDays, MapPin, User, Scale, Search,
  ChevronRight, Clock, CheckCircle2, XCircle, AlertCircle,
  Building2, Hash, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ── Status config ── */
const STATUS_CFG: Record<string, { label: string; icon: any; color: string; dot: string }> = {
  scheduled: { label: "مجدولة",  icon: Clock,         color: "bg-blue-50 text-blue-700 border-blue-200",     dot: "bg-blue-500" },
  completed: { label: "منتهية",  icon: CheckCircle2,  color: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  postponed: { label: "مؤجلة",   icon: AlertCircle,   color: "bg-amber-50 text-amber-700 border-amber-200",   dot: "bg-amber-500" },
  cancelled: { label: "ملغاة",   icon: XCircle,       color: "bg-red-50 text-red-700 border-red-200",         dot: "bg-slate-400" },
};

const TYPE_MAP: Record<string, string> = {
  criminal: "جنائية", civil: "مدنية", commercial: "تجارية",
  labor: "عمالية", real_estate: "عقارية",
};

/* ── Group hearings by week ── */
function groupByWeek(hearings: any[]) {
  const groups: Record<string, any[]> = {};
  for (const h of hearings) {
    const d    = new Date(h.hearing_date);
    const week = getWeekKey(d);
    if (!groups[week]) groups[week] = [];
    groups[week].push(h);
  }
  return groups;
}

function getWeekKey(d: Date): string {
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  return start.toISOString().slice(0, 10);
}

function weekLabel(key: string): string {
  const start = new Date(key);
  const end   = new Date(key);
  end.setDate(start.getDate() + 6);
  return `${start.toLocaleDateString("ar-SA", { day: "numeric", month: "short" })} — ${end.toLocaleDateString("ar-SA", { day: "numeric", month: "short", year: "numeric" })}`;
}

/* ── Hearing card ── */
function HearingCard({ h }: { h: any }) {
  const st  = STATUS_CFG[h.status] ?? STATUS_CFG.scheduled;
  const dt  = new Date(h.hearing_date);
  const now = new Date();
  const daysUntil = Math.ceil((dt.getTime() - now.getTime()) / 86400000);
  const isPast = dt < now;

  return (
    <div className={cn(
      "flex gap-4 p-4 rounded-2xl border transition-all hover:shadow-md",
      isPast ? "bg-muted/20 opacity-80" : "bg-background shadow-sm",
    )}>
      {/* Date block */}
      <div className="shrink-0 w-14 text-center flex flex-col items-center justify-center bg-primary/5 rounded-xl py-2">
        <p className="text-2xl font-bold text-primary leading-none">{dt.getDate()}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {dt.toLocaleDateString("ar-SA", { month: "short" })}
        </p>
        <p className="text-xs text-muted-foreground/70">
          {dt.toLocaleDateString("ar-SA", { weekday: "short" })}
        </p>
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <Link href={`/cases/${h.case_id}`}>
              <p className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate cursor-pointer">
                {h.case_title}
              </p>
            </Link>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {h.case_number && (
                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                  <Hash className="h-3 w-3" />{h.case_number}
                </span>
              )}
              {h.case_type && (
                <Badge variant="outline" className="text-xs h-4 px-1.5">
                  {TYPE_MAP[h.case_type] ?? h.case_type}
                </Badge>
              )}
              {h.client_name && (
                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                  <User className="h-3 w-3" />{h.client_name}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium flex items-center gap-1", st.color)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
              {st.label}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {dt.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
          </span>
          {h.court_name && (
            <span className="flex items-center gap-1">
              <Building2 className="h-3 w-3" />{h.court_name}
            </span>
          )}
          {h.court_room && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />{h.court_room}
            </span>
          )}
          {!isPast && daysUntil >= 0 && (
            <span className={cn(
              "font-medium",
              daysUntil === 0 ? "text-red-600" :
              daysUntil <= 2 ? "text-orange-600" :
              daysUntil <= 7 ? "text-amber-600" :
              "text-muted-foreground",
            )}>
              {daysUntil === 0 ? "⚡ اليوم" : daysUntil === 1 ? "⏰ غداً" : `بعد ${daysUntil} يوم`}
            </span>
          )}
        </div>

        {h.notes && (
          <p className="mt-1.5 text-xs text-muted-foreground/80 leading-relaxed line-clamp-2">{h.notes}</p>
        )}
        {h.outcome && (
          <div className="mt-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg px-2 py-1">
            <span className="font-medium">النتيجة:</span> {h.outcome}
          </div>
        )}
      </div>

      <Link href={`/cases/${h.case_id}`}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0 mt-1">
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
}

/* ══════════════════ MAIN ══════════════════ */
export default function HearingsCalendar() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "upcoming" | "past">("upcoming");

  const { data: hearings = [], isLoading } = useQuery<any[]>({
    queryKey: ["hearings-calendar"],
    queryFn:  () => fetch(`${BASE}/api/cases/hearings/calendar`).then(r => r.ok ? r.json() : []),
    staleTime: 60_000,
  });

  const now = new Date();
  const filtered = hearings.filter(h => {
    const dt    = new Date(h.hearing_date);
    const matchFilter =
      filter === "all"      ? true :
      filter === "upcoming" ? dt >= now :
      dt < now;
    const matchSearch =
      !search.trim() ||
      h.case_title?.toLowerCase().includes(search.toLowerCase()) ||
      h.case_number?.includes(search) ||
      h.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      h.court_name?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const upcoming = hearings.filter(h => new Date(h.hearing_date) >= now && h.status !== "cancelled");
  const today    = upcoming.filter(h => {
    const d = new Date(h.hearing_date);
    return d.toDateString() === now.toDateString();
  });
  const thisWeek = upcoming.filter(h => {
    const d = new Date(h.hearing_date);
    const diff = (d.getTime() - now.getTime()) / 86400000;
    return diff >= 0 && diff < 7;
  });

  const grouped = groupByWeek(
    filter === "upcoming" ? filtered.slice().sort((a, b) => +new Date(a.hearing_date) - +new Date(b.hearing_date)) :
    filter === "past"     ? filtered.slice().sort((a, b) => +new Date(b.hearing_date) - +new Date(a.hearing_date)) :
    filtered.slice().sort((a, b) => +new Date(b.hearing_date) - +new Date(a.hearing_date))
  );

  return (
    <div className="space-y-6" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gavel className="h-6 w-6 text-primary" />تقويم الجلسات
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">جلسات المحكمة لجميع القضايا</p>
        </div>
        <Link href="/cases">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Scale className="h-4 w-4" />القضايا
          </Button>
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "جلسات اليوم",     val: today.length,    color: "text-red-600",   bg: "bg-red-50",   icon: AlertCircle },
          { label: "هذا الأسبوع",     val: thisWeek.length, color: "text-amber-600", bg: "bg-amber-50", icon: CalendarDays },
          { label: "إجمالي القادمة",  val: upcoming.length, color: "text-blue-600",  bg: "bg-blue-50",  icon: Gavel },
        ].map(({ label, val, color, bg, icon: Icon }) => (
          <Card key={label} className="border shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("p-2.5 rounded-xl", bg)}>
                <Icon className={cn("h-5 w-5", color)} />
              </div>
              <div>
                <p className={cn("text-2xl font-bold", color)}>{val}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters + Search */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl">
          {([
            ["upcoming", "القادمة"],
            ["past",     "السابقة"],
            ["all",      "الكل"],
          ] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={cn(
                "px-3 py-1.5 text-xs rounded-lg font-medium transition-all",
                filter === val ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="ps-9 h-9 text-sm"
            placeholder="ابحث بالقضية أو الموكل..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      )}

      {/* Empty */}
      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-20 space-y-3">
          <Gavel className="h-14 w-14 text-muted-foreground/20 mx-auto" />
          <p className="text-muted-foreground">
            {search ? "لا نتائج مطابقة للبحث" : "لا توجد جلسات في هذا النطاق"}
          </p>
          <Link href="/cases">
            <Button variant="outline" size="sm">افتح قضية وأضف جلسة</Button>
          </Link>
        </div>
      )}

      {/* Grouped list */}
      {!isLoading && filtered.length > 0 && (
        <div className="space-y-6">
          {Object.entries(grouped).map(([weekKey, items]) => (
            <div key={weekKey}>
              <div className="flex items-center gap-3 mb-3">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-muted-foreground">{weekLabel(weekKey)}</span>
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">{items.length} جلسة</span>
              </div>
              <div className="space-y-3">
                {items.map((h: any) => <HearingCard key={h.id} h={h} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
