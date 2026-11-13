import express from "express";
import cors from "cors";
import { apiRouter } from "./routes/api.js";
import { asAuthed, optionalAuth, requestIdMiddleware } from "./lib/auth.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "256kb" }));
  app.use(requestIdMiddleware);
  app.use(optionalAuth);
  app.use((req, res, next) => {
    res.setHeader("X-ARC-Phase", "1");
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
