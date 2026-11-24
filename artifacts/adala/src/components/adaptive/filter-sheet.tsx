/**
 * FilterSheet — Mobile filter panel as a BottomSheet
 * On desktop: renders children directly (sidebar/inline filters)
 * On mobile: renders a trigger button + BottomSheet
 */
import { ReactNode, useState } from "react";
import { SlidersHorizontal, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BottomSheet } from "./bottom-sheet";
import { useBreakpoint } from "@/hooks/use-breakpoint";

interface FilterSheetProps {
  children: ReactNode;
  /** Number of active filters for badge indicator */
  activeCount?: number;
  title?: string;
  onReset?: () => void;
  /** Desktop: renders children inline. Mobile: renders as bottom sheet */
  desktopWrapper?: ({ children }: { children: ReactNode }) => ReactNode;
}

export function FilterSheet({
  children, activeCount = 0, title = "الفلاتر",
  onReset, desktopWrapper,
}: FilterSheetProps) {
  const { isMobile } = useBreakpoint();
  const [open, setOpen] = useState(false);

  if (!isMobile) {
    if (desktopWrapper) return desktopWrapper({ children }) as React.ReactElement;
    return <>{children}</>;
  }

  return (
    <>
      {/* Mobile trigger button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="relative gap-2 touch-manipulation"
        aria-label={`فتح ${title}`}
      >
        <SlidersHorizontal className="h-4 w-4" />
        <span>فلترة</span>
        {activeCount > 0 && (
          <Badge
            className="absolute -top-1.5 -right-1.5 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-primary text-primary-foreground rounded-full"
          >
            {activeCount}
          </Badge>
        )}
      </Button>

      {/* Mobile bottom sheet */}
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        size="lg"
        showHandle
      >
        {onReset && (
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/30">
            <span className="text-sm text-muted-foreground">
              {activeCount > 0 ? `${activeCount} فلتر نشط` : "لا توجد فلاتر نشطة"}
            </span>
            <button
              onClick={() => { onReset(); setOpen(false); }}
              className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors touch-manipulation"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              إعادة ضبط
            </button>
          </div>
        )}

        <div className="space-y-4 pb-4">
          {children}
        </div>

        <div className="pt-3 border-t border-border/30">
          <Button
            className="w-full"
            onClick={() => setOpen(false)}
          >
            تطبيق الفلاتر
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
