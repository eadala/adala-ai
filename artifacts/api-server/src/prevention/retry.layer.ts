/**
 * Safe Retry Layer — إعادة ذكية بدون retry storms
 */

export interface RetryOptions {
  max: number;           // أقصى عدد محاولات
  backoff: boolean;      // تأخير تصاعدي؟
  baseDelay: number;     // ms — التأخير الأساسي
  maxDelay: number;      // ms — أقصى تأخير
  retryIf?: (err: unknown) => boolean; // شرط إعادة المحاولة
}

const DEFAULT_OPTIONS: RetryOptions = {
  max: 2,
  backoff: true,
  baseDelay: 500,
  maxDelay: 5000,
};

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calcDelay(attempt: number, opts: RetryOptions): number {
  if (!opts.backoff) return opts.baseDelay;
  /* exponential backoff: baseDelay * 2^attempt + jitter */
  const exp = opts.baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 100;
  return Math.min(exp + jitter, opts.maxDelay);
}

/** إعادة محاولة دالة async بأمان */
export async function retryWithLimit<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastErr: unknown;

  for (let attempt = 0; attempt <= opts.max; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;

      /* تحقق من شرط إعادة المحاولة */
      if (opts.retryIf && !opts.retryIf(err)) throw err;

      /* آخر محاولة — لا نُعيد */
      if (attempt === opts.max) break;

      const wait = calcDelay(attempt, opts);
      await delay(wait);
    }
  }

  throw lastErr;
}

/** Retry لـ Stripe webhooks فقط (max=2, backoff) */
export function retryWebhook<T>(fn: () => Promise<T>): Promise<T> {
  return retryWithLimit(fn, {
    max: 2,
    backoff: true,
    baseDelay: 1000,
    maxDelay: 8000,
    retryIf: (err: any) => {
      /* لا نُعيد على أخطاء منطقية */
      const code = err?.statusCode ?? err?.code ?? 0;
      return ![400, 401, 403, 404, 409, 422].includes(Number(code));
    },
  });
}

/** Retry لقاعدة البيانات */
export function retryDb<T>(fn: () => Promise<T>): Promise<T> {
  return retryWithLimit(fn, {
    max: 2,
    backoff: true,
    baseDelay: 300,
    maxDelay: 3000,
  });
}
