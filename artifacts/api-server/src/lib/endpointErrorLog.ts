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
} {
  const e = err as PgErrorLike;
  return {
    dbCode: e?.code,
    dbDetail: e?.detail,
    dbHint: e?.hint,
    dbConstraint: e?.constraint,
  };
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
