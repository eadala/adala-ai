/**
 * Minimal production static file server for adala.
 * Starts in <50ms — no frameworks, no dependencies.
 * SPA fallback: unknown routes → index.html
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "dist", "public");
const PORT = Number(process.env.PORT ?? 3000);

const MIME = {
  ".html":  "text/html; charset=utf-8",
  ".js":    "application/javascript",
  ".mjs":   "application/javascript",
  ".css":   "text/css",
  ".json":  "application/json",
  ".svg":   "image/svg+xml",
  ".png":   "image/png",
  ".jpg":   "image/jpeg",
  ".jpeg":  "image/jpeg",
  ".ico":   "image/x-icon",
  ".woff":  "font/woff",
  ".woff2": "font/woff2",
  ".ttf":   "font/ttf",
  ".txt":   "text/plain",
  ".webp":  "image/webp",
};

const server = http.createServer((req, res) => {
  const url = (req.url ?? "/").split("?")[0];

  // Normalize: / → /index.html
  const rel   = url === "/" ? "/index.html" : url;
  const abs   = path.join(DIST, rel);
  const ext   = path.extname(abs).toLowerCase();
  const isAsset = url.startsWith("/assets/");

  // Security: stay inside DIST
  if (!abs.startsWith(DIST)) {
    res.writeHead(403); res.end(); return;
  }

  const tryFile = (filePath, fallbackToSpa) => {
    try {
      const data = fs.readFileSync(filePath);
      const mime = MIME[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
      const cc   = isAsset
        ? "public, max-age=31536000, immutable"
        : "no-store, no-cache, must-revalidate";
      res.writeHead(200, { "Content-Type": mime, "Cache-Control": cc });
      res.end(data);
    } catch {
      if (fallbackToSpa) {
        // SPA fallback — return index.html for client-side routes
        try {
          const html = fs.readFileSync(path.join(DIST, "index.html"));
          res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store, no-cache, must-revalidate",
          });
          res.end(html);
        } catch {
          res.writeHead(404); res.end("Not found");
        }
      } else {
        res.writeHead(404); res.end("Not found");
      }
    }
  };

  // Assets: exact match only, no SPA fallback
  // HTML/routes: SPA fallback on miss
  tryFile(abs, !isAsset && ext !== ".js" && ext !== ".css");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[serve] listening on :${PORT} — serving ${DIST}`);
});
