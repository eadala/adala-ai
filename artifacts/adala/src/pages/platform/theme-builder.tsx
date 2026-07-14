/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- pre-existing lint debt; authFetch migration */
import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Palette, Save, RotateCcw, Download, Check, Eye, Layers,
  Type, Maximize2, Sparkles, Layout, ChevronRight,
  Monitor, Smartphone, Sun, Moon, Copy, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { authFetch } from "@/lib/authFetch";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

/* ── Color helpers ── */
function getLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return 0;
  const lin = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const r = lin(parseInt(clean.slice(0, 2), 16) / 255);
  const g = lin(parseInt(clean.slice(2, 4), 16) / 255);
  const b = lin(parseInt(clean.slice(4, 6), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function lightenHex(hex: string, amount = 0.15): string {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const m = (v: number) => Math.round(v + (255 - v) * amount).toString(16).padStart(2, "0");
  return `#${m(r)}${m(g)}${m(b)}`;
}

/* ── Types ── */
interface DesignTokens {
  colors: {
    primary: string; accent: string; background: string; surface: string;
    sidebar: string; text: string; textMuted: string; border: string;
    success: string; warning: string; danger: string;
  };
  typography: {
    fontFamily: string; headingFont: string; baseSize: string;
    headingWeight: string; bodyWeight: string;
  };
  radius: { card: string; button: string; input: string; badge: string };
  spacing: { sm: string; md: string; lg: string; xl: string };
  shadows: { card: string; button: string };
  scope?: "platform" | "landing" | "both";
}

const DEFAULT_TOKENS: DesignTokens = {
  colors: {
    primary: "#FFFFFF", accent: "#2563EB", background: "#0D1526",
    surface: "#1E2D4A", sidebar: "#0F1C35", text: "#E8EAF0",
    textMuted: "#8899AA", border: "#2A3A58",
    success: "#10B981", warning: "#F59E0B", danger: "#EF4444",
  },
  typography: { fontFamily: "Cairo", headingFont: "Cairo", baseSize: "14", headingWeight: "700", bodyWeight: "400" },
  radius: { card: "12", button: "8", input: "8", badge: "6" },
  spacing: { sm: "8", md: "16", lg: "24", xl: "32" },
  shadows: { card: "0 4px 24px rgba(0,0,0,0.3)", button: "0 2px 8px rgba(201,168,76,0.25)" },
  scope: "both",
};

const FONTS = ["Cairo", "Tajawal", "Noto Kufi Arabic", "IBM Plex Sans Arabic", "Inter", "Roboto", "Poppins"];

/* ── Apply tokens to preview iframe via style tag ── */
function tokensToCSS(t: DesignTokens): string {
  return `
    :root {
      --tb-primary: ${t.colors.primary};
      --tb-accent: ${t.colors.accent};
      --tb-bg: ${t.colors.background};
      --tb-surface: ${t.colors.surface};
      --tb-sidebar: ${t.colors.sidebar};
      --tb-text: ${t.colors.text};
      --tb-text-muted: ${t.colors.textMuted};
      --tb-border: ${t.colors.border};
      --tb-success: ${t.colors.success};
      --tb-warning: ${t.colors.warning};
      --tb-danger: ${t.colors.danger};
      --tb-radius-card: ${t.radius.card}px;
      --tb-radius-btn: ${t.radius.button}px;
      --tb-radius-input: ${t.radius.input}px;
      --tb-font: '${t.typography.fontFamily}', Cairo, sans-serif;
      --tb-shadow-card: ${t.shadows.card};
      --tb-shadow-btn: ${t.shadows.button};
    }
  `;
}

/* ──────────────────────────────────────────────────────────────────
   LIVE PREVIEW CANVAS
────────────────────────────────────────────────────────────────── */
function LiveCanvas({ tokens, viewport }: { tokens: DesignTokens; viewport: "desktop" | "mobile" }) {
  const t = tokens;
  const s = {
    wrap: {
      background: t.colors.background,
      fontFamily: `'${t.typography.fontFamily}', Cairo, sans-serif`,
      color: t.colors.text,
      height: "100%",
      overflow: "auto",
      fontSize: `${t.typography.baseSize}px`,
      display: "flex",
      flexDirection: "row" as const,
    },
    sidebar: {
      width: viewport === "mobile" ? "56px" : "200px",
      background: t.colors.sidebar,
      borderRight: `1px solid ${t.colors.border}`,
      padding: viewport === "mobile" ? "12px 8px" : "16px 12px",
      flexShrink: 0,
      display: "flex",
      flexDirection: "column" as const,
      gap: "6px",
    },
    sidebarLogo: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "10px 8px",
      marginBottom: "12px",
    },
    logoMark: {
      width: "32px",
      height: "32px",
      borderRadius: `${t.radius.button}px`,
      background: t.colors.accent,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: t.colors.sidebar,
      fontWeight: "900",
      fontSize: "14px",
      flexShrink: 0,
    },
    logoText: {
      color: t.colors.text,
      fontWeight: 700,
      fontSize: "13px",
      display: viewport === "mobile" ? "none" : "block",
    },
    navItem: (active: boolean) => ({
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "8px 10px",
      borderRadius: `${t.radius.button}px`,
      background: active ? `${t.colors.accent}22` : "transparent",
      color: active ? t.colors.accent : t.colors.textMuted,
      fontSize: "12px",
      cursor: "pointer",
      borderRight: active ? `2px solid ${t.colors.accent}` : "2px solid transparent",
      fontWeight: active ? 600 : 400,
    }),
    navDot: (active: boolean) => ({
      width: "7px",
      height: "7px",
      borderRadius: "50%",
      background: active ? t.colors.accent : t.colors.textMuted,
      flexShrink: 0,
    }),
    main: {
      flex: 1,
      padding: "16px",
      overflow: "auto",
      background: t.colors.background,
    },
    topbar: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "16px",
    },
    pageTitle: {
      fontWeight: 700,
      fontSize: "16px",
      color: t.colors.text,
    },
    card: {
      background: t.colors.surface,
      borderRadius: `${t.radius.card}px`,
      border: `1px solid ${t.colors.border}`,
      padding: "14px",
      boxShadow: t.shadows.card,
    },
    kpiGrid: {
      display: "grid",
      gridTemplateColumns: viewport === "mobile" ? "repeat(2,1fr)" : "repeat(4,1fr)",
      gap: "10px",
      marginBottom: "14px",
    },
    kpi: (accent: string) => ({
      background: t.colors.surface,
      borderRadius: `${t.radius.card}px`,
      border: `1px solid ${t.colors.border}`,
      padding: "12px",
      position: "relative" as const,
      overflow: "hidden" as const,
    }),
    kpiBar: (accent: string) => ({
      position: "absolute" as const,
      right: 0,
      top: 0,
      bottom: 0,
      width: "3px",
      background: accent,
      borderRadius: "0 4px 4px 0",
    }),
    kpiVal: { fontSize: "18px", fontWeight: 900, color: t.colors.text },
    kpiLbl: { fontSize: "10px", color: t.colors.textMuted, marginTop: "3px" },
    btnPrimary: {
      background: t.colors.primary,
      color: t.colors.accent,
      border: `1px solid ${t.colors.accent}33`,
      borderRadius: `${t.radius.button}px`,
      padding: "7px 14px",
      fontSize: "12px",
      fontWeight: 600,
      cursor: "pointer",
      boxShadow: t.shadows.button,
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
    },
    btnSecondary: {
      background: "transparent",
      color: t.colors.textMuted,
      border: `1px solid ${t.colors.border}`,
      borderRadius: `${t.radius.button}px`,
      padding: "7px 14px",
      fontSize: "12px",
      fontWeight: 500,
      cursor: "pointer",
    },
    badge: (color: string) => ({
      background: `${color}22`,
      color: color,
      borderRadius: `${t.radius.badge}px`,
      padding: "2px 8px",
      fontSize: "10px",
      fontWeight: 600,
      border: `1px solid ${color}33`,
      display: "inline-block",
    }),
    tableRow: (even: boolean) => ({
      background: even ? `${t.colors.primary}18` : "transparent",
      display: "grid",
      gridTemplateColumns: "2fr 1fr 1fr 1fr",
      gap: "8px",
      padding: "8px 10px",
      fontSize: "11px",
      borderBottom: `1px solid ${t.colors.border}`,
      alignItems: "center",
    }),
    invoiceCard: {
      background: t.colors.surface,
      border: `1px solid ${t.colors.border}`,
      borderRadius: `${t.radius.card}px`,
      overflow: "hidden",
    },
    invHeader: {
      background: t.colors.primary,
      padding: "14px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    invTitle: { color: t.colors.accent, fontWeight: 900, fontSize: "15px" },
    invSub: { color: `${t.colors.text}88`, fontSize: "10px" },
    invBody: { padding: "14px" },
    progressBar: (w: number, color: string) => ({
      height: "5px",
      borderRadius: "3px",
      background: `${t.colors.border}66`,
      position: "relative" as const,
      overflow: "hidden" as const,
    }),
    progressFill: (w: number, color: string) => ({
      position: "absolute" as const,
      right: 0,
      top: 0,
      bottom: 0,
      width: `${w}%`,
      background: color,
      borderRadius: "3px",
    }),
  };

  const navItems = [
    { label: "لوحة التحكم", active: true },
    { label: "القضايا", active: false },
    { label: "العملاء", active: false },
    { label: "الفواتير", active: false },
    { label: "التقارير", active: false },
  ];

  return (
    <div style={s.wrap}>
      {/* Sidebar */}
      <div style={s.sidebar}>
        <div style={s.sidebarLogo}>
          <div style={s.logoMark}>ع</div>
          <div style={s.logoText}>عدالة AI</div>
        </div>
        {navItems.map((item, i) => (
          <div key={i} style={s.navItem(item.active)}>
            <div style={s.navDot(item.active)} />
            {viewport !== "mobile" && item.label}
          </div>
        ))}
      </div>

      {/* Main */}
      <div style={s.main}>
        <div style={s.topbar}>
          <div style={s.pageTitle}>لوحة التحكم</div>
          <div style={{ display: "flex", gap: "6px" }}>
            <button style={s.btnPrimary}>+ قضية جديدة</button>
            <button style={s.btnSecondary}>تصفية</button>
          </div>
        </div>

        {/* KPI Cards */}
        <div style={s.kpiGrid}>
          {[
            { val: "47", lbl: "قضية نشطة",     accent: t.colors.accent },
            { val: "12", lbl: "جلسة قادمة",     accent: t.colors.success },
            { val: "8",  lbl: "فاتورة معلقة",   accent: t.colors.warning },
            { val: "183", lbl: "عميل مسجّل",    accent: t.colors.danger },
          ].map((k, i) => (
            <div key={i} style={s.kpi(k.accent)}>
              <div style={s.kpiBar(k.accent)} />
              <div style={s.kpiVal}>{k.val}</div>
              <div style={s.kpiLbl}>{k.lbl}</div>
            </div>
          ))}
        </div>

        {/* Cases Table */}
        <div style={{ ...s.card, marginBottom: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
            <span style={{ fontWeight: 700, fontSize: "12px" }}>آخر القضايا</span>
            <span style={{ color: t.colors.accent, fontSize: "11px", cursor: "pointer" }}>عرض الكل</span>
          </div>
          {/* Header row */}
          <div style={{ ...s.tableRow(false), color: t.colors.textMuted, fontWeight: 600 }}>
            <span>اسم القضية</span><span>الحالة</span><span>العميل</span><span>التاريخ</span>
          </div>
          {[
            { name: "نزاع تجاري — شركة الأفق", status: "مفتوحة",    statusColor: t.colors.success, client: "شركة الأفق", date: "١١/٦/٢٠٢٦" },
            { name: "قضية عمالية — خالد العمري", status: "قيد النظر", statusColor: t.colors.warning, client: "خالد العمري", date: "٨/٦/٢٠٢٦" },
            { name: "نزاع عقاري — المدينة",       status: "مغلقة",    statusColor: t.colors.textMuted, client: "أحمد سليمان", date: "٥/٦/٢٠٢٦" },
          ].map((row, i) => (
            <div key={i} style={s.tableRow(i % 2 === 0)}>
              <span style={{ color: t.colors.text, fontSize: "11px" }}>{row.name}</span>
              <span style={s.badge(row.statusColor)}>{row.status}</span>
              <span style={{ color: t.colors.textMuted }}>{row.client}</span>
              <span style={{ color: t.colors.textMuted }}>{row.date}</span>
            </div>
          ))}
        </div>

        {/* Invoice Card */}
        <div style={s.invoiceCard}>
          <div style={s.invHeader}>
            <div>
              <div style={s.invTitle}>فاتورة ضريبية</div>
              <div style={s.invSub}>INV-2026-0042 · عدالة AI</div>
            </div>
            <span style={s.badge(t.colors.success)}>مدفوعة</span>
          </div>
          <div style={s.invBody}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "8px" }}>
              <span style={{ color: t.colors.textMuted }}>الإجمالي</span>
              <span style={{ fontWeight: 700, color: t.colors.accent }}>٢٨٧٥ ر.س</span>
            </div>
            <div style={s.progressBar(75, t.colors.success)}>
              <div style={s.progressFill(75, t.colors.accent)} />
            </div>
            <div style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
              <button style={s.btnPrimary}>طباعة</button>
              <button style={s.btnSecondary}>إرسال</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   LANDING PAGE PREVIEW CANVAS
────────────────────────────────────────────────────────────────── */
function LandingCanvas({ tokens, viewport }: { tokens: DesignTokens; viewport: "desktop" | "mobile" }) {
  const c = tokens.colors;
  const accent = c.accent;
  const accentEnd = lightenHex(accent, 0.18);
  const bg = c.background;
  const isLight = getLuminance(bg) > 0.35;
  const text = c.text;
  const textMuted = c.textMuted;
  const accentOnBg = getLuminance(accent) > 0.35 ? "#0D1626" : "#FFFFFF";
  const navBg = isLight ? "rgba(248,250,252,0.96)" : "rgba(8,15,30,0.95)";
  const navBorder = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.07)";
  const cardBg = isLight ? "rgba(0,0,0,0.035)" : "rgba(255,255,255,0.04)";
  const cardBorder = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)";
  const fontStack = `'${tokens.typography.fontFamily}', Cairo, sans-serif`;
  const r = tokens.radius;

  return (
    <div style={{ background: bg, fontFamily: fontStack, color: text, height: "100%", overflow: "auto" }}>
      {/* Navbar */}
      <div style={{ background: navBg, borderBottom: `1px solid ${navBorder}`, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "28px", height: "28px", borderRadius: `${r.button}px`, background: `linear-gradient(135deg, ${accent}, ${accentEnd})`, display: "flex", alignItems: "center", justifyContent: "center", color: accentOnBg, fontWeight: 900, fontSize: "12px" }}>ع</div>
          <span style={{ fontWeight: 900, fontSize: "13px", color: text }}>عدالة AI</span>
        </div>
        {viewport !== "mobile" && (
          <div style={{ display: "flex", gap: "14px", fontSize: "11px", color: textMuted }}>
            {["المميزات", "الأسعار", "عن المنصة"].map(n => <span key={n} style={{ cursor: "pointer" }}>{n}</span>)}
          </div>
        )}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ fontSize: "11px", color: textMuted, cursor: "pointer" }}>دخول</span>
          <button style={{ background: `linear-gradient(135deg, ${accent}, ${accentEnd})`, color: accentOnBg, border: "none", borderRadius: `${r.button}px`, padding: "5px 12px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>ابدأ مجاناً</button>
        </div>
      </div>

      {/* Hero */}
      <div style={{ padding: viewport === "mobile" ? "30px 14px 20px" : "40px 20px 30px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "30px", left: "50%", transform: "translateX(-50%)", width: "300px", height: "200px", borderRadius: "50%", background: accent, opacity: isLight ? 0.08 : 0.12, filter: "blur(80px)", pointerEvents: "none" }} />
        <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 12px", borderRadius: "20px", fontSize: "10px", fontWeight: 600, background: `${accent}18`, border: `1px solid ${accent}30`, color: accent, marginBottom: "12px" }}>
          ✦ النظام القانوني الذكي الأول بالعربية
        </div>
        <div style={{ fontSize: viewport === "mobile" ? "20px" : "26px", fontWeight: 900, color: text, lineHeight: 1.3, marginBottom: "10px" }}>
          أتمتة إدارة المكتب القانوني<br />
          <span style={{ background: `linear-gradient(135deg, ${accent}, ${accentEnd})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>بقوة الذكاء الاصطناعي</span>
        </div>
        <div style={{ fontSize: "11px", color: textMuted, marginBottom: "16px", lineHeight: 1.6 }}>
          ادارة القضايا والعملاء والفواتير والتقارير — كل شيء في مكان واحد
        </div>
        <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" as const }}>
          <button style={{ background: `linear-gradient(135deg, ${accent}, ${accentEnd})`, color: accentOnBg, border: "none", borderRadius: `${r.button}px`, padding: "9px 18px", fontSize: "11px", fontWeight: 700, cursor: "pointer", boxShadow: `0 6px 20px ${accent}30` }}>
            ابدأ مجاناً ←
          </button>
          <button style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: `${r.button}px`, padding: "9px 14px", fontSize: "11px", color: text, cursor: "pointer" }}>
            معرفة المزيد
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ borderTop: `1px solid ${cardBorder}`, borderBottom: `1px solid ${cardBorder}`, padding: "14px 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "8px", textAlign: "center" }}>
          {[["1000+","مكتب"],["100K+","قضية"],["99.9%","رضا"],["40%","توفير"]].map(([v,l]) => (
            <div key={l}>
              <div style={{ fontSize: "16px", fontWeight: 900, color: accent }}>{v}</div>
              <div style={{ fontSize: "9px", color: textMuted }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Features grid */}
      <div style={{ padding: "20px 14px" }}>
        <div style={{ textAlign: "center", marginBottom: "14px" }}>
          <span style={{ fontSize: "10px", fontWeight: 600, color: accent, background: `${accent}14`, border: `1px solid ${accent}25`, padding: "3px 10px", borderRadius: "20px" }}>المميزات</span>
          <div style={{ fontSize: "14px", fontWeight: 900, color: text, marginTop: "8px" }}>كل ما تحتاجه في منصة واحدة</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: viewport === "mobile" ? "1fr 1fr" : "1fr 1fr 1fr", gap: "8px" }}>
          {[
            { icon: "⚖️", title: "إدارة القضايا", desc: "تتبع كل قضية بذكاء" },
            { icon: "👥", title: "ملفات العملاء", desc: "بيانات منظمة وسهلة" },
            { icon: "🧾", title: "الفوترة الذكية", desc: "فواتير ضريبية تلقائية" },
            { icon: "🤖", title: "مساعد AI", desc: "ذكاء اصطناعي قانوني" },
            { icon: "📊", title: "تقارير متقدمة", desc: "تحليلات فورية" },
            { icon: "📅", title: "التقويم", desc: "إدارة الجلسات" },
          ].map(f => (
            <div key={f.title} style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: `${r.card}px`, padding: "10px" }}>
              <div style={{ fontSize: "16px", marginBottom: "4px" }}>{f.icon}</div>
              <div style={{ fontSize: "10px", fontWeight: 700, color: text, marginBottom: "2px" }}>{f.title}</div>
              <div style={{ fontSize: "9px", color: textMuted }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ margin: "0 14px 20px", background: `linear-gradient(135deg, ${accent}20, ${accentEnd}10)`, border: `1px solid ${accent}25`, borderRadius: `${r.card}px`, padding: "18px", textAlign: "center" }}>
        <div style={{ fontSize: "13px", fontWeight: 900, color: text, marginBottom: "6px" }}>ابدأ تجربتك المجانية اليوم</div>
        <div style={{ fontSize: "10px", color: textMuted, marginBottom: "12px" }}>١٤ يوماً مجاناً • بدون بطاقة ائتمان</div>
        <button style={{ background: `linear-gradient(135deg, ${accent}, ${accentEnd})`, color: accentOnBg, border: "none", borderRadius: `${r.button}px`, padding: "8px 20px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>سجّل الآن مجاناً</button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   COLOR SWATCH
────────────────────────────────────────────────────────────────── */
function ColorSwatch({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <code className="text-xs font-mono text-foreground/60">{value}</code>
        <button
          className="w-7 h-7 rounded-md border-2 border-border/50 hover:border-accent transition-colors shadow-sm cursor-pointer"
          style={{ background: value }}
          onClick={() => inputRef.current?.click()}
          title={label}
        />
        <input
          ref={inputRef}
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-0 h-0 opacity-0 absolute"
        />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   PRESET CARD
────────────────────────────────────────────────────────────────── */
function PresetCard({
  preset, isActive, onClick
}: {
  preset: { id: string; name: string; preview: string; tokens: DesignTokens };
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-xl border text-right transition-all",
        isActive
          ? "border-accent/60 bg-accent/10"
          : "border-border/40 hover:border-border hover:bg-muted/30"
      )}
    >
      <div
        className="w-8 h-8 rounded-lg flex-shrink-0 border border-border"
        style={{ background: preset.preview }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-foreground truncate">{preset.name}</div>
        <div className="flex gap-1 mt-1">
          {["primary", "accent", "surface"].map(k => (
            <div
              key={k}
              className="w-3 h-3 rounded-full border border-border"
              style={{ background: (preset.tokens.colors as any)[k] }}
            />
          ))}
        </div>
      </div>
      {isActive && <Check className="w-4 h-4 text-accent flex-shrink-0" />}
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────
   MAIN COMPONENT
────────────────────────────────────────────────────────────────── */
export default function ThemeBuilderPage() {
  const qc = useQueryClient();
  const authReady = useAuthReady();
  const [tokens, setTokens] = useState<DesignTokens>(DEFAULT_TOKENS);
  const [dirty, setDirty] = useState(false);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [previewMode, setPreviewMode] = useState<"platform" | "landing">("platform");
  const [activePreset, setActivePreset] = useState<string | null>("dark-navy");
  const [themeName, setThemeName] = useState("الثيم المخصص");
  const [copied, setCopied] = useState(false);

  /* Load saved tokens */
  const { data: saved } = useQuery({
    queryKey: ["theme-builder-tokens"],
    queryFn: () => authFetch(`${BASE}/api/theme-builder/tokens`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    staleTime: 60_000,
    enabled: authReady,
  });

  /* Load presets */
  const { data: presets = [] } = useQuery<any[]>({
    queryKey: ["theme-builder-presets"],
    queryFn: () => fetch(`${BASE}/api/theme-builder/presets`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    staleTime: Infinity,
  });

  /* Apply saved tokens on load */
  useEffect(() => {
    if (saved?.tokens) setTokens(saved.tokens);
  }, [saved]);

  /* Save mutation */
  const saveMut = useMutation({
    mutationFn: () => fetch(`${BASE}/api/theme-builder/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokens, name: themeName }),
    }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => {
      toast.success("تم حفظ الثيم وتطبيقه على التطبيق ✨");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["theme-builder-tokens"] });
      qc.invalidateQueries({ queryKey: ["office-theme-tokens"] });
    },
    onError: () => toast.error("حدث خطأ أثناء الحفظ"),
  });

  /* Update helpers */
  const setColor = useCallback((key: keyof DesignTokens["colors"], v: string) => {
    setTokens(prev => ({ ...prev, colors: { ...prev.colors, [key]: v } }));
    setDirty(true); setActivePreset(null);
  }, []);
  const setTypo = useCallback((key: keyof DesignTokens["typography"], v: string) => {
    setTokens(prev => ({ ...prev, typography: { ...prev.typography, [key]: v } }));
    setDirty(true); setActivePreset(null);
  }, []);
  const setRadius = useCallback((key: keyof DesignTokens["radius"], v: number) => {
    setTokens(prev => ({ ...prev, radius: { ...prev.radius, [key]: String(v) } }));
    setDirty(true); setActivePreset(null);
  }, []);
  const setSpacing = useCallback((key: keyof DesignTokens["spacing"], v: number) => {
    setTokens(prev => ({ ...prev, spacing: { ...prev.spacing, [key]: String(v) } }));
    setDirty(true); setActivePreset(null);
  }, []);

  function applyPreset(preset: any) {
    setTokens(preset.tokens);
    setActivePreset(preset.id);
    setDirty(true);
    toast.success(`تم تطبيق "${preset.name}"`);
  }

  function resetToDefault() {
    setTokens(DEFAULT_TOKENS);
    setActivePreset("dark-navy");
    setDirty(false);
    toast("تم استعادة الثيم الافتراضي");
  }

  function exportCSS() {
    const css = tokensToCSS(tokens);
    const blob = new Blob([css], { type: "text/css" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "adalah-theme.css"; a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير CSS بنجاح");
  }

  function copyCSS() {
    navigator.clipboard.writeText(tokensToCSS(tokens));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("تم نسخ CSS");
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden" dir="rtl">
      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 bg-background/95 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
            <Palette className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground">منشئ الثيمات</h1>
            <p className="text-[10px] text-muted-foreground">تخصيص واجهة عدالة AI</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Preview mode toggle */}
          <div className="flex items-center bg-muted/40 rounded-lg p-0.5 border border-border/30">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setPreviewMode("platform")}
                  className={cn("px-2 py-1 rounded-md transition-colors text-[10px] font-medium", previewMode === "platform" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  المنصة
                </button>
              </TooltipTrigger>
              <TooltipContent>معاينة لوحة التحكم</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setPreviewMode("landing")}
                  className={cn("px-2 py-1 rounded-md transition-colors text-[10px] font-medium", previewMode === "landing" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  الرئيسية
                </button>
              </TooltipTrigger>
              <TooltipContent>معاينة الصفحة الرئيسية</TooltipContent>
            </Tooltip>
          </div>
          {/* Viewport toggle */}
          <div className="flex items-center bg-muted/40 rounded-lg p-0.5 border border-border/30">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setViewport("desktop")}
                  className={cn("p-1.5 rounded-md transition-colors", viewport === "desktop" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>سطح المكتب</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setViewport("mobile")}
                  className={cn("p-1.5 rounded-md transition-colors", viewport === "mobile" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>الجوال</TooltipContent>
            </Tooltip>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 px-2 gap-1" onClick={copyCSS}>
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                <span className="text-xs">CSS</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>نسخ CSS Variables</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 px-2 gap-1" onClick={exportCSS}>
                <Download className="w-3 h-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>تصدير CSS</TooltipContent>
          </Tooltip>
          <Button variant="outline" size="sm" className="h-7 px-2 gap-1" onClick={resetToDefault}>
            <RotateCcw className="w-3 h-3" />
            <span className="text-xs">إعادة ضبط</span>
          </Button>
          <Button
            size="sm"
            className="h-7 px-3 gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || !dirty}
          >
            {saveMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            <span className="text-xs font-semibold">حفظ الثيم</span>
            {dirty && <span className="w-1.5 h-1.5 bg-foreground/60 rounded-full" />}
          </Button>
        </div>
      </div>

      {/* ── 3-Panel Layout ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ━━━━━━━━━━━━━━━━━━━ LEFT PANEL ━━━━━━━━━━━━━━━━━━━ */}
        <div className="w-[260px] flex-shrink-0 border-l border-border/50 bg-muted/20 overflow-y-auto">
          <Tabs defaultValue="colors" dir="rtl">
            <TabsList className="w-full rounded-none border-b border-border/50 bg-transparent h-9 p-0 grid grid-cols-2 sm:grid-cols-4">
              <TabsTrigger value="colors" className="rounded-none text-[10px] gap-1 data-[state=active]:border-b-2 data-[state=active]:border-accent">
                <Palette className="w-3 h-3" />ألوان
              </TabsTrigger>
              <TabsTrigger value="typography" className="rounded-none text-[10px] gap-1 data-[state=active]:border-b-2 data-[state=active]:border-accent">
                <Type className="w-3 h-3" />خط
              </TabsTrigger>
              <TabsTrigger value="shape" className="rounded-none text-[10px] gap-1 data-[state=active]:border-b-2 data-[state=active]:border-accent">
                <Maximize2 className="w-3 h-3" />شكل
              </TabsTrigger>
              <TabsTrigger value="presets" className="rounded-none text-[10px] gap-1 data-[state=active]:border-b-2 data-[state=active]:border-accent">
                <Layers className="w-3 h-3" />ثيمات
              </TabsTrigger>
            </TabsList>

            {/* Colors Tab */}
            <TabsContent value="colors" className="p-3 space-y-4 mt-0">
              <section>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">الخلفيات</p>
                <ColorSwatch label="خلفية التطبيق" value={tokens.colors.background} onChange={v => setColor("background", v)} />
                <ColorSwatch label="سطح البطاقات" value={tokens.colors.surface} onChange={v => setColor("surface", v)} />
                <ColorSwatch label="الشريط الجانبي" value={tokens.colors.sidebar} onChange={v => setColor("sidebar", v)} />
                <ColorSwatch label="لون الأساس" value={tokens.colors.primary} onChange={v => setColor("primary", v)} />
              </section>
              <section>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">الإبراز</p>
                <ColorSwatch label="لون التمييز" value={tokens.colors.accent} onChange={v => setColor("accent", v)} />
                <ColorSwatch label="الحدود" value={tokens.colors.border} onChange={v => setColor("border", v)} />
              </section>
              <section>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">النصوص</p>
                <ColorSwatch label="النص الأساسي" value={tokens.colors.text} onChange={v => setColor("text", v)} />
                <ColorSwatch label="النص الثانوي" value={tokens.colors.textMuted} onChange={v => setColor("textMuted", v)} />
              </section>
              <section>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">الحالات</p>
                <ColorSwatch label="نجاح" value={tokens.colors.success} onChange={v => setColor("success", v)} />
                <ColorSwatch label="تحذير" value={tokens.colors.warning} onChange={v => setColor("warning", v)} />
                <ColorSwatch label="خطر" value={tokens.colors.danger} onChange={v => setColor("danger", v)} />
              </section>
            </TabsContent>

            {/* Typography Tab */}
            <TabsContent value="typography" className="p-3 space-y-4 mt-0">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">خط الجسم</Label>
                <div className="grid grid-cols-1 gap-1">
                  {FONTS.map(f => (
                    <button
                      key={f}
                      onClick={() => setTypo("fontFamily", f)}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-lg border text-right transition-all",
                        tokens.typography.fontFamily === f
                          ? "border-accent/60 bg-accent/10 text-accent"
                          : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
                      )}
                      style={{ fontFamily: `'${f}', sans-serif` }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">
                  حجم الخط الأساسي: <strong className="text-foreground">{tokens.typography.baseSize}px</strong>
                </Label>
                <Slider
                  min={12} max={18} step={1}
                  value={[parseInt(tokens.typography.baseSize)]}
                  onValueChange={([v]) => setTypo("baseSize", String(v))}
                  className="w-full"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">وزن خط العناوين</Label>
                <div className="flex gap-1 flex-wrap">
                  {["400", "500", "600", "700", "800", "900"].map(w => (
                    <button
                      key={w}
                      onClick={() => setTypo("headingWeight", w)}
                      className={cn(
                        "text-xs px-2 py-1 rounded border transition-all",
                        tokens.typography.headingWeight === w
                          ? "border-accent/60 bg-accent/10 text-accent"
                          : "border-border/40 text-muted-foreground hover:border-border"
                      )}
                      style={{ fontWeight: parseInt(w) }}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Shape & Spacing Tab */}
            <TabsContent value="shape" className="p-3 space-y-5 mt-0">
              <section>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">الحواف (px)</p>
                {(Object.entries(tokens.radius) as [keyof typeof tokens.radius, string][]).map(([key, val]) => (
                  <div key={key} className="mb-3">
                    <div className="flex justify-between mb-1.5">
                      <Label className="text-xs text-muted-foreground capitalize">{
                        key === "card" ? "البطاقات" : key === "button" ? "الأزرار" : key === "input" ? "حقول الإدخال" : "الشارات"
                      }</Label>
                      <span className="text-xs font-mono text-foreground">{val}px</span>
                    </div>
                    <Slider
                      min={0} max={24} step={1}
                      value={[parseInt(val)]}
                      onValueChange={([v]) => setRadius(key, v)}
                    />
                  </div>
                ))}
              </section>
              <section>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">التباعد (px)</p>
                {(Object.entries(tokens.spacing) as [keyof typeof tokens.spacing, string][]).map(([key, val]) => (
                  <div key={key} className="mb-3">
                    <div className="flex justify-between mb-1.5">
                      <Label className="text-xs text-muted-foreground uppercase">{key}</Label>
                      <span className="text-xs font-mono text-foreground">{val}px</span>
                    </div>
                    <Slider
                      min={4} max={48} step={2}
                      value={[parseInt(val)]}
                      onValueChange={([v]) => setSpacing(key, v)}
                    />
                  </div>
                ))}
              </section>
            </TabsContent>

            {/* Presets Tab */}
            <TabsContent value="presets" className="p-3 space-y-2 mt-0">
              {/* Dark category */}
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                🌙 ثيمات داكنة
              </p>
              {(presets as any[]).filter((p: any) => p.category === "dark").map((preset: any) => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  isActive={activePreset === preset.id}
                  onClick={() => applyPreset(preset)}
                />
              ))}

              {/* Light category */}
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-4 mb-2 flex items-center gap-1">
                ☀️ ثيمات فاتحة
              </p>
              {(presets as any[]).filter((p: any) => p.category === "light").map((preset: any) => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  isActive={activePreset === preset.id}
                  onClick={() => applyPreset(preset)}
                />
              ))}

              <div className="mt-4 pt-3 border-t border-border/30">
                <Label className="text-xs text-muted-foreground mb-1.5 block">اسم الثيم</Label>
                <Input
                  value={themeName}
                  onChange={e => setThemeName(e.target.value)}
                  className="h-7 text-xs"
                  placeholder="الثيم المخصص..."
                />
              </div>

              {/* Scope selector */}
              <div className="mt-3 pt-3 border-t border-border/30">
                <Label className="text-xs text-muted-foreground mb-2 block">نطاق الثيم</Label>
                <div className="flex gap-1">
                  {(["both", "platform", "landing"] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => { setTokens(prev => ({ ...prev, scope: s })); setDirty(true); }}
                      className={cn(
                        "flex-1 text-[10px] py-1.5 rounded border transition-all",
                        tokens.scope === s
                          ? "border-accent/60 bg-accent/10 text-accent"
                          : "border-border/40 text-muted-foreground hover:border-border"
                      )}
                    >
                      {s === "both" ? "الكل" : s === "platform" ? "المنصة" : "الرئيسية"}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-muted-foreground mt-1.5">
                  {tokens.scope === "both" ? "يُطبَّق على المنصة والصفحة الرئيسية معاً"
                    : tokens.scope === "platform" ? "يُطبَّق فقط على لوحة التحكم"
                    : "يُطبَّق فقط على الصفحة الرئيسية"}
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* ━━━━━━━━━━━━━━━━━━━ CENTER CANVAS ━━━━━━━━━━━━━━━━━━━ */}
        <div className="flex-1 overflow-hidden bg-muted/30 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/30 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                {previewMode === "landing" ? "معاينة الصفحة الرئيسية" : "معاينة لوحة التحكم"}
              </span>
              {dirty && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-accent/40 text-accent">
                  تغييرات غير محفوظة
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Layout className="w-3 h-3" />
              {viewport === "desktop" ? "1280 × 720" : "390 × 844"}
            </div>
          </div>
          <div className="flex-1 overflow-auto flex items-center justify-center p-6">
            <div
              className="shadow-2xl overflow-hidden transition-all duration-300"
              style={{
                width: viewport === "desktop" ? "100%" : "390px",
                maxWidth: viewport === "desktop" ? "100%" : "390px",
                height: viewport === "desktop" ? "100%" : "600px",
                minHeight: "500px",
                borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {previewMode === "landing"
                ? <LandingCanvas tokens={tokens} viewport={viewport} />
                : <LiveCanvas tokens={tokens} viewport={viewport} />
              }
            </div>
          </div>
        </div>

        {/* ━━━━━━━━━━━━━━━━━━━ RIGHT PANEL (Inspector) ━━━━━━━━━━━━━━━━━━━ */}
        <div className="w-[220px] flex-shrink-0 border-r border-border/50 bg-muted/20 overflow-y-auto p-3 space-y-4">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">الخصائص الحالية</p>

            {/* Color swatches quick view */}
            <div className="space-y-2 mb-4">
              {[
                { label: "الأساسي", key: "primary" as const },
                { label: "التمييز", key: "accent" as const },
                { label: "الخلفية", key: "background" as const },
              ].map(({ label, key }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">{label}</span>
                  <div className="flex items-center gap-2">
                    <code className="text-[10px] font-mono text-foreground/50">{tokens.colors[key]}</code>
                    <div className="w-5 h-5 rounded border border-border" style={{ background: tokens.colors[key] }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Typography preview */}
            <div
              className="rounded-lg p-3 border border-border/40 mb-4"
              style={{ fontFamily: `'${tokens.typography.fontFamily}', sans-serif`, background: tokens.colors.surface }}
            >
              <div style={{ color: tokens.colors.text, fontWeight: parseInt(tokens.typography.headingWeight), fontSize: "13px", marginBottom: "4px" }}>
                عنوان القضية
              </div>
              <div style={{ color: tokens.colors.textMuted, fontSize: `${parseInt(tokens.typography.baseSize) - 2}px` }}>
                نص توضيحي للمحتوى
              </div>
            </div>

            {/* Button preview */}
            <div className="space-y-2 mb-4">
              <p className="text-[10px] text-muted-foreground">معاينة الأزرار</p>
              <button
                className="w-full text-xs py-1.5 font-semibold transition-all"
                style={{
                  background: tokens.colors.primary,
                  color: tokens.colors.accent,
                  borderRadius: `${tokens.radius.button}px`,
                  border: `1px solid ${tokens.colors.accent}33`,
                  boxShadow: tokens.shadows.button,
                }}
              >
                إنشاء قضية
              </button>
              <button
                className="w-full text-xs py-1.5 transition-all"
                style={{
                  background: "transparent",
                  color: tokens.colors.textMuted,
                  borderRadius: `${tokens.radius.button}px`,
                  border: `1px solid ${tokens.colors.border}`,
                }}
              >
                إلغاء
              </button>
            </div>

            {/* Badge preview */}
            <div className="space-y-2 mb-4">
              <p className="text-[10px] text-muted-foreground">معاينة الشارات</p>
              <div className="flex gap-1 flex-wrap">
                {[
                  { l: "مفتوحة", c: tokens.colors.success },
                  { l: "معلقة", c: tokens.colors.warning },
                  { l: "مغلقة", c: tokens.colors.textMuted },
                ].map(({ l, c }) => (
                  <span
                    key={l}
                    className="text-[10px] px-2 py-0.5 font-medium"
                    style={{
                      background: `${c}22`,
                      color: c,
                      borderRadius: `${tokens.radius.badge}px`,
                      border: `1px solid ${c}33`,
                    }}
                  >
                    {l}
                  </span>
                ))}
              </div>
            </div>

            {/* Token JSON export */}
            <div>
              <p className="text-[10px] text-muted-foreground mb-1.5">Design Tokens (JSON)</p>
              <button
                onClick={() => {
                  const json = JSON.stringify(tokens, null, 2);
                  navigator.clipboard.writeText(json);
                  toast.success("تم نسخ JSON");
                }}
                className="w-full text-[10px] py-1.5 border border-border/40 rounded-lg text-muted-foreground hover:text-foreground hover:border-border transition-colors flex items-center justify-center gap-1"
              >
                <Copy className="w-3 h-3" /> نسخ JSON
              </button>
            </div>
          </div>

          {/* Metadata */}
          <div className="pt-3 border-t border-border/30 space-y-1.5">
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">الخط</span>
              <span className="text-foreground font-medium">{tokens.typography.fontFamily}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">حجم الخط</span>
              <span className="text-foreground font-medium">{tokens.typography.baseSize}px</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">حواف البطاقات</span>
              <span className="text-foreground font-medium">{tokens.radius.card}px</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">حواف الأزرار</span>
              <span className="text-foreground font-medium">{tokens.radius.button}px</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
