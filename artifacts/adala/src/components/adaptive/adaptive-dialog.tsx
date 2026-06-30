/**
 * AdaptiveDialog v2 — Context-based, drop-in Dialog replacement
 *
 * Desktop/Tablet: renders standard shadcn Dialog
 * Mobile (<768px): renders BottomSheet (slides from bottom)
 *
 * Usage — IDENTICAL to shadcn Dialog, no extra props needed:
 *
 *   <AdaptiveDialog open={open} onOpenChange={setOpen}>
 *     <AdaptiveDialogContent className="max-w-md" title="عنوان اختياري">
 *       <DialogHeader><DialogTitle>...</DialogTitle></DialogHeader>
 *       ...form...
 *       <DialogFooter>...</DialogFooter>
 *     </AdaptiveDialogContent>
 *   </AdaptiveDialog>
 */
import { createContext, useCallback, useContext, ReactNode, CSSProperties } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { BottomSheet } from "./bottom-sheet";
import { useBreakpoint } from "@/hooks/use-breakpoint";

/* ── Internal context ───────────────────────────────────────────── */
interface AdaptiveCtx {
  open: boolean;
  onClose: () => void;
}
const AdaptiveDialogContext = createContext<AdaptiveCtx | null>(null);

/* ── AdaptiveDialog root ────────────────────────────────────────── */
export function AdaptiveDialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const { isMobile } = useBreakpoint();
  const onClose = useCallback(() => onOpenChange(false), [onOpenChange]);

  const ctx: AdaptiveCtx = { open, onClose };

  if (isMobile) {
    return (
      <AdaptiveDialogContext.Provider value={ctx}>
        {children}
      </AdaptiveDialogContext.Provider>
    );
  }

  return (
    <AdaptiveDialogContext.Provider value={ctx}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {children}
      </Dialog>
    </AdaptiveDialogContext.Provider>
  );
}

/* ── AdaptiveDialogContent ──────────────────────────────────────── */
export function AdaptiveDialogContent({
  children,
  className,
  style,
  /** Optional title shown in BottomSheet header on mobile */
  title,
  /** BottomSheet height preset */
  size = "lg",
  dir,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  title?: string;
  size?: "sm" | "md" | "lg" | "full";
  dir?: string;
}) {
  const { isMobile } = useBreakpoint();
  const ctx = useContext(AdaptiveDialogContext);

  if (isMobile) {
    return (
      <BottomSheet
        open={ctx?.open ?? false}
        onClose={ctx?.onClose ?? (() => {})}
        title={title}
        size={size}
        showHandle
      >
        <div dir={dir}>{children}</div>
      </BottomSheet>
    );
  }

  return (
    <DialogContent className={className} style={style} dir={dir}>
      {children}
    </DialogContent>
  );
}

/* ── Re-export Dialog primitives for convenience ────────────────── */
export {
  DialogHeader as AdaptiveDialogHeader,
  DialogTitle as AdaptiveDialogTitle,
  DialogFooter as AdaptiveDialogFooter,
};
