import { randomUUID } from "crypto";
import type { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      correlationId: string;
    }
  }
}

/**
 * Attaches a UUID request_id to every request.
 * Honours X-Request-Id / X-Correlation-Id from the caller if present.
 * Sets both values on the response headers so clients can trace end-to-end.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingReqId  = req.headers["x-request-id"]     as string | undefined;
  const incomingCorrId = req.headers["x-correlation-id"]  as string | undefined;

  req.requestId     = incomingReqId  ?? randomUUID();
  req.correlationId = incomingCorrId ?? req.requestId;

  res.setHeader("X-Request-Id",    req.requestId);
  res.setHeader("X-Correlation-Id", req.correlationId);

  next();
}
