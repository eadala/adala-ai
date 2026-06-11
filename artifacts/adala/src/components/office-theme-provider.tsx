import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useBranding } from "@/hooks/use-branding";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ── hex → "H S% L%" string for CSS hsl() vars ── */
function hexToHsl(hex: string): string {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return "0 0% 50%";
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/* ── Apply a full design-token object to :root inline styles ── */
function applyDesignTokens(tokens: any) {
  const root = document.documentElement;
  const set = (v: string, val: string) => root.style.setProperty(v, val);
  const hsl = (hex: string) => hexToHsl(hex);

  const c = tokens?.colors ?? {};
  const t = tokens?.typography ?? {};
  const r = tokens?.radius ?? {};

  /* Background & surfaces */
  if (c.background) {
    set("--background", hsl(c.background));
    set("--popover",    hsl(c.background));
  }
  if (c.surface) {
    set("--card",   hsl(c.surface));
    set("--muted",  hsl(c.surface));
    set("--popover", hsl(c.surface));
    set("--card-border",    hsl(c.surface));
    set("--popover-border", hsl(c.surface));
  }

  /* Text */
  if (c.text) {
    set("--foreground",              hsl(c.text));
    set("--card-foreground",         hsl(c.text));
    set("--popover-foreground",      hsl(c.text));
    set("--sidebar-foreground",      hsl(c.text));
    set("--sidebar-accent-foreground", hsl(c.text));
  }
  if (c.textMuted) {
    set("--muted-foreground", hsl(c.textMuted));
  }

  /* Accent / gold */
  if (c.accent) {
    set("--accent",           hsl(c.accent));
    set("--accent-foreground", c.primary ? hsl(c.primary) : hsl(c.accent));
    set("--primary",          hsl(c.accent));
    set("--ring",             hsl(c.accent));
    set("--sidebar-primary",  hsl(c.accent));
    set("--sidebar-ring",     hsl(c.accent));
    set("--chart-1",          hsl(c.accent));
  }

  /* Primary (dark base used for foregrounds) */
  if (c.primary) {
    set("--primary-foreground", hsl(c.text ?? c.primary));
    set("--secondary",          hsl(c.primary));
    set("--secondary-foreground", c.text ? hsl(c.text) : "210 40% 98%");
  }

  /* Sidebar */
  if (c.sidebar) {
    set("--sidebar",        hsl(c.sidebar));
    set("--sidebar-accent", hsl(c.sidebar));
    set("--sidebar-border", c.border ? hsl(c.border) : hsl(c.sidebar));
  }

  /* Border & input */
  if (c.border) {
    set("--border", hsl(c.border));
    set("--input",  hsl(c.border));
  }

  /* State colors */
  if (c.danger)   set("--destructive", hsl(c.danger));
  if (c.success)  set("--chart-2",     hsl(c.success));
  if (c.warning)  set("--chart-3",     hsl(c.warning));

  /* Typography */
  if (t.fontFamily) {
    const fontStack = `'${t.fontFamily}', 'Cairo', sans-serif`;
    set("--font-sans", fontStack);
    document.body.style.fontFamily = fontStack;
  }

  /* Border radius */
  if (r.card) {
    const rem = (parseInt(r.card) / 16).toFixed(3);
    set("--radius", `${rem}rem`);
  }
}

/* ── Clear all overrides (fall back to CSS defaults) ── */
function clearDesignTokens() {
  const root = document.documentElement;
  const vars = [
    "--background","--foreground","--card","--card-foreground","--card-border",
    "--popover","--popover-foreground","--popover-border",
    "--primary","--primary-foreground","--secondary","--secondary-foreground",
    "--muted","--muted-foreground","--accent","--accent-foreground",
    "--border","--input","--ring","--destructive",
    "--sidebar","--sidebar-foreground","--sidebar-border","--sidebar-primary",
    "--sidebar-primary-foreground","--sidebar-accent","--sidebar-accent-foreground","--sidebar-ring",
    "--chart-1","--chart-2","--chart-3","--font-sans","--radius",
  ];
  vars.forEach(v => root.style.removeProperty(v));
  document.body.style.removeProperty("fontFamily");
}

/* ═══════════════════════════════════════════════════════════════
   OfficeThemeProvider
   Applies: 1) office branding (favicon, title, primary/secondary)
            2) full design-token theme from Theme Builder
   ═══════════════════════════════════════════════════════════════ */
export function OfficeThemeProvider() {
  const { data: branding } = useBranding();

  /* Theme tokens from Theme Builder */
  const { data: themeData } = useQuery({
    queryKey: ["office-theme-tokens"],
    queryFn: () =>
      fetch(`${BASE}/api/theme-builder/tokens`).then(r => r.json()),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  /* ── Apply design tokens whenever they load/change ── */
  useEffect(() => {
    if (themeData?.tokens) {
      applyDesignTokens(themeData.tokens);
    } else {
      clearDesignTokens();
    }
    return () => clearDesignTokens();
  }, [themeData]);

  /* ── Legacy: office branding overrides (primary / secondary) ── */
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--office-primary",   branding?.primaryColor   || "#1e3a5f");
    root.style.setProperty("--office-secondary", branding?.secondaryColor || "#c9a84c");
  }, [branding?.primaryColor, branding?.secondaryColor]);

  /* ── Favicon ── */
  useEffect(() => {
    if (!branding?.faviconUrl) return;
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = branding.faviconUrl;
  }, [branding?.faviconUrl]);

  /* ── Document title ── */
  useEffect(() => {
    if (!branding?.officeName) return;
    document.title = `${branding.officeName} — عدالة AI`;
  }, [branding?.officeName]);

  return null;
}
