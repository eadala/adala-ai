/**
 * AdaptiveDialog v2.1 — Context-based, drop-in Dialog replacement
 *
 * Desktop/Tablet: renders standard shadcn Dialog + DialogContent
 * Mobile (<768px): renders BottomSheet (slides from bottom)
 *
 * FIX (v2.1): <Dialog> wrapper is ALWAYS rendered (mobile + desktop)
 * so that Radix primitives inside children (DialogTitle, DialogDescription, etc.)
 * always have their required DialogContext — without it Radix throws
 * "DialogTitle must be used within Dialog" crashing the React tree.
 *
 * On mobile, <Dialog> acts as a pure context provider only — its visual
 * layer (DialogContent/Portal/Overlay) is NOT rendered because
 * AdaptiveDialogContent replaces it with <BottomSheet>.
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
  const onClose = useCallback(() => onOpenChange(false), [onOpenChange]);
  const ctx: AdaptiveCtx = { open, onClose };

  /**
   * ALWAYS wrap with <Dialog> regardless of mobile/desktop.
   *
   * Why: Radix primitives (DialogTitle, DialogDescription, DialogClose)
   * call useDialogContext() internally — they throw if no Dialog.Root
   * ancestor exists. On mobile, AdaptiveDialogContent renders BottomSheet
   * instead of DialogContent, so Dialog provides context only (no UI).
   */
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
    /**
     * On mobile we render BottomSheet instead of DialogContent.
     * Dialog.Root (from AdaptiveDialog) is still in the tree above us,
     * providing context for any DialogTitle/DialogDescription in children.
     * We do NOT render <DialogContent> so there is no Radix portal/overlay.
     */
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
