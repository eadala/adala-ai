/**
 * ResponsiveFormGrid — Adaptive form layout
 *
 * Desktop: multi-column (grid-cols-2 / grid-cols-3)
 * Tablet: two columns
 * Mobile: single column, larger touch targets
 *
 * Usage:
 *   <ResponsiveFormGrid cols={2} className="gap-4">
 *     <FormField />
 *     <FormField />
 *   </ResponsiveFormGrid>
 */
import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useBreakpoint } from "@/hooks/use-breakpoint";

interface ResponsiveFormGridProps {
  children: ReactNode;
  /** Desktop columns: 2 or 3 */
  cols?: 2 | 3;
  className?: string;
}

export function ResponsiveFormGrid({
  children,
  cols = 2,
  className,
}: ResponsiveFormGridProps) {
  const { isMobile, isTablet } = useBreakpoint();

  const gridClass = isMobile
    ? "grid-cols-1"
    : isTablet
    ? "grid-cols-2"
    : cols === 3
    ? "grid-cols-3"
    : "grid-cols-2";

  return (
    <div className={cn("grid gap-3", gridClass, className)}>
      {children}
    </div>
  );
}
