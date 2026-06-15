import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Scale, Users, Receipt, FileText, CalendarDays, Bot, Sparkles,
  Plus, BarChart3, Settings, Search, ArrowRight, Zap,
  TrendingUp, Clock, BookOpen, Handshake, Bell, CreditCard,
  Brain, Shield, Globe, MessageCircle, ClipboardList,
} from "lucide-react";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

interface SearchResult {
  id: number;
  type: "case" | "client" | "invoice";
  title: string;
  subtitle?: string;
  href: string;
}

const QUICK_ACTIONS = [
  { label: "قضية جديدة",    icon: Scale,    href: "/cases",     color: "#6366F1", hint: "أضف ملف قضائي جديد" },
  { label: "موكل جديد",     icon: Users,    href: "/clients",   color: "#10B981", hint: "سجّل بيانات موكل" },
  { label: "فاتورة جديدة",  icon: Receipt,  href: "/invoices",  color: "#F59E0B", hint: "إصدار فاتورة" },
  { label: "تذكير جديد",    icon: Clock,    href: "/reminders", color: "#EC4899", hint: "ضع تذكيراً للمتابعة" },
];

const AI_COMMANDS = [
  { label: "لخّص يومي",        desc: "ملخص ذكي لنشاط اليوم",            icon: Brain,    href: "/ai-hub?cmd=summarize_day",  color: "#2563EB" },
  { label: "تحليل المخاطر",     desc: "اكتشف قضايا عالية المخاطر",       icon: Sparkles, href: "/ai-hub?cmd=risk_analysis",   color: "#A855F7" },
  { label: "المساعد القانوني",   desc: "اكتب، لخّص، راجع مستندات",         icon: Scale,    href: "/legal-ai",                   color: "#6366F1" },
  { label: "توقع الإيرادات",    desc: "تحليل التدفقات والتوقعات المالية", icon: TrendingUp, href: "/analytics",                 color: "#10B981" },
];

const NAV_ALL = [
  { label: "لوحة التحكم",        href: "/dashboard",          icon: BarChart3,    group: "القانوني" },
  { label: "القضايا",             href: "/cases",              icon: Scale,        group: "القانوني" },
  { label: "الموكلون",            href: "/clients",            icon: Users,        group: "القانوني" },
  { label: "العقود",              href: "/contracts",          icon: Handshake,    group: "القانوني" },
  { label: "الوثائق",             href: "/documents",          icon: BookOpen,     group: "القانوني" },
  { label: "التقويم",             href: "/calendar",           icon: CalendarDays, group: "القانوني" },
  { label: "المهام",              href: "/tasks",              icon: ClipboardList, group: "القانوني" },
  { label: "التذكيرات",           href: "/reminders",          icon: Bell,         group: "القانوني" },
  { label: "الفواتير",            href: "/invoices",           icon: Receipt,      group: "المالي"   },
  { label: "الإيرادات",           href: "/revenues",           icon: TrendingUp,   group: "المالي"   },
  { label: "المدفوعات",           href: "/payment-center",     icon: CreditCard,   group: "المالي"   },
  { label: "التقرير المالي",      href: "/financial-reports",  icon: BarChart3,    group: "المالي"   },
  { label: "مركز الذكاء",        href: "/ai-hub",             icon: Bot,          group: "الذكاء"   },
  { label: "المساعد القانوني",    href: "/legal-ai",           icon: Scale,        group: "الذكاء"   },
  { label: "البحث القانوني",      href: "/legal-research",     icon: Search,       group: "الذكاء"   },
  { label: "التحليلات",           href: "/analytics",          icon: BarChart3,    group: "التحليل"  },
  { label: "الرسائل",             href: "/messages",           icon: MessageCircle, group: "التواصل" },
  { label: "بوابة الموكلين",     href: "/client-portal",      icon: Globe,        group: "التواصل"  },
  { label: "إعدادات المكتب",     href: "/office-settings",    icon: Settings,     group: "الإعدادات"},
  { label: "المستخدمون",         href: "/users",              icon: Users,        group: "الإعدادات"},
  { label: "سجل المراجعة",       href: "/audit-logs",         icon: Shield,       group: "الإعدادات"},
];

const RESULT_ICONS: Record<string, any>    = { case: Scale, client: Users, invoice: Receipt };
const RESULT_COLORS: Record<string, string> = { case: "#6366F1", client: "#10B981", invoice: "#F59E0B" };
const RESULT_LABELS: Record<string, string> = { case: "قضية", client: "موكل", invoice: "فاتورة" };

export function CommandBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  /* ── Expose opener globally for trigger button ── */
  useEffect(() => {
    (window as any).__openCommandBar = () => setOpen(true);
    return () => { delete (window as any).__openCommandBar; };
  }, []);

  /* ── Keyboard shortcut ⌘K / Ctrl+K ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  /* ── Reset on close ── */
  useEffect(() => { if (!open) { setQuery(""); setResults([]); } }, [open]);

  /* ── Debounced API search ── */
  const search = useCallback((q: string) => {
    if (!q.trim() || q.length < 2) { setResults([]); setLoading(false); return; }
    clearTimeout(debounceRef.current);
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`${BASE}/api/search/global?q=${encodeURIComponent(q)}&limit=5`);
        const d = await r.json();
        setResults(d.results ?? []);
      } catch {}
      setLoading(false);
    }, 280);
  }, []);

  useEffect(() => { search(query); }, [query, search]);

  const go = (href: string) => { navigate(href); setOpen(false); };

  const filteredNav = query.trim().length >= 1
    ? NAV_ALL.filter(n => n.label.includes(query) || n.group.includes(query))
    : NAV_ALL.slice(0, 8);

  const isSearching = query.trim().length >= 2;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <div className="border-b border-border/50 px-1">
        <CommandInput
          placeholder="ابحث في القضايا، الموكلين، الفواتير... أو اكتب أمراً"
          value={query}
          onValueChange={setQuery}
          className="h-12 text-[15px]"
        />
      </div>
      <CommandList className="max-h-[520px] overflow-y-auto" dir="rtl">
        {isSearching && !loading && results.length === 0 && (
          <CommandEmpty className="py-8 text-center text-sm text-muted-foreground">
            لا توجد نتائج لـ "{query}"
          </CommandEmpty>
        )}
        {isSearching && loading && (
          <div className="py-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <span className="w-3 h-3 rounded-full bg-primary/60 animate-pulse" />
            جارٍ البحث...
          </div>
        )}

        {/* ── Live Search Results ── */}
        {results.length > 0 && (
          <CommandGroup heading="نتائج البحث">
            {results.map(r => {
              const Icon = RESULT_ICONS[r.type] ?? Search;
              const color = RESULT_COLORS[r.type] ?? "#64748B";
              return (
                <CommandItem
                  key={`${r.type}-${r.id}`}
                  value={`${r.type}-${r.id}-${r.title}`}
                  onSelect={() => go(r.href)}
                  className="flex items-center gap-3 py-2.5 cursor-pointer rounded-lg"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${color}15` }}>
                    <Icon className="h-4 w-4" style={{ color }} />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-semibold truncate">{r.title}</span>
                    {r.subtitle && <span className="text-[11px] text-muted-foreground">{r.subtitle}</span>}
                  </div>
                  <span className="text-[10px] font-medium border rounded-full px-2 py-0.5 shrink-0"
                    style={{ borderColor: `${color}40`, color, background: `${color}08` }}>
                    {RESULT_LABELS[r.type]}
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* ── Quick Actions (shown when no search) ── */}
        {!isSearching && (
          <CommandGroup heading="إجراءات سريعة">
            {QUICK_ACTIONS.map(a => (
              <CommandItem key={a.href} value={`qa-${a.label}`}
                onSelect={() => go(a.href)}
                className="flex items-center gap-3 py-2.5 cursor-pointer rounded-lg"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${a.color}12` }}>
                  <Plus className="h-4 w-4" style={{ color: a.color }} />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-semibold">{a.label}</span>
                  <span className="text-[11px] text-muted-foreground">{a.hint}</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* ── AI Commands ── */}
        {!isSearching && (
          <CommandGroup heading="أوامر الذكاء الاصطناعي">
            {AI_COMMANDS.map(c => (
              <CommandItem key={c.href} value={`ai-${c.label}`}
                onSelect={() => go(c.href)}
                className="flex items-center gap-3 py-2.5 cursor-pointer rounded-lg"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${c.color}12` }}>
                  <c.icon className="h-4 w-4" style={{ color: c.color }} />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-semibold">{c.label}</span>
                  <span className="text-[11px] text-muted-foreground">{c.desc}</span>
                </div>
                <Sparkles className="h-3 w-3 shrink-0" style={{ color: c.color }} />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* ── Navigation ── */}
        <CommandGroup heading={isSearching ? "التنقل المطابق" : "التنقل السريع"}>
          {filteredNav.map(n => (
            <CommandItem key={n.href} value={`nav-${n.label}-${n.group}`}
              onSelect={() => go(n.href)}
              className="flex items-center gap-3 py-2 cursor-pointer rounded-lg"
            >
              <n.icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-sm flex-1">{n.label}</span>
              <span className="text-[10px] text-muted-foreground/40 shrink-0 border border-border/40 rounded px-1.5 py-0.5">
                {n.group}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>

      {/* Footer hint */}
      <div className="border-t border-border/40 px-4 py-2 flex items-center gap-4 text-[10px] text-muted-foreground/50">
        <span className="flex items-center gap-1"><kbd className="bg-muted rounded px-1.5 py-0.5 font-mono text-[10px]">↵</kbd> تنفيذ</span>
        <span className="flex items-center gap-1"><kbd className="bg-muted rounded px-1.5 py-0.5 font-mono text-[10px]">↑↓</kbd> تنقل</span>
        <span className="flex items-center gap-1"><kbd className="bg-muted rounded px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd> إغلاق</span>
        <span className="mr-auto flex items-center gap-1">
          <Zap className="h-2.5 w-2.5 text-primary" />
          عدالة AI Command
        </span>
      </div>
    </CommandDialog>
  );
}
