export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 400,
    public code: string = "APP_ERROR",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "المورد") {
    super(`${resource} غير موجود`, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(msg = "غير مصرح") {
    super(msg, 401, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(msg = "ممنوع الوصول") {
    super(msg, 403, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

export class ValidationError extends AppError {
  constructor(msg: string) {
    super(msg, 422, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}
