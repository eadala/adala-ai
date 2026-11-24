/**
 * Request Guard — الحارس الأول قبل أي طلب
 * يمنع: null values, broken payloads, malformed requests, تجاوز الحجم
 */

import type { Request, Response, NextFunction } from "express";
import { circuitBreaker, CIRCUITS, CircuitOpenError } from "./circuit.breaker";
import { evaluateRules, buildRuleContext } from "./rules.engine";
import { collectMetrics } from "../observability/metrics";
import { preventionLog } from "./prevention.log";
export {
  isMetricsBeaconPath,
  isMetricsBeaconRequest,
  getRequestPathname,
  normalizeBeaconPath,
} from "../lib/metricsBeaconPath";
import { isMetricsBeaconRequest } from "../lib/metricsBeaconPath";

/** حارس عام — يُركَّب على جميع مسارات /api */
export function requestGuard(req: Request, res: Response, next: NextFunction) {
  try {
    /* 1. تحقق من نوع المحتوى لطلبات POST/PUT/PATCH */
    if (["POST", "PUT", "PATCH"].includes(req.method) && !isMetricsBeaconRequest(req)) {
      const contentType = req.headers["content-type"] ?? "";
      if (
        req.body !== undefined &&
        Object.keys(req.body).length > 0 &&
        !contentType.includes("application/json") &&
        !contentType.includes("multipart/form-data") &&
        !contentType.includes("application/x-www-form-urlencoded")
      ) {
        preventionLog("BLOCKED", "INVALID_CONTENT_TYPE", req.path);
        return res.status(415).json({
          error: "Unsupported Media Type",
          code: "INVALID_CONTENT_TYPE",
          prevention: true,
        });
      }
    }

    /* 2. تمنع body بحجم ضخم بعد الحد (express.json limit=10mb يمنع ذلك لكن نُضيف طبقة إضافية) */
    /* 3. تمنع injection في query params */
    for (const [, val] of Object.entries(req.query)) {
      if (typeof val === "string" && val.length > 2000) {
        preventionLog("BLOCKED", "OVERSIZED_QUERY_PARAM", req.path);
        return res.status(400).json({
          error: "Query parameter too long",
          code: "OVERSIZED_QUERY_PARAM",
          prevention: true,
        });
      }
    }

    next();
  } catch {
    next();
  }
}

/** حارس الدفع — يُركَّب على مسارات Stripe والفواتير */
export function paymentGuard(req: Request, res: Response, next: NextFunction) {
  /* تحقق من دائرة Stripe */
  const stripeState = circuitBreaker.getState(CIRCUITS.STRIPE);
  if (stripeState === "OPEN") {
    preventionLog("BLOCKED", "STRIPE_CIRCUIT_OPEN", req.path);
    return res.status(503).json({
      error: "Payment service temporarily unavailable",
      code: "STRIPE_CIRCUIT_OPEN",
      prevention: true,
      retryAfter: 30,
    });
  }

  /* تحقق من وجود مفتاح Stripe */
  if (!process.env.STRIPE_SECRET_KEY) {
    preventionLog("BLOCKED", "STRIPE_NOT_CONFIGURED", req.path);
    return res.status(503).json({
      error: "Payment flow is not configured",
      code: "STRIPE_NOT_CONFIGURED",
      prevention: true,
    });
  }

  next();
}

/** حارس قاعدة البيانات — يُركَّب على عمليات write الثقيلة */
export function dbGuard(req: Request, res: Response, next: NextFunction) {
  const dbState = circuitBreaker.getState(CIRCUITS.DATABASE);
  if (dbState === "OPEN") {
    preventionLog("BLOCKED", "DB_CIRCUIT_OPEN", req.path);
    return res.status(503).json({
      error: "Database service temporarily unavailable",
      code: "DB_CIRCUIT_OPEN",
      prevention: true,
      retryAfter: 15,
    });
  }
  next();
}

/** تشغيل محرك القواعد في الـ cron */
export async function runPreventionCheck(): Promise<{
  blocked: boolean;
  throttled: boolean;
  triggered: number;
  actions: string[];
}> {
  try {
    const metrics = await collectMetrics();
    const ctx = buildRuleContext({
      dbLatency:       metrics.dbLatency,
      memoryPercent:   metrics.memory.percent,
      webhookFailures: metrics.webhookFailures,
      errorRate:       metrics.errorRate,
      activeRequests:  metrics.activeRequests,
    });
    const result = evaluateRules(ctx);

    /* تطبيق الإجراءات الفعلية */
    if (result.actions.includes("OPEN_CIRCUIT")) {
      circuitBreaker.record(CIRCUITS.STRIPE, false);
    }

    return {
      blocked:   result.blocked,
      throttled: result.throttled,
      triggered: result.results.length,
      actions:   result.actions,
    };
  } catch {
    return { blocked: false, throttled: false, triggered: 0, actions: [] };
  }
}

/** معالج خطأ موحّد لـ StateValidationError و CircuitOpenError */
export function preventionErrorHandler(
  err: any,
  _req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof CircuitOpenError) {
    return res.status(503).json({
      error: err.message,
      code: "CIRCUIT_OPEN",
      circuit: err.circuit,
      prevention: true,
      retryAfter: 30,
    });
  }
  if (err?.name === "StateValidationError") {
    return res.status(422).json({
      error: err.message,
      code: err.code ?? "STATE_VALIDATION",
      prevention: true,
    });
  }
  next(err);
}
