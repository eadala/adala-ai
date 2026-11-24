/**
 * Production static file server — CommonJS for fast cold start.
 * CJS binds the listen port quickly so reverse-proxy healthchecks succeed.
 */
const http = require("node:http");
const fs   = require("node:fs");
const path = require("node:path");

const DIST = path.join(__dirname, "dist-stable");
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

const server = http.createServer(function(req, res) {
  var url      = (req.url || "/").split("?")[0];
  var rel      = url === "/" ? "/index.html" : url;
  var abs      = path.join(DIST, rel);
  var ext      = path.extname(abs).toLowerCase();
  var isAsset  = url.startsWith("/assets/");

  if (!abs.startsWith(DIST)) { res.writeHead(403); res.end(); return; }

  function serve(filePath, fallback) {
    try {
      var data = fs.readFileSync(filePath);
      var mime = MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
      var cc   = isAsset ? "public, max-age=31536000, immutable" : "no-store, no-cache, must-revalidate";
      res.writeHead(200, { "Content-Type": mime, "Cache-Control": cc });
      res.end(data);
    } catch (_) {
      if (fallback) {
        try {
          var html = fs.readFileSync(path.join(DIST, "index.html"));
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store, no-cache, must-revalidate" });
          res.end(html);
        } catch (_2) { res.writeHead(404); res.end("Not found"); }
      } else { res.writeHead(404); res.end("Not found"); }
    }
  }

  serve(abs, !isAsset && ext !== ".js" && ext !== ".css");
});

server.listen(PORT, "0.0.0.0", function() {
  console.log("[serve] listening on :" + PORT + " — serving " + DIST);
});
