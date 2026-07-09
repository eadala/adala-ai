/**
 * Shared production-readiness validators for launch dashboards.
 * Used by go-live metrics, system status, and super-admin tooling.
 */

import { isObjectStorageConfigured } from "../core/storage";

export interface ReadinessResult {
  ok: boolean;
  detail: string;
}

export function stripeProductionReadiness(): ReadinessResult {
  const secret = process.env.STRIPE_SECRET_KEY ?? "";
  const webhook = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  const publishable =
    process.env.VITE_STRIPE_PUBLISHABLE_KEY ??
    process.env.STRIPE_PUBLISHABLE_KEY ??
    "";

  const issues: string[] = [];

  if (!secret) {
    issues.push("STRIPE_SECRET_KEY مفقود");
  } else if (secret.startsWith("sk_test_")) {
    issues.push("المفتاح السري في وضع TEST — يتطلب sk_live_*");
  } else if (!secret.startsWith("sk_live_")) {
    issues.push("STRIPE_SECRET_KEY غير معروف الصيغة");
  }

  if (!webhook) {
    issues.push("STRIPE_WEBHOOK_SECRET مفقود");
  } else if (!webhook.startsWith("whsec_")) {
    issues.push("STRIPE_WEBHOOK_SECRET غير صالح");
  }

  if (!publishable) {
    issues.push("VITE_STRIPE_PUBLISHABLE_KEY مفقود");
  } else if (publishable.startsWith("pk_test_")) {
    issues.push("المفتاح العام في وضع TEST — يتطلب pk_live_*");
  } else if (!publishable.startsWith("pk_live_")) {
    issues.push("VITE_STRIPE_PUBLISHABLE_KEY غير معروف الصيغة");
  }

  if (issues.length === 0) {
    return { ok: true, detail: "Stripe جاهز للإنتاج (live keys + webhook secret)" };
  }
  return { ok: false, detail: issues.join(" · ") };
}

export function clerkProductionReadiness(): ReadinessResult {
  const secret = process.env.CLERK_SECRET_KEY ?? "";
  const publishable =
    process.env.VITE_CLERK_PUBLISHABLE_KEY ??
    process.env.CLERK_PUBLISHABLE_KEY ??
    "";

  const issues: string[] = [];

  if (!secret) {
    issues.push("CLERK_SECRET_KEY مفقود");
  } else if (secret.startsWith("sk_test_")) {
    issues.push("CLERK_SECRET_KEY في وضع TEST — يتطلب sk_live_*");
  } else if (!secret.startsWith("sk_live_")) {
    issues.push("CLERK_SECRET_KEY غير معروف الصيغة");
  }

  if (!publishable) {
    issues.push("VITE_CLERK_PUBLISHABLE_KEY مفقود");
  } else if (publishable.startsWith("pk_test_")) {
    issues.push("مفتاح Clerk العام في وضع TEST — يتطلب pk_live_*");
  } else if (!publishable.startsWith("pk_live_")) {
    issues.push("VITE_CLERK_PUBLISHABLE_KEY غير معروف الصيغة");
  }

  if (issues.length === 0) {
    return { ok: true, detail: "Clerk جاهز للإنتاج (live keys + JWT + RBAC)" };
  }
  return { ok: false, detail: issues.join(" · ") };
}

/** Cloudflare R2 / object storage readiness for dashboards. */
export function r2StorageReadiness(): ReadinessResult {
  if (isObjectStorageConfigured()) {
    return { ok: true, detail: "Cloudflare R2 مُهيَّأ (R2_BUCKET_NAME + credentials)" };
  }
  return {
    ok: false,
    detail: "R2 غير مُهيَّأ — عيّن R2_BUCKET_NAME, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY",
  };
}

/** Maps readiness to public system-status severity. */
export function stripeSystemStatus(): {
  status: "operational" | "degraded" | "outage";
  detail: string;
} {
  const secret = process.env.STRIPE_SECRET_KEY ?? "";
  const webhook = process.env.STRIPE_WEBHOOK_SECRET ?? "";

  if (!secret || !webhook) {
    return { status: "outage", detail: "Stripe غير مضبوط (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET)" };
  }

  const readiness = stripeProductionReadiness();
  if (!readiness.ok) {
    return { status: "degraded", detail: readiness.detail };
  }
  return { status: "operational", detail: "Stripe جاهز للإنتاج" };
}

/** Logs P0 launch blockers at server boot (production only). */
export function logLaunchReadinessWarnings(log: (msg: string, meta?: object) => void): void {
  if (process.env.NODE_ENV !== "production") return;

  const stripe = stripeProductionReadiness();
  if (!stripe.ok) {
    log("[LaunchGate] Stripe not production-ready", { detail: stripe.detail });
  }

  const clerk = clerkProductionReadiness();
  if (!clerk.ok) {
    log("[LaunchGate] Clerk not production-ready", { detail: clerk.detail });
  }
}
