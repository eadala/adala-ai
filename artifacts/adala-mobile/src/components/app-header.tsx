import { Scale, Bell, Monitor } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const API = "/api";
const fetchJson = (p: string) => fetch(`${API}${p}`).then(r => r.json());

export default function AppHeader({ title }: { title?: string }) {
  const today = new Date().toLocaleDateString("ar-SA", {
    weekday: "short", month: "long", day: "numeric",
  });

  const { data: reminders = [] } = useQuery<any[]>({
    queryKey: ["reminders-count"],
    queryFn: () => fetchJson("/reminders"),
    staleTime: 60_000,
  });

  const overdueCount = (Array.isArray(reminders) ? reminders : []).filter(
    r => !r.isDone && !r.isCompleted && r.due_at && new Date(r.due_at) < new Date()
  ).length;

  function goDesktop() {
    const origin = window.location.origin;
    window.location.href = `${origin}/adala/dashboard`;
  }

  return (
    <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border/50 safe-top">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Logo + title */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center">
            <Scale size={16} className="text-primary" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground leading-none">
              {title ?? "عدالة AI"}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{today}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Switch to desktop */}
          <button
            onClick={goDesktop}
            title="النسخة الكاملة"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-muted/60 border border-border/40 hover:bg-muted active:scale-95 transition-all"
          >
            <Monitor size={14} className="text-muted-foreground" />
            <span className="text-[11px] font-medium text-muted-foreground leading-none">
              النسخة الكاملة
            </span>
          </button>

          {/* Bell */}
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center">
              <Bell size={18} className="text-muted-foreground" />
            </div>
            {overdueCount > 0 && (
              <span className="absolute -top-1 -left-1 min-w-[16px] h-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center px-1">
                {overdueCount > 9 ? "9+" : overdueCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
