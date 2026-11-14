import express from "express";
import cors from "cors";
import { apiRouter } from "./routes/api.js";
import { asAuthed, optionalAuth, requestIdMiddleware } from "./lib/auth.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  /* Phase 2A: allowlist local console only — not reflect-any-origin */
  const allowed = (process.env.ARC_CORS_ORIGIN ?? "http://127.0.0.1:5177").split(",");
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || allowed.includes(origin)) {
          cb(null, true);
          return;
        }
        cb(null, false);
      },
    }),
  );
  app.use(express.json({ limit: "256kb" }));
  app.use(requestIdMiddleware);
  app.use(optionalAuth);
  app.use((req, res, next) => {
    const reject = (req as { authReject?: string }).authReject;
    if (reject) {
      res.status(reject === "role_header_forbidden" ? 403 : 401).json({
        error: reject === "role_header_forbidden" ? "forbidden" : "unauthorized",
        reason: reject,
        message:
          reject === "role_header_forbidden"
            ? "Client-supplied X-ARC-Role is rejected"
            : "Invalid authentication material",
      });
      return;
    }
    res.setHeader("X-ARC-Phase", "2CG");
    res.setHeader("X-ARC-Deployment-Execution", "disabled");
    res.setHeader("X-Request-Id", asAuthed(req).requestId);
    next();
  });
  app.use("/api/arc", apiRouter);
  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });
  return app;
}
