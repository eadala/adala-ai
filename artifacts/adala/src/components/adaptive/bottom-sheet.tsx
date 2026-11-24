/**
 * BottomSheet — Mobile-first sheet component
 * Slides up from bottom, supports swipe-to-close, safe areas, RTL
 */
import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** "sm" ~40vh | "md" ~65vh | "lg" ~85vh | "full" 100vh */
  size?: "sm" | "md" | "lg" | "full";
  showHandle?: boolean;
  hideHeader?: boolean;
}

export function BottomSheet({
  open, onClose, title, children,
  size = "md", showHandle = true, hideHeader = false,
}: BottomSheetProps) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const touchDeltaY = useRef(0);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => setAnimating(true));
    } else if (visible) {
      setAnimating(false);
      const t = setTimeout(() => setVisible(false), 300);
      cleanup = () => clearTimeout(t);
    }
    return cleanup;
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchDeltaY.current = 0;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    touchDeltaY.current = e.touches[0].clientY - touchStartY.current;
    if (touchDeltaY.current > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${touchDeltaY.current}px)`;
    }
  };
  const onTouchEnd = () => {
    if (touchDeltaY.current > 80) {
      onClose();
    } else if (sheetRef.current) {
      sheetRef.current.style.transform = "";
    }
    touchDeltaY.current = 0;
  };

  const sizeClass = {
    sm: "max-h-[45vh]",
    md: "max-h-[70vh]",
    lg: "max-h-[88vh]",
    full: "max-h-[100vh] rounded-none",
  }[size];

  if (!visible) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
        style={{ opacity: animating ? 1 : 0 }}
        onClick={onClose}
      />

      {/* Sheet panel */}
      <div
        ref={sheetRef}
        className={`absolute bottom-0 inset-x-0 bg-background rounded-t-2xl flex flex-col shadow-2xl transition-transform duration-300 ease-out ${sizeClass}`}
        style={{
          transform: animating ? "translateY(0)" : "translateY(100%)",
          paddingBottom: "env(safe-area-inset-bottom, 16px)",
          willChange: "transform",
        }}
      >
        {/* Drag handle */}
        {showHandle && (
          <div
            className="flex items-center justify-center pt-3 pb-1 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div className="w-10 h-1 rounded-full bg-border/60" />
          </div>
        )}

        {/* Header */}
        {!hideHeader && (
          <div className="flex items-center justify-between px-5 pb-3 pt-1 shrink-0 border-b border-border/50">
            <span className="text-base font-bold text-foreground">{title}</span>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted active:scale-95 transition-all touch-manipulation"
              aria-label="إغلاق"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
