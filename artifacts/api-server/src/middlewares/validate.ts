import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { ZodSchema } from "zod";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ZodError = { errors: { path: any[]; message: string }[] };

type Target = "body" | "query" | "params";

/**
 * Factory: returns an Express middleware that validates req[target] against
 * the given Zod schema.  On failure → 422 with unified VALIDATION_ERROR format.
 * On success → attaches parsed (coerced) data back to req[target] and calls next().
 */
export function validate(schema: ZodSchema, target: Target = "body"): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const ze = result.error as unknown as ZodError;
      res.status(422).json({
        success: false,
        error: {
          code:    "VALIDATION_ERROR",
          message: "بيانات الطلب غير صحيحة",
          fields:  ze.errors.map((e: any) => ({
            path:    e.path.join("."),
            message: e.message,
          })),
        },
      });
      return;
    }
    (req as any)[target] = result.data;
    next();
  };
}
