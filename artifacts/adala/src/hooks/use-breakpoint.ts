import { useState, useEffect } from "react";

export type DeviceSize = "mobile" | "tablet" | "desktop";

interface Breakpoint {
  device: DeviceSize;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
}

function getBreakpoint(width: number): DeviceSize {
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

export function useBreakpoint(): Breakpoint {
  const [width, setWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1280
  );

  useEffect(() => {
    let raf: number;
    const handler = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setWidth(window.innerWidth));
    };
    window.addEventListener("resize", handler, { passive: true });
    return () => {
      window.removeEventListener("resize", handler);
      cancelAnimationFrame(raf);
    };
  }, []);

  const device = getBreakpoint(width);
  return {
    device,
    isMobile: device === "mobile",
    isTablet: device === "tablet",
    isDesktop: device === "desktop",
    width,
  };
}

export function useIsMobile(): boolean {
  return useBreakpoint().isMobile;
}

export function useIsTablet(): boolean {
  const { device } = useBreakpoint();
  return device === "tablet";
}

export function useIsDesktop(): boolean {
  return useBreakpoint().isDesktop;
}
