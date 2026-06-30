/**
 * Web Vitals Monitor — عدالة AI
 *
 * Captures Core Web Vitals (LCP, INP, CLS, FCP, TTFB) and:
 *   1. Reports to Sentry if configured
 *   2. Reports to our own /api/metrics/vitals endpoint
 *   3. Logs to console.warn in development if thresholds are exceeded
 *
 * Thresholds based on Google's "Good" band:
 *   LCP  ≤ 2500ms   | INP  ≤ 200ms
 *   CLS  ≤ 0.1      | FCP  ≤ 1800ms   | TTFB ≤ 800ms
 */

import * as Sentry from "@sentry/react";

interface VitalEntry {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  id: string;
}

const THRESHOLDS: Record<string, [number, number]> = {
  LCP:  [2500,  4000],
  INP:  [200,   500],
  CLS:  [0.1,   0.25],
  FCP:  [1800,  3000],
  TTFB: [800,   1800],
};

function getRating(name: string, value: number): VitalEntry["rating"] {
  const [good, poor] = THRESHOLDS[name] ?? [Infinity, Infinity];
  if (value <= good) return "good";
  if (value <= poor) return "needs-improvement";
  return "poor";
}

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function reportVital(entry: VitalEntry) {
  const { name, value, rating, id } = entry;

  // 1. Sentry performance breadcrumb
  if (import.meta.env.VITE_SENTRY_DSN) {
    Sentry.addBreadcrumb({
      category: "web-vitals",
      message:  `${name}: ${value.toFixed(2)} (${rating})`,
      level:    rating === "poor" ? "warning" : "info",
      data:     { name, value, rating, id },
    });
    if (rating === "poor") {
      Sentry.captureMessage(`Web Vital degraded: ${name} = ${value.toFixed(0)}`, "warning");
    }
  }

  // 2. Report to backend metrics endpoint (fire-and-forget)
  if (import.meta.env.PROD) {
    try {
      const body = JSON.stringify({ name, value, rating, id, url: location.pathname });
      navigator.sendBeacon?.(`${BASE}/api/metrics/vitals`, body) ??
        fetch(`${BASE}/api/metrics/vitals`, {
          method: "POST",
          body,
          headers: { "Content-Type": "application/json" },
          keepalive: true,
        }).catch(() => { /* ignore */ });
    } catch { /* ignore */ }
  }

  // 3. Dev warning when threshold exceeded
  if (import.meta.env.DEV && rating !== "good") {
    console.warn(
      `[Web Vitals] ${name} = ${value.toFixed(2)} — ${rating.toUpperCase()}` +
      ` (good ≤ ${THRESHOLDS[name]?.[0] ?? "N/A"})`,
    );
  }
}

/**
 * Initialise Web Vitals monitoring using PerformanceObserver.
 * Call once from main.tsx after the app mounts.
 */
export function initWebVitals(): void {
  if (typeof window === "undefined" || !("PerformanceObserver" in window)) return;

  // ── LCP (Largest Contentful Paint) ─────────────────────────────────────────
  try {
    let lcp = 0;
    const lcpObs = new PerformanceObserver(list => {
      const entries = list.getEntries() as PerformanceEntry[];
      if (entries.length) lcp = (entries[entries.length - 1] as { startTime: number }).startTime;
    });
    lcpObs.observe({ type: "largest-contentful-paint", buffered: true });
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && lcp > 0) {
        reportVital({ name: "LCP", value: lcp, rating: getRating("LCP", lcp), id: "lcp-1" });
        lcp = 0;
      }
    }, { once: true });
  } catch { /* observer not supported */ }

  // ── CLS (Cumulative Layout Shift) ──────────────────────────────────────────
  try {
    let cls = 0;
    const clsObs = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        const e = entry as { hadRecentInput?: boolean; value?: number };
        if (!e.hadRecentInput) cls += e.value ?? 0;
      }
    });
    clsObs.observe({ type: "layout-shift", buffered: true });
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        reportVital({ name: "CLS", value: cls, rating: getRating("CLS", cls), id: "cls-1" });
      }
    }, { once: true });
  } catch { /* observer not supported */ }

  // ── FCP (First Contentful Paint) ───────────────────────────────────────────
  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (entry.name === "first-contentful-paint") {
          reportVital({
            name:   "FCP",
            value:  entry.startTime,
            rating: getRating("FCP", entry.startTime),
            id:     "fcp-1",
          });
        }
      }
    }).observe({ type: "paint", buffered: true });
  } catch { /* observer not supported */ }

  // ── TTFB (Time to First Byte) ──────────────────────────────────────────────
  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        const nav = entry as unknown as { responseStart?: number; requestStart?: number };
        if (entry.entryType === "navigation") {
          const ttfb = (nav.responseStart ?? 0) - (nav.requestStart ?? 0);
          if (ttfb > 0) {
            reportVital({ name: "TTFB", value: ttfb, rating: getRating("TTFB", ttfb), id: "ttfb-1" });
          }
        }
      }
    }).observe({ type: "navigation", buffered: true });
  } catch { /* observer not supported */ }

  // ── INP (Interaction to Next Paint) — Event Timing API ────────────────────
  try {
    let maxINP = 0;
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        const e = entry as { processingStart?: number; startTime?: number; duration?: number };
        const inp = (e.processingStart ?? 0) - (e.startTime ?? 0);
        if (inp > maxINP) maxINP = inp;
      }
    }).observe({ type: "event", buffered: true, durationThreshold: 40 } as PerformanceObserverInit);
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && maxINP > 0) {
        reportVital({ name: "INP", value: maxINP, rating: getRating("INP", maxINP), id: "inp-1" });
      }
    }, { once: true });
  } catch { /* observer not supported */ }
}
