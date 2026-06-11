import { useEffect, useState } from "react";

const FULL_APP_PATH = "/adala/dashboard";

export default function App() {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    /* Animate progress bar */
    const start = Date.now();
    const duration = 1800;
    const tick = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min((elapsed / duration) * 100, 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(tick);
        setPhase("ready");
      }
    }, 16);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (phase === "ready") {
      const t = setTimeout(() => {
        const origin = window.location.origin;
        window.location.replace(`${origin}${FULL_APP_PATH}`);
      }, 400);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const done = phase === "ready";

  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100dvh",
        background: "linear-gradient(160deg, #0D1526 0%, #0F1C35 50%, #0D1526 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Cairo', sans-serif",
        padding: "24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background glow */}
      <div style={{
        position: "absolute",
        top: "30%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "400px",
        height: "400px",
        background: "radial-gradient(circle, rgba(201,168,76,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Logo mark */}
      <div style={{
        width: "88px",
        height: "88px",
        borderRadius: "24px",
        background: "linear-gradient(135deg, #1A2744 0%, #243560 100%)",
        border: "1.5px solid rgba(201,168,76,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: "24px",
        boxShadow: "0 8px 40px rgba(201,168,76,0.15), 0 2px 8px rgba(0,0,0,0.4)",
        transform: done ? "scale(1.05)" : "scale(1)",
        transition: "transform 0.4s ease",
      }}>
        <span style={{
          fontSize: "38px",
          fontWeight: "900",
          color: "#C9A84C",
          lineHeight: 1,
          fontFamily: "'Cairo', sans-serif",
        }}>ع</span>
      </div>

      {/* Title */}
      <h1 style={{
        fontSize: "28px",
        fontWeight: "900",
        color: "#E8EAF0",
        margin: "0 0 6px",
        letterSpacing: "-0.5px",
        textAlign: "center",
      }}>
        عدالة <span style={{ color: "#C9A84C" }}>AI</span>
      </h1>

      {/* Subtitle */}
      <p style={{
        fontSize: "13px",
        color: "rgba(232,234,240,0.45)",
        margin: "0 0 48px",
        textAlign: "center",
        fontWeight: "500",
      }}>
        منصة قانونية متكاملة
      </p>

      {/* Progress track */}
      <div style={{
        width: "200px",
        height: "3px",
        borderRadius: "99px",
        background: "rgba(255,255,255,0.08)",
        overflow: "hidden",
        marginBottom: "18px",
      }}>
        <div style={{
          height: "100%",
          width: `${progress}%`,
          borderRadius: "99px",
          background: "linear-gradient(90deg, #C9A84C, #E8C96A)",
          transition: "width 0.08s linear",
          boxShadow: "0 0 8px rgba(201,168,76,0.6)",
        }} />
      </div>

      {/* Status text */}
      <p style={{
        fontSize: "12px",
        color: done ? "#C9A84C" : "rgba(232,234,240,0.4)",
        margin: 0,
        fontWeight: "600",
        letterSpacing: "0.3px",
        transition: "color 0.3s ease",
      }}>
        {done ? "✓ جاهز — جارٍ الانتقال…" : "يتم تحضير لوحة التحكم…"}
      </p>

      {/* Skip link */}
      <a
        href={FULL_APP_PATH}
        style={{
          position: "absolute",
          bottom: "40px",
          fontSize: "12px",
          color: "rgba(201,168,76,0.6)",
          textDecoration: "none",
          fontWeight: "500",
          borderBottom: "1px solid rgba(201,168,76,0.25)",
          paddingBottom: "1px",
        }}
      >
        الانتقال الفوري ←
      </a>
    </div>
  );
}
