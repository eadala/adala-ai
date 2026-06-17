import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import { Component } from "react";
import type { ReactNode } from "react";
import App from "./App";
import "./index.css";
import "./print.css";
import "./i18n/i18n";

/* ── Sentry (frontend) — initialise once at app startup ─────────────────── */
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      const isDev = import.meta.env.DEV;
      return (
        <div
          dir="rtl"
          style={{
            minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
            background: "#0F1B35", color: "#F8F9FA", fontFamily: "Arial, sans-serif",
            padding: "2rem", flexDirection: "column", gap: "1rem", textAlign: "center",
          }}
        >
          <div style={{ fontSize: "3rem" }}>⚖️</div>
          <h2 style={{ color: "#2563EB", fontSize: "1.5rem", fontWeight: "bold" }}>
            حدث خطأ غير متوقع
          </h2>
          <p style={{ color: "#A0ADB8", maxWidth: "500px", lineHeight: "1.7" }}>
            نعتذر عن هذا الانقطاع. فريق عدالة AI تلقّى تنبيهاً تلقائياً وسيعمل على الإصلاح فوراً.
          </p>
          {isDev && (
            <pre style={{
              background: "#1A2744", border: "1px solid #2D3D6B", borderRadius: "8px",
              padding: "1rem", fontSize: "0.75rem", color: "#A0ADB8",
              maxWidth: "800px", overflow: "auto", textAlign: "left",
            }}>
              {this.state.error.stack}
            </pre>
          )}
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: "#2563EB", color: "#fff", border: "none",
                padding: "0.75rem 1.5rem", borderRadius: "8px",
                fontWeight: "bold", cursor: "pointer", fontSize: "1rem",
              }}
            >
              إعادة تحميل الصفحة
            </button>
            <button
              onClick={() => { window.location.href = "/dashboard"; }}
              style={{
                background: "transparent", color: "#A0ADB8",
                border: "1px solid #2D3D6B", padding: "0.75rem 1.5rem",
                borderRadius: "8px", cursor: "pointer", fontSize: "1rem",
              }}
            >
              العودة للرئيسية
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ── Global error capture — dev only shows overlay, prod reports silently ── */
if (import.meta.env.DEV) {
  window.addEventListener("error", (e) => {
    const pre = document.createElement("pre");
    pre.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:#0F1B35;color:#ff6b6b;padding:20px;overflow:auto;font-size:13px;white-space:pre-wrap;";
    pre.textContent = "[JS Error]\n" + (e.error?.stack || e.message || String(e));
    document.body?.appendChild(pre);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const pre = document.createElement("pre");
    pre.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:#0F1B35;color:#ff6b6b;padding:20px;overflow:auto;font-size:13px;white-space:pre-wrap;";
    pre.textContent = "[Unhandled Promise]\n" + (e.reason?.stack || String(e.reason));
    document.body?.appendChild(pre);
  });
} else {
  window.addEventListener("unhandledrejection", (e) => {
    if (import.meta.env.VITE_SENTRY_DSN) {
      Sentry.captureException(e.reason);
    }
  });
}

/* Register Service Worker for Push Notifications */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" })
      .then(r => console.log("[SW] Registered:", r.scope))
      .catch(e => console.warn("[SW] Registration failed:", e));
  });
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
