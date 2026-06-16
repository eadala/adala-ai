/**
 * ImageViewer — Full-screen professional image viewer
 * ─────────────────────────────────────────────────────────────────
 * Features:
 *  • Escape key / X button to close
 *  • Swipe down on mobile to close
 *  • Pinch-to-zoom (via CSS touch-action + transform)
 *  • Multiple images with prev/next arrows + swipe left/right
 *  • Body scroll lock with proper cleanup (no freeze after close)
 *  • Click outside image to close
 *  • Keyboard arrows for navigation
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ChevronRight, ChevronLeft, ZoomIn, ZoomOut, Download } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ImageViewerProps {
  images: string[];
  initialIndex?: number;
  alt?: string;
  onClose: () => void;
}

export function ImageViewer({ images, initialIndex = 0, alt = "صورة", onClose }: ImageViewerProps) {
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom]   = useState(1);
  const [loaded, setLoaded] = useState(false);

  /* ── Touch state for swipe ── */
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const imgRef     = useRef<HTMLImageElement>(null);

  /* ── Body scroll lock ── */
  useEffect(() => {
    const prev = document.body.style.overflow;
    const prevPos = document.body.style.position;
    const prevTop = document.body.style.top;
    const scrollY = window.scrollY;

    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top      = `-${scrollY}px`;
    document.body.style.width    = "100%";

    return () => {
      document.body.style.overflow = prev;
      document.body.style.position = prevPos;
      document.body.style.top      = prevTop;
      document.body.style.width    = "";
      window.scrollTo(0, scrollY);
    };
  }, []);

  /* ── Keyboard navigation ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape")       onClose();
      if (e.key === "ArrowRight")   go(-1);
      if (e.key === "ArrowLeft")    go(1);
      if (e.key === "+")            setZoom(z => Math.min(z + 0.5, 4));
      if (e.key === "-")            setZoom(z => Math.max(z - 0.5, 0.5));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, images.length]);

  /* ── Prevent background scroll on wheel inside viewer ── */
  useEffect(() => {
    const el = document.getElementById("adala-image-viewer");
    const prevent = (e: Event) => e.stopPropagation();
    el?.addEventListener("wheel", prevent, { passive: true });
    return () => el?.removeEventListener("wheel", prevent);
  }, []);

  const go = useCallback((dir: number) => {
    setZoom(1);
    setLoaded(false);
    setIndex(i => {
      const next = i - dir;
      if (next < 0)            return images.length - 1;
      if (next >= images.length) return 0;
      return next;
    });
  }, [images.length]);

  /* ── Touch events for swipe ── */
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t    = e.changedTouches[0];
    const dx   = t.clientX - touchStart.current.x;
    const dy   = t.clientY - touchStart.current.y;
    touchStart.current = null;

    /* Swipe down → close (when not zoomed) */
    if (zoom === 1 && dy > 80 && Math.abs(dy) > Math.abs(dx)) {
      onClose();
      return;
    }

    /* Swipe left/right → navigate */
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      go(dx > 0 ? -1 : 1);
    }
  };

  const src = images[index] ?? "";

  return createPortal(
    <div
      id="adala-image-viewer"
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.94)", backdropFilter: "blur(6px)" }}
      role="dialog"
      aria-modal="true"
      aria-label="معاينة الصورة"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ── Top bar ── */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 z-10"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)" }}>
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <button onClick={() => setZoom(z => Math.max(z - 0.5, 0.5))}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="تصغير">
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-white/70 text-sm font-mono min-w-[45px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button onClick={() => setZoom(z => Math.min(z + 0.5, 4))}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="تكبير">
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>

        {/* Counter */}
        {images.length > 1 && (
          <span className="text-white/60 text-sm">
            {index + 1} / {images.length}
          </span>
        )}

        <div className="flex items-center gap-2">
          {/* Download */}
          <a href={src} download target="_blank" rel="noopener noreferrer"
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="تنزيل">
            <Download className="h-4 w-4" />
          </a>
          {/* Close */}
          <button onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="إغلاق">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* ── Image ── */}
      <div className="relative flex items-center justify-center w-full h-full select-none"
        style={{ touchAction: zoom > 1 ? "pinch-zoom" : "none" }}>
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-10 w-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          </div>
        )}
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          draggable={false}
          className={cn(
            "max-w-[90vw] max-h-[85vh] object-contain transition-all duration-300 rounded-lg",
            loaded ? "opacity-100" : "opacity-0"
          )}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "center center",
            cursor: zoom > 1 ? "grab" : "default",
          }}
        />
      </div>

      {/* ── Prev / Next ── */}
      {images.length > 1 && (
        <>
          <button
            onClick={() => go(1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 md:p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-110"
            aria-label="الصورة التالية">
            <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
          </button>
          <button
            onClick={() => go(-1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 md:p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-110"
            aria-label="الصورة السابقة">
            <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
          </button>
        </>
      )}

      {/* ── Dot indicators ── */}
      {images.length > 1 && images.length <= 12 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
          {images.map((_, i) => (
            <button key={i} onClick={() => { setZoom(1); setLoaded(false); setIndex(i); }}
              className={cn(
                "rounded-full transition-all",
                i === index ? "w-5 h-2 bg-white" : "w-2 h-2 bg-white/30 hover:bg-white/50"
              )}
              aria-label={`الصورة ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Swipe hint on mobile — shows once then fades */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/30 text-xs md:hidden pointer-events-none animate-pulse">
        اسحب للأسفل للإغلاق · اسحب للجانب للتنقل
      </div>
    </div>,
    document.body
  );
}

/**
 * useImageViewer — hook to manage viewer state
 * Usage:
 *   const { open, viewer } = useImageViewer();
 *   <img onClick={() => open([src1, src2], 0)} />
 *   {viewer}
 */
export function useImageViewer() {
  const [state, setState] = useState<{ images: string[]; index: number } | null>(null);

  const open = useCallback((images: string | string[], index = 0) => {
    setState({ images: Array.isArray(images) ? images : [images], index });
  }, []);

  const close = useCallback(() => setState(null), []);

  const viewer = state
    ? <ImageViewer images={state.images} initialIndex={state.index} onClose={close} />
    : null;

  return { open, close, viewer, isOpen: !!state };
}
