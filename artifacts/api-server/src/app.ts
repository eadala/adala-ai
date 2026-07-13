import * as Sentry from "@sentry/node";
import express, { type Express, type ErrorRequestHandler } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { requestGuard, preventionErrorHandler, isMetricsBeaconPath } from "./prevention/request.guard";
import { IsolationMiddleware } from "./isolation/tenant.scope";
import { runtimeShield } from "./core/runtimeShield";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./webhookHandlers";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requestIdMiddleware } from "./middlewares/requestId";
import { globalErrorHandler } from "./middlewares/errorHandler";
import { registerSwaggerDocs } from "./docs/swagger";
import { prometheusMiddleware, registry } from "./observability/prometheus";

/* ── Sentry (backend) — initialise before Express ─────────────────────── */
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0.1,
  });
  logger.info("[Sentry] ✅ Backend monitoring active");
}

const app: Express = express();

// ── Replit deployment healthcheck — MUST be first, no middleware ──────────
// artifact.toml [services.production.health.startup] path = "/api/healthz"
// Also keep /api and /api/ping for backwards compat.
// All three bypass ALL middleware so they always respond immediately.
app.get("/api/healthz", (_req, res) => res.status(200).json({ ok: true, status: "healthy", ts: Date.now() }));
app.get("/api", (_req, res) => res.status(200).json({ ok: true, status: "healthy", ts: Date.now() }));
app.get("/api/ping", (_req, res) => res.status(200).json({ ok: true }));

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

// ─── Request ID — attach before anything else ───────────────────────────────
app.use(requestIdMiddleware);

// ─── Prometheus request tracking ─────────────────────────────────────────────
app.use(prometheusMiddleware());

// ─── Security & Performance middleware ───────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'", "'unsafe-inline'",
                       // Clerk dev instance (dev environment)
                       "https://clerk.accounts.dev", "https://*.clerk.accounts.dev",
                       "https://clerk.adalahai.com",
                       // Clerk Turnstile bot-protection (both dev and prod)
                       "https://challenges.cloudflare.com",
                       "https://js.stripe.com", "https://cdn.jsdelivr.net"],
      workerSrc:      ["'self'", "blob:"],
      styleSrc:       ["'self'", "'unsafe-inline'",
                       "https://fonts.googleapis.com"],
      imgSrc:         ["'self'", "data:", "blob:", "https:"],
      connectSrc:     ["'self'", "https:", "wss:"],
      fontSrc:        ["'self'", "https://fonts.gstatic.com", "data:"],
      objectSrc:      ["'none'"],
      frameSrc:       ["https://js.stripe.com",
                       // Clerk dev instance
                       "https://clerk.accounts.dev", "https://*.clerk.accounts.dev",
                       // Cloudflare Turnstile — required for Clerk sign-in bot protection
                       "https://challenges.cloudflare.com"],
      baseUri:        ["'self'"],
      formAction:     ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(cookieParser());

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

// Auth endpoints — strict brute-force protection
const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "تجاوزت محاولات تسجيل الدخول المسموح بها — انتظر دقيقة وحاول مجدداً" },
});
const registerLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "تجاوزت محاولات التسجيل — انتظر دقيقة وحاول مجدداً" },
});

app.use(globalLimiter);
app.use("/api/ai-chat",             strictLimiter);
app.use("/api/legal-ai",            strictLimiter);
app.use("/api/portal/create-token", strictLimiter);
app.use("/api/ai-copilot",          strictLimiter);
app.use("/api/copilot",             strictLimiter);
app.use("/api/client-auth/login",        authLimiter);
app.use("/api/client-auth/verify-otp",   authLimiter);
app.use("/api/client-auth/register",     registerLimiter);
app.use("/api/client-auth/request-otp",  registerLimiter);

// Upload endpoints — 20 req / 1min
const uploadLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "تجاوزت حد رفع الملفات المسموح به — انتظر دقيقة" },
});
app.use("/api/storage/upload",  uploadLimiter);
app.use("/api/documents/upload", uploadLimiter);
app.use("/api/branding/upload",  uploadLimiter);

// Info/recon endpoints — 20 req / 1min per IP (prevent infrastructure mapping)
const infoLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "تجاوزت حد الاستعلام المسموح به — انتظر دقيقة" },
});
app.use("/api/billing/calc-fee",     infoLimiter);
app.use("/api/billing/stripe-status", infoLimiter);
app.use("/api/email/smtp-status",    infoLimiter);
app.use("/api/rbac/permissions",     infoLimiter);
app.use("/api/platform/modules",     infoLimiter);
app.use("/api/fincore/providers",    infoLimiter);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Production domains — always allowed regardless of env var
const PRODUCTION_DOMAINS = [
  "https://adalahai.com",
  "https://www.adalahai.com",
];

app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (
      PRODUCTION_DOMAINS.includes(origin) ||
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
// sendBeacon posts JSON without application/json — parse as text before global JSON
app.use(/^\/api\/metrics\/vitals\/?$/, express.text({ type: "*/*", limit: "8kb" }));
app.use(/^\/api\/metrics\/route-analytics\/?$/, express.text({ type: "*/*", limit: "64kb" }));
// Global JSON limit: 3MB (large file uploads use multipart or per-route override)
app.use(express.json({ limit: "3mb" }));
app.use(express.urlencoded({ extended: true, limit: "3mb" }));

const clerk = clerkMiddleware((req) => ({
  publishableKey: publishableKeyFromHost(
    getClerkProxyHost(req) ?? "",
    process.env.CLERK_PUBLISHABLE_KEY,
  ),
}));
// Public fire-and-forget beacons — no Clerk session (sendBeacon sends cookies on same-origin)
app.use((req, res, next) => {
  if (isMetricsBeaconPath(req.path)) return next();
  return clerk(req, res, next);
});

// ─── Clerk JWT error guard ──────────────────────────────────────────────────
// Clerk throws synchronously on malformed/tampered tokens before routes run.
// Catch those errors and return 401 instead of crashing with 500.
app.use(((err: any, _req, res, next) => {
  const stack: string = err?.stack ?? "";
  const isClerkAuthError =
    err?.clerkError === true ||
    err?.status === 401 || err?.statusCode === 401 ||
    err?.name === "TokenExpiredError" ||
    err?.name === "JsonWebTokenError" ||
    (err?.name === "SyntaxError" && (stack.includes("@clerk") || stack.includes("decodeJwt") || stack.includes("verifyJwt"))) ||
    err?.message?.includes("Invalid token") ||
    err?.message?.includes("Unauthenticated");
  if (isClerkAuthError) {
    return res.status(401).json({ error: "غير مصرح. يرجى تسجيل الدخول." });
  }
  next(err);
}) as ErrorRequestHandler);

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

/* ── Internal heal webhook (Alertmanager → Docker restart) ───────────── */
import internalHealRouter from "./routes/internalHeal";
app.use("/internal", internalHealRouter);

/* ── Prometheus scrape endpoint — public, no auth ─────────────────────── */
app.get("/metrics", async (_req, res) => {
  try {
    res.set("Content-Type", registry.contentType);
    res.end(await registry.metrics());
  } catch (err) {
    res.status(500).end(String(err));
  }
});

app.use("/api", requestGuard);
app.use("/api", runtimeShield);
app.use("/api", IsolationMiddleware);
app.use("/api", router);
app.use(preventionErrorHandler);

/* ── Production: serve Vite frontend static files ─────────────────────── */
if (process.env.NODE_ENV === "production") {
  const publicDir = process.env.PUBLIC_DIR ?? "./public";

  app.use(express.static(publicDir, {
    maxAge: "1d",
    etag: true,
  }));

  app.get(/^\/(?!api|assets|favicon\.svg|logo\.svg|robots\.txt|sw\.js|opengraph\.jpg).*/, (_req, res) => {
    res.sendFile("index.html", { root: publicDir });
  });
}

app.use(globalErrorHandler);

/* ── Swagger API docs (/api/docs) ─────────────────────────────────────── */
registerSwaggerDocs(app);

export default app;
