import type { Request } from "express";
import { logger } from "./logger";

type PgErrorLike = {
  code?: string;
  detail?: string;
  hint?: string;
  constraint?: string;
  column?: string;
  table?: string;
  message?: string;
  stack?: string;
};

function asError(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(typeof err === "string" ? err : JSON.stringify(err));
}

function extractDbFields(err: unknown): {
  dbCode?: string;
  dbDetail?: string;
  dbHint?: string;
  dbConstraint?: string;
  causeMessage?: string;
} {
  const out: ReturnType<typeof extractDbFields> = {};
  let current: unknown = err;
  const seen = new Set<unknown>();

  while (current && !seen.has(current)) {
    seen.add(current);
    const e = current as PgErrorLike;
    if (e?.code && !out.dbCode) out.dbCode = e.code;
    if (e?.detail && !out.dbDetail) out.dbDetail = e.detail;
    if (e?.hint && !out.dbHint) out.dbHint = e.hint;
    if (e?.constraint && !out.dbConstraint) out.dbConstraint = e.constraint;
    if (e?.message && !out.causeMessage) out.causeMessage = e.message;

    const next = (current as { cause?: unknown }).cause;
    if (!next || next === current) break;
    current = next;
  }

  return out;
}

/** Structured error log for API handlers — safe for Coolify/production log drains. */
export function logEndpointError(
  endpoint: string,
  req: Request,
  err: unknown,
  extra?: Record<string, unknown>,
): void {
  const error = asError(err);
  const db = extractDbFields(err);
  const tenantId =
    (req as { tenantId?: string }).tenantId ??
    (req.headers["x-tenant-id"] as string | undefined) ??
    null;
  const userId = (req as { userId?: string }).userId ?? null;

  logger.error(
    {
      endpoint,
      message: error.message,
      stack: error.stack,
      ...db,
      tenantId,
      userId,
      requestId: (req as { requestId?: string }).requestId,
      method: req.method,
      path: req.originalUrl?.split("?")[0] ?? req.path,
      ...extra,
    },
    `[${endpoint}] ${error.message}`,
  );
}
