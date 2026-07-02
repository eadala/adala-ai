import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "node:fs";
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
    // ── Production preview server: correct cache headers + SPA fallback ─────
    {
      name: "preview-cache-and-spa",
      configurePreviewServer(server) {
        // 1. Per-file-type cache headers (runs before static file serving)
        server.middlewares.use((req, res, next) => {
          const url = (req.url ?? "").split("?")[0];
          if (url.startsWith("/assets/")) {
            // Content-hashed assets: safe to cache forever
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          } else {
            // HTML + SW + manifest: never cache — ensures fresh HTML on every deploy
            res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
            res.setHeader("Pragma", "no-cache");
          }
          next();
        });
        // 2. SPA fallback — return after built-in static handler so unknown routes
        //    serve index.html instead of 404 (required for client-side routing)
        return () => {
          const distDir = path.resolve(import.meta.dirname, "dist/public");
          server.middlewares.use((_req, res) => {
            const indexPath = path.join(distDir, "index.html");
            try {
              const html = fs.readFileSync(indexPath, "utf-8");
              res.setHeader("Content-Type", "text/html; charset=utf-8");
              res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
              res.end(html);
            } catch {
              res.statusCode = 404;
              res.end("Not found");
            }
          });
        };
      },
    },
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
          // Tiptap rich-text editor — heavy, only used in contracts page
          if (id.includes("node_modules/@tiptap/")) {
            return "vendor-editor";
          }
          // Framer Motion — animations, large, independent release cycle
          if (id.includes("node_modules/framer-motion")) {
            return "vendor-motion";
          }
          // Sentry monitoring — non-critical, load after app init
          if (
            id.includes("node_modules/@sentry/") ||
            id.includes("node_modules/@sentry-internal/")
          ) {
            return "vendor-monitoring";
          }
          // PDF / document utilities
          if (
            id.includes("node_modules/jspdf") ||
            id.includes("node_modules/html2canvas") ||
            id.includes("node_modules/pdfmake")
          ) {
            return "vendor-pdf";
          }
          // General utilities (non-UI, non-react)
          if (
            id.includes("node_modules/date-fns") ||
            id.includes("node_modules/zod") ||
            id.includes("node_modules/js-yaml") ||
            id.includes("node_modules/linkify-it") ||
            id.includes("node_modules/markdown-it")
          ) {
            return "vendor-utils";
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
        "worker-src 'self' blob:",
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

// Plugin is defined outside defineConfig to avoid hoisting issues
// It controls cache headers per file type and provides SPA fallback for vite preview
