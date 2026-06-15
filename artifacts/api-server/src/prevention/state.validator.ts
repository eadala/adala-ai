/**
 * State Validation Layer — يمنع العمليات على حالات غير صالحة
 */

export class StateValidationError extends Error {
  public readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "StateValidationError";
    this.code = code;
  }
}

/* ── القضايا ── */
export const CaseValidator = {
  /** يمنع تعديل قضية مغلقة */
  assertNotClosed(caseStatus: string | null | undefined): void {
    if (caseStatus === "closed" || caseStatus === "مغلقة") {
      throw new StateValidationError(
        "لا يمكن تعديل قضية مغلقة",
        "CLOSED_CASE_MUTATION"
      );
    }
  },

  /** يمنع إضافة وثيقة لقضية غير موجودة */
  assertExists(caseId: string | null | undefined): void {
    if (!caseId || caseId === "undefined" || caseId === "null") {
      throw new StateValidationError(
        "معرف القضية غير صالح",
        "INVALID_CASE_ID"
      );
    }
  },

  /** يتحقق من صحة الانتقال بين الحالات */
  assertValidTransition(from: string, to: string): void {
    const ALLOWED: Record<string, string[]> = {
      open:       ["in_progress", "pending", "closed"],
      in_progress: ["open", "pending", "closed"],
      pending:    ["open", "in_progress", "closed"],
      closed:     [], // لا يُسمح بالانتقال من مغلقة
    };
    const allowed = ALLOWED[from] ?? [];
    if (!allowed.includes(to)) {
      throw new StateValidationError(
        `انتقال غير مسموح: من '${from}' إلى '${to}'`,
        "INVALID_STATE_TRANSITION"
      );
    }
  },
};

/* ── الفواتير والمدفوعات ── */
export const PaymentValidator = {
  /** يمنع الدفع إذا كان مفتاح Stripe مفقوداً */
  assertStripeAvailable(): void {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new StateValidationError(
        "تدفق الدفع موقوف — إعدادات Stripe ناقصة",
        "STRIPE_NOT_CONFIGURED"
      );
    }
  },

  /** يمنع دفع فاتورة مدفوعة مسبقاً */
  assertNotAlreadyPaid(status: string): void {
    if (status === "paid") {
      throw new StateValidationError(
        "هذه الفاتورة مدفوعة بالفعل",
        "INVOICE_ALREADY_PAID"
      );
    }
  },

  /** يمنع مبالغ غير صالحة */
  assertValidAmount(amount: number): void {
    if (!amount || isNaN(amount) || amount <= 0) {
      throw new StateValidationError(
        "المبلغ غير صالح",
        "INVALID_AMOUNT"
      );
    }
  },
};

/* ── Stripe Webhooks ── */
export const WebhookValidator = {
  /** يمنع معالجة Payload فارغ */
  assertNotEmpty(payload: any): void {
    if (!payload || typeof payload !== "object") {
      throw new StateValidationError(
        "Webhook payload فارغ أو غير صالح",
        "EMPTY_WEBHOOK_PAYLOAD"
      );
    }
  },

  /** يمنع أنواع أحداث غير معروفة */
  assertKnownEventType(type: string, known: string[]): void {
    if (!known.includes(type)) {
      throw new StateValidationError(
        `نوع حدث غير معروف: '${type}'`,
        "UNKNOWN_EVENT_TYPE"
      );
    }
  },
};

/* ── العملاء والمستخدمون ── */
export const EntityValidator = {
  /** يمنع UUID غير صالح */
  assertValidUUID(id: string, field = "id"): void {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!id || !UUID_RE.test(id)) {
      throw new StateValidationError(
        `قيمة ${field} غير صالحة`,
        "INVALID_UUID"
      );
    }
  },

  /** يمنع القيم الفارغة في الحقول المطلوبة */
  assertRequired(value: any, field: string): void {
    if (value === null || value === undefined || value === "") {
      throw new StateValidationError(
        `الحقل '${field}' مطلوب`,
        "REQUIRED_FIELD_MISSING"
      );
    }
  },
};
