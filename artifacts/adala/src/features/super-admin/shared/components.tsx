import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const StatCard = memo(function StatCard({ icon, label, value, sub, color }: {
  icon: any; label: string; value: any; sub?: string; color?: string
}) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={cn("text-2xl font-black", color ?? "text-foreground")}>{value ?? "—"}</p>
            {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center opacity-80", color ? "" : "bg-primary/10 text-primary")} style={color ? { background: `${color}15`, color } : {}}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

export function HealthPill({ value, label, icon: Icon, color }: { value: string | number; label: string; icon: any; color: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/40 bg-muted/20">
      <Icon className="h-4 w-4 shrink-0" style={{ color }} />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-sm font-black truncate" style={{ color }}>{value}</p>
      </div>
    </div>
  );
}

export function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    online: "bg-emerald-500", active: "bg-emerald-500", running: "bg-emerald-500",
    offline: "bg-red-500", error: "bg-red-500", failed: "bg-red-500",
    idle: "bg-amber-400", pending: "bg-amber-400", paused: "bg-amber-400",
  };
  return <span className={cn("inline-block w-2 h-2 rounded-full", colors[status] ?? "bg-muted")} />;
}

export function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function fmtSAR(n: number): string {
  return n.toLocaleString("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 });
}
