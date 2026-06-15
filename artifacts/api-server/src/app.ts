import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { requestGuard, preventionErrorHandler } from "./prevention/request.guard";
import { IsolationMiddleware } from "./isolation/tenant.scope";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./webhookHandlers";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const app: Express = express();

// Trust Replit's reverse proxy so rate-limit reads the real client IP
app.set("trust proxy", 1);

// ─── Stripe Webhook MUST be before express.json() ───
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) { res.status(400).json({ error: "Missing stripe-signature" }); return; }
    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (err: any) {
      logger.error({ err }, "Stripe webhook error");
      res.status(400).json({ error: "Webhook processing error" });
    }
  }
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ─── Security & Performance middleware ───
app.use(helmet({
  contentSecurityPolicy: false,   // handled by frontend
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());

// Global rate limit: 300 req / 1min per IP
const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "طلبات كثيرة — حاول مجدداً خلال دقيقة" },
  skip: (req) => req.path.startsWith("/api/stripe/webhook"),
});

// Strict limit for auth/AI endpoints: 30 req / 1min
const strictLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "تجاوزت حد الطلبات المسموح به" },
});

app.use(globalLimiter);
app.use("/api/ai-chat", strictLimiter);
app.use("/api/legal-ai", strictLimiter);
app.use("/api/portal/create-token", strictLimiter);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (
      ALLOWED_ORIGINS.includes(origin) ||
      /^https:\/\/.*\.replit\.app$/.test(origin) ||
      /^https:\/\/.*\.replit\.dev$/.test(origin) ||
      /^http:\/\/localhost(:\d+)?$/.test(origin)
    ) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin not allowed — ${origin}`));
  },
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

// ─── RLS Session Reset ─────────────────────────────────────────────────────
// After each response, clear the tenant session variable.
// requireAuthWithTenant sets it per-request; this ensures the pool
// connection never carries stale tenant state into the next request.
app.use((_req, res, next) => {
  res.on("finish", () => {
    db.execute(sql`SELECT set_config('app.current_tenant', '', false)`).catch(() => {});
  });
  next();
});

app.use("/api", requestGuard);
app.use("/api", IsolationMiddleware);
app.use("/api", router);
app.use(preventionErrorHandler);

export default app;
