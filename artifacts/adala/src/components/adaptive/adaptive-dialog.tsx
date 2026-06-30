/**
 * AdaptiveDialog — Drop-in replacement for shadcn Dialog
 * • Desktop: renders standard Dialog
 * • Mobile/Tablet: renders BottomSheet
 *
 * Usage (identical API to shadcn Dialog):
 *   <AdaptiveDialog open={open} onOpenChange={setOpen}>
 *     <AdaptiveDialogContent title="عنوان" className="max-w-md">
 *       <DialogHeader>...</DialogHeader>
 *       ...form fields...
 *       <DialogFooter>...</DialogFooter>
 *     </AdaptiveDialogContent>
 *   </AdaptiveDialog>
 */
import { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { BottomSheet } from "./bottom-sheet";
import { useBreakpoint } from "@/hooks/use-breakpoint";

/* ── AdaptiveDialog root ────────────────────────────────────────── */
export function AdaptiveDialog({
  open, onOpenChange, children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const { isMobile } = useBreakpoint();
  if (isMobile) {
    // On mobile we use BottomSheet — children must include AdaptiveDialogContent
    return <>{children}</>;
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog>
  );
}

/* ── AdaptiveDialogContent ──────────────────────────────────────── */
export function AdaptiveDialogContent({
  children,
  className,
  title,
  open,
  onClose,
  size = "lg",
  dir,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  open?: boolean;
  onClose?: () => void;
  size?: "sm" | "md" | "lg" | "full";
  dir?: string;
}) {
  const { isMobile } = useBreakpoint();

  if (isMobile) {
    return (
      <BottomSheet
        open={open ?? false}
        onClose={onClose ?? (() => {})}
        title={title}
        size={size}
        showHandle
      >
        <div dir={dir}>{children}</div>
      </BottomSheet>
    );
  }

  return (
    <DialogContent className={className} dir={dir}>
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
