/**
 * MobileDataCard — Responsive data display pattern
 * ─────────────────────────────────────────────────────────────────
 * Shows a full table on desktop (md+) and converts to stacked cards on mobile.
 *
 * Usage:
 *   <ResponsiveTable
 *     columns={[{ key: "name", label: "الاسم", primary: true }, ...]}
 *     rows={data}
 *     onRowClick={(row) => navigate(`/items/${row.id}`)}
 *   />
 */

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";

export interface TableColumn<T = any> {
  key: string;
  label: string;
  primary?: boolean;      /* shown as card title */
  secondary?: boolean;    /* shown as card subtitle */
  hideOnMobile?: boolean; /* hidden on < md */
  render?: (val: any, row: T) => ReactNode;
  className?: string;
}

interface ResponsiveTableProps<T extends Record<string, any>> {
  columns: TableColumn<T>[];
  rows: T[];
  keyField?: string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  className?: string;
  actions?: (row: T) => ReactNode;
}

export function ResponsiveTable<T extends Record<string, any>>({
  columns,
  rows,
  keyField = "id",
  onRowClick,
  emptyMessage = "لا توجد بيانات",
  className,
  actions,
}: ResponsiveTableProps<T>) {
  const primary   = columns.find(c => c.primary)   ?? columns[0];
  const secondary = columns.find(c => c.secondary) ?? columns[1];
  const rest      = columns.filter(c => !c.primary && !c.secondary && !c.hideOnMobile);

  if (rows.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground text-sm">{emptyMessage}</div>
    );
  }

  return (
    <div className={className}>
      {/* ── Desktop table (md+) ── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              {columns.map(col => (
                <th key={col.key}
                  className={cn("text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap", col.className)}>
                  {col.label}
                </th>
              ))}
              {actions && <th className="px-4 py-3 w-12" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row[keyField] ?? i}
                className={cn(
                  "border-b transition-colors group",
                  i % 2 === 0 ? "" : "bg-muted/5",
                  onRowClick ? "cursor-pointer hover:bg-muted/20" : "hover:bg-muted/10"
                )}
                onClick={() => onRowClick?.(row)}>
                {columns.map(col => (
                  <td key={col.key} className={cn("px-4 py-3.5", col.className)}>
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? "—")}
                  </td>
                ))}
                {actions && (
                  <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                    {actions(row)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Mobile cards (< md) ── */}
      <div className="md:hidden space-y-2.5">
        {rows.map((row, i) => (
          <button
            key={row[keyField] ?? i}
            className={cn(
              "w-full text-right rounded-xl border bg-card p-3.5 shadow-sm",
              "transition-all active:scale-[0.98] active:shadow-none",
              onRowClick ? "cursor-pointer hover:border-primary/30 hover:shadow-md" : "cursor-default"
            )}
            onClick={() => onRowClick?.(row)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {/* Primary */}
                {primary && (
                  <p className="font-semibold text-foreground leading-tight truncate">
                    {primary.render
                      ? primary.render(row[primary.key], row)
                      : (row[primary.key] ?? "—")}
                  </p>
                )}
                {/* Secondary */}
                {secondary && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {secondary.render
                      ? secondary.render(row[secondary.key], row)
                      : (row[secondary.key] ?? "")}
                  </p>
                )}
                {/* Rest — shown as mini tags */}
                {rest.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {rest.map(col => (
                      <span key={col.key} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <span className="text-muted-foreground/50">{col.label}:</span>
                        <span>{col.render ? col.render(row[col.key], row) : (row[col.key] ?? "—")}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {/* Chevron for navigation hint */}
              {onRowClick && (
                <ChevronLeft className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5" />
              )}
            </div>
            {/* Actions row at bottom if provided */}
            {actions && (
              <div className="mt-2.5 pt-2.5 border-t border-border/50" onClick={e => e.stopPropagation()}>
                {actions(row)}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * MobileCard — Simple info card for mobile-first display
 * For showing a single record's details in a card format.
 */
interface MobileCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  meta?: { label: string; value: ReactNode }[];
  actions?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function MobileCard({ title, subtitle, badge, meta, actions, onClick, className }: MobileCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 shadow-sm",
        onClick ? "cursor-pointer transition-all active:scale-[0.98] hover:border-primary/30" : "",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {typeof title === "string"
              ? <p className="font-semibold text-foreground truncate">{title}</p>
              : title}
            {badge}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
        {onClick && <ChevronLeft className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
      </div>

      {meta && meta.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-border/40">
          {meta.map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">{label}</p>
              <p className="text-xs font-medium mt-0.5">{value ?? "—"}</p>
            </div>
          ))}
        </div>
      )}

      {actions && (
        <div className="mt-3 pt-2.5 border-t border-border/40">
          {actions}
        </div>
      )}
    </div>
  );
}
