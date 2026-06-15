import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT;
const isBuild = process.argv.includes("build");

if (!rawPort && !isBuild) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort ?? "3000");

if (!isBuild && (Number.isNaN(port) || port <= 0)) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss({ optimize: false }),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "@tanstack/react-table",
      "@tanstack/react-query",
      "wouter",
    ],
    exclude: [
      "@replit/vite-plugin-cartographer",
      "@replit/vite-plugin-dev-banner",
    ],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    target: "es2020",
    minify: "esbuild",
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core — always cached, changes never
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/react/jsx-runtime")
          ) {
            return "vendor-react";
          }
          // Clerk auth — large, independent release cycle
          if (id.includes("node_modules/@clerk/")) {
            return "vendor-clerk";
          }
          // TanStack — query + table together
          if (id.includes("node_modules/@tanstack/")) {
            return "vendor-tanstack";
          }
          // Routing
          if (id.includes("node_modules/wouter")) {
            return "vendor-router";
          }
          // Recharts + d3 — only needed on analytics/finance pages
          if (
            id.includes("node_modules/recharts") ||
            id.includes("node_modules/d3-") ||
            id.includes("node_modules/victory-")
          ) {
            return "vendor-charts";
          }
          // ── @radix-ui + all other node_modules: NO manual grouping ──────────
          // ANY manual grouping of @radix-ui caused one of two errors:
          //   1. All in one chunk → TDZ "Cannot access 'X' before initialization"
          //   2. Per-package chunks → "undefined is not an object (t.useLayoutEffect)"
          // Solution: let Rollup's automatic chunk algorithm decide everything
          // else. It uses the actual dependency graph so circular deps between
          // Radix packages are resolved in the correct initialisation order.
          // Lucide icons — explicitly chunked (large, shared, no circular deps)
          if (id.includes("node_modules/lucide-react")) {
            return "vendor-icons";
          }
          // i18n — large, language-switch only
          if (
            id.includes("node_modules/i18next") ||
            id.includes("node_modules/react-i18next")
          ) {
            return "vendor-i18n";
          }
          // Everything else (Radix, shadcn utils, cmdk, etc.) → Rollup auto
        },
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    headers: {
      "Content-Security-Policy": [
        "default-src 'self'",
        // Clerk needs unsafe-inline for injected styles; unsafe-eval removed
        "script-src 'self' 'unsafe-inline' https://clerk.accounts.dev https://*.clerk.accounts.dev https://js.stripe.com https://cdn.jsdelivr.net",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob: https:",
        "connect-src 'self' https: wss:",
        "frame-src https://js.stripe.com https://clerk.accounts.dev https://*.clerk.accounts.dev",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; "),
    },
    fs: {
      strict: true,
    },
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
