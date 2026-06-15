import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

export interface AppErrorShape {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Global Express error handler.
 * Converts ANY thrown error (AppError, Zod, generic) into the unified format:
 *   { success: false, error: { code, message, details? } }
 *
 * Register LAST in app.ts after all routes:
 *   app.use(globalErrorHandler);
 */
export function globalErrorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = (req as any).requestId ?? "unknown";

  if (err.name === "ZodError") {
    res.status(422).json({
      success: false,
      error: {
        code:    "VALIDATION_ERROR",
        message: "بيانات الطلب غير صحيحة",
        fields:  err.errors?.map((e: any) => ({
          path:    e.path?.join("."),
          message: e.message,
        })),
      },
      requestId,
    });
    return;
  }

  const statusCode: number = err.statusCode ?? err.status ?? 500;
  const code:       string = err.code        ?? (statusCode === 404 ? "NOT_FOUND"
                                               : statusCode === 403 ? "FORBIDDEN"
                                               : statusCode === 401 ? "UNAUTHORIZED"
                                               : "INTERNAL_ERROR");
  const message: string = err.message ?? "حدث خطأ غير متوقع";

  if (statusCode >= 500) {
    logger.error({ err, requestId }, `[${code}] ${message}`);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(err.details !== undefined && { details: err.details }),
    },
    requestId,
  });
}
