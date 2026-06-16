import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useBranding } from "@/hooks/use-branding";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ─── Color math helpers ───────────────────────────────────────────── */

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

/** Relative luminance (WCAG) — 0 = black, 1 = white */
function getLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return 0;
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const r = toLinear(parseInt(clean.slice(0, 2), 16) / 255);
  const g = toLinear(parseInt(clean.slice(2, 4), 16) / 255);
  const b = toLinear(parseInt(clean.slice(4, 6), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const isLightColor = (hex: string) => getLuminance(hex) > 0.35;

/** Lighten a hex by mixing with white */
function lightenHex(hex: string, amount = 0.2): string {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const mix = (v: number) => Math.round(v + (255 - v) * amount).toString(16).padStart(2, "0");
  return `#${mix(r)}${mix(g)}${mix(b)}`;
}

/* ─── Apply design tokens to :root CSS vars ─────────────────────────── */

function applyDesignTokens(tokens: any) {
  const root = document.documentElement;
  const set = (v: string, val: string) => root.style.setProperty(v, val);
  const hsl = (hex: string) => hexToHsl(hex);
  const c = tokens?.colors ?? {};
  const t = tokens?.typography ?? {};
  const r = tokens?.radius ?? {};

  /* ── Background & surfaces ── */
  if (c.background) {
    set("--background", hsl(c.background));
    set("--popover",    hsl(c.background));
  }
  if (c.surface) {
    set("--card",            hsl(c.surface));
    set("--muted",           hsl(c.surface));
    set("--popover",         hsl(c.surface));
    set("--card-border",     hsl(c.surface));
    set("--popover-border",  hsl(c.surface));
  }

  /* ── Text ── */
  if (c.text) {
    set("--foreground",                hsl(c.text));
    set("--card-foreground",           hsl(c.text));
    set("--popover-foreground",        hsl(c.text));
    set("--sidebar-foreground",        hsl(c.text));
    set("--sidebar-accent-foreground", hsl(c.text));
  }
  if (c.textMuted) {
    set("--muted-foreground", hsl(c.textMuted));
  }

  /* ── Accent / primary button ── */
  if (c.accent) {
    const light = isLightColor(c.accent);
    set("--primary",             hsl(c.accent));
    set("--ring",                hsl(c.accent));
    set("--accent",              hsl(c.accent));
    set("--accent-foreground",   light ? "0 0% 5%" : "0 0% 98%");
    set("--primary-foreground",  light ? "0 0% 5%" : "0 0% 98%");
    set("--sidebar-primary",     hsl(c.accent));
    set("--sidebar-ring",        hsl(c.accent));
    set("--chart-1",             hsl(c.accent));
    set("--sidebar-primary-foreground", light ? "0 0% 5%" : "0 0% 98%");
  }

  /* ── Base / secondary ── */
  if (c.primary) {
    const bgLight = isLightColor(c.background ?? c.primary);
    set("--secondary",            hsl(c.primary));
    set("--secondary-foreground", bgLight ? "0 0% 10%" : "210 40% 98%");
  }

  /* ── Sidebar ── */
  if (c.sidebar) {
    const sidebarLight = isLightColor(c.sidebar);
    set("--sidebar",        hsl(c.sidebar));
    set("--sidebar-accent", hsl(c.sidebar));
    set("--sidebar-border", c.border ? hsl(c.border) : hsl(c.sidebar));
    if (c.text && !sidebarLight) {
      /* keep sidebar foreground already set above */
    } else if (sidebarLight) {
      /* light sidebar needs dark text if not already set via c.text */
    }
  }

  /* ── Border & input ── */
  if (c.border) {
    set("--border", hsl(c.border));
    set("--input",  hsl(c.border));
  }

  /* ── State ── */
  if (c.danger)   set("--destructive", hsl(c.danger));
  if (c.success)  set("--chart-2",     hsl(c.success));
  if (c.warning)  set("--chart-3",     hsl(c.warning));

  /* ── Typography ── */
  if (t.fontFamily) {
    const stack = `'${t.fontFamily}', 'IBM Plex Sans Arabic', 'Cairo', sans-serif`;
    set("--font-sans", stack);
    document.body.style.fontFamily = stack;
  }

  /* ── Border radius ── */
  if (r.card) {
    set("--radius", `${(parseInt(r.card) / 16).toFixed(3)}rem`);
  }

  /* ── data-theme on <html> for CSS targeting ── */
  const bgLum = c.background ? getLuminance(c.background) : 0;
  root.setAttribute("data-theme", bgLum > 0.35 ? "light" : "dark");
}

/* ─── Inject landing page CSS vars ──────────────────────────────────── */

const LP_STYLE_ID = "lp-theme-vars";

function applyLandingVars(tokens: any) {
  const c = tokens?.colors ?? {};
  const scope = tokens?.scope ?? "both";
  if (scope === "platform") {
    removeLandingVars();
    return;
  }

  const bg     = c.background ?? "#080F1E";
  const accent = c.accent     ?? "#C9A84C";
  const text   = c.text       ?? "#FFFFFF";
  const bgLight   = isLightColor(bg);
  const accentLum = getLuminance(accent);

  const lpNavbarBg     = bgLight
    ? "rgba(248,250,252,0.96)"
    : "rgba(8,15,30,0.95)";
  const lpNavbarBorder = bgLight
    ? "rgba(0,0,0,0.08)"
    : "rgba(255,255,255,0.07)";
  const lpCardBg       = bgLight
    ? "rgba(0,0,0,0.035)"
    : "rgba(255,255,255,0.04)";
  const lpCardBorder   = bgLight
    ? "rgba(0,0,0,0.08)"
    : "rgba(255,255,255,0.08)";
  const lpSectionBg    = bgLight
    ? "rgba(0,0,0,0.03)"
    : "rgba(6,11,24,0.8)";
  const lpText         = bgLight ? (c.text ?? "#0F172A")  : "#FFFFFF";
  const lpTextMuted    = bgLight ? (c.textMuted ?? "rgba(15,23,42,0.55)") : "rgba(255,255,255,0.6)";
  const lpTextSubtle   = bgLight ? "rgba(15,23,42,0.35)"  : "rgba(255,255,255,0.3)";
  const lpAccentEnd    = lightenHex(accent, 0.15);
  const lpAccentText   = accentLum > 0.35 ? "#0D1626" : "#FFFFFF";

  const css = `
    :root {
      --lp-bg: ${bg};
      --lp-accent: ${accent};
      --lp-accent-end: ${lpAccentEnd};
      --lp-accent-text: ${lpAccentText};
      --lp-text: ${lpText};
      --lp-text-muted: ${lpTextMuted};
      --lp-text-subtle: ${lpTextSubtle};
      --lp-navbar-bg: ${lpNavbarBg};
      --lp-navbar-border: ${lpNavbarBorder};
      --lp-card-bg: ${lpCardBg};
      --lp-card-border: ${lpCardBorder};
      --lp-section-bg: ${lpSectionBg};
      --lp-is-light: ${bgLight ? "1" : "0"};
    }
    /* text helpers for landing page light mode */
    html[data-theme="light"] .lp-t   { color: var(--lp-text) !important; }
    html[data-theme="light"] .lp-tm  { color: var(--lp-text-muted) !important; }
    html[data-theme="light"] .lp-ts  { color: var(--lp-text-subtle) !important; }
    html[data-theme="light"] .lp-nav-link { color: var(--lp-text-muted) !important; }
    html[data-theme="light"] .lp-nav-link:hover { color: var(--lp-text) !important; }
    html[data-theme="light"] .lp-section-border { border-color: rgba(0,0,0,0.06) !important; }
    html[data-theme="light"] .lp-stat-label { color: var(--lp-text-muted) !important; }
    html[data-theme="light"] .lp-trust-tag { color: var(--lp-text-subtle) !important; }
  `;

  let style = document.getElementById(LP_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = LP_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = css;

  document.documentElement.setAttribute("data-lp-theme", bgLight ? "light" : "dark");
}

function removeLandingVars() {
  const el = document.getElementById(LP_STYLE_ID);
  if (el) el.remove();
  document.documentElement.removeAttribute("data-lp-theme");
}

/* ─── Clear all overrides ────────────────────────────────────────────── */

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
  root.removeAttribute("data-theme");
  removeLandingVars();
}

/* ═══════════════════════════════════════════════════════════════
   OfficeThemeProvider
═══════════════════════════════════════════════════════════════ */
export function OfficeThemeProvider() {
  const { data: branding } = useBranding();

  const { data: themeData } = useQuery({
    queryKey: ["office-theme-tokens"],
    queryFn: () => fetch(`${BASE}/api/theme-builder/tokens`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  /* Apply design tokens ONLY when the office has a saved custom theme.
     When hasCustomTheme is false the CSS vars in index.css are the source
     of truth — we must not touch them so the platform design stays locked. */
  useEffect(() => {
    if (themeData?.hasCustomTheme && themeData?.tokens) {
      applyDesignTokens(themeData.tokens);
      applyLandingVars(themeData.tokens);
    }
    // Do NOT clear on every re-run: clearing inline vars mid-render causes FOUC
  }, [themeData]);

  /* Clear only on unmount */
  useEffect(() => {
    return () => clearDesignTokens();
  }, []);

  /* Legacy: office branding primary/secondary */
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--office-primary",   branding?.primaryColor   || "#1e3a5f");
    root.style.setProperty("--office-secondary", branding?.secondaryColor || "#c9a84c");
  }, [branding?.primaryColor, branding?.secondaryColor]);

  /* Favicon */
  useEffect(() => {
    if (!branding?.faviconUrl) return;
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
    link.href = branding.faviconUrl;
  }, [branding?.faviconUrl]);

  /* Document title */
  useEffect(() => {
    if (!branding?.officeName) return;
    document.title = `${branding.officeName} — عدالة AI`;
  }, [branding?.officeName]);

  return null;
}
