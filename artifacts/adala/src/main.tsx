import { createRoot } from "react-dom/client";
import { Component } from "react";
import type { ReactNode } from "react";
import App from "./App";
import "./index.css";
import "./print.css";
import "./i18n/i18n";

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
          <h2 style={{ color: "#C9A84C", fontSize: "1.5rem", fontWeight: "bold" }}>
            حدث خطأ في التطبيق
          </h2>
          <p style={{ color: "#A0ADB8", maxWidth: "600px" }}>{this.state.error.message}</p>
          <pre style={{
            background: "#1A2744", border: "1px solid #2D3D6B", borderRadius: "8px",
            padding: "1rem", fontSize: "0.75rem", color: "#A0ADB8",
            maxWidth: "800px", overflow: "auto", textAlign: "left",
          }}>
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "#C9A84C", color: "#1A2744", border: "none",
              padding: "0.75rem 1.5rem", borderRadius: "8px",
              fontWeight: "bold", cursor: "pointer", fontSize: "1rem",
            }}
          >
            إعادة تحميل الصفحة
          </button>
        </div>
      );
    }
    return this.props.children;
  }
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
