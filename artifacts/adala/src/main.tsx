import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./print.css";
import "./i18n/i18n";

/* Register Service Worker for Push Notifications */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" })
      .then(r => console.log("[SW] Registered:", r.scope))
      .catch(e => console.warn("[SW] Registration failed:", e));
  });
}

createRoot(document.getElementById("root")!).render(<App />);
