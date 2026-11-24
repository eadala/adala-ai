/**
 * Circuit Breaker — يوقف الطلبات لخدمة تفشل باستمرار
 * States: CLOSED (طبيعي) → OPEN (موقوف) → HALF_OPEN (اختبار)
 */

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CircuitConfig {
  failureThreshold: number;   // نسبة الفشل التي تفتح الدائرة (0.0–1.0)
  successThreshold: number;   // عدد النجاحات لإغلاق الدائرة من HALF_OPEN
  timeout: number;            // ms قبل الانتقال من OPEN إلى HALF_OPEN
  windowSize: number;         // عدد الطلبات في النافذة الزمنية
}

interface CircuitStats {
  name: string;
  state: CircuitState;
  failures: number;
  successes: number;
  total: number;
  failureRate: number;
  openedAt?: number;
  lastCheck: number;
}

const DEFAULT_CONFIG: CircuitConfig = {
  failureThreshold: 0.2,   // 20% فشل → فتح الدائرة
  successThreshold: 3,
  timeout: 30_000,          // 30 ثانية ثم HALF_OPEN
  windowSize: 20,
};

class CircuitBreaker {
  private circuits = new Map<string, {
    state: CircuitState;
    results: boolean[];      // true = نجاح, false = فشل
    halfOpenSuccesses: number;
    openedAt?: number;
    config: CircuitConfig;
  }>();

  private ensureCircuit(name: string, config?: Partial<CircuitConfig>) {
    if (!this.circuits.has(name)) {
      this.circuits.set(name, {
        state: "CLOSED",
        results: [],
        halfOpenSuccesses: 0,
        config: { ...DEFAULT_CONFIG, ...config },
      });
    }
    return this.circuits.get(name)!;
  }

  /** الحالة الحالية للدائرة */
  getState(name: string): CircuitState {
    const c = this.circuits.get(name);
    if (!c) return "CLOSED";
    /* تحقق من انتهاء timeout في OPEN */
    if (c.state === "OPEN" && c.openedAt && Date.now() - c.openedAt >= c.config.timeout) {
      c.state = "HALF_OPEN";
      c.halfOpenSuccesses = 0;
    }
    return c.state;
  }

  /** هل يُسمح بالطلب؟ */
  isAllowed(name: string, config?: Partial<CircuitConfig>): boolean {
    const c = this.ensureCircuit(name, config);
    const state = this.getState(name);
    if (state === "CLOSED") return true;
    if (state === "HALF_OPEN") return true;   // نختبر بطلب واحد
    return false; // OPEN — محجوب
  }

  /** سجّل نتيجة طلب */
  record(name: string, success: boolean, config?: Partial<CircuitConfig>) {
    const c = this.ensureCircuit(name, config);
    const state = this.getState(name);

    if (state === "HALF_OPEN") {
      if (success) {
        c.halfOpenSuccesses++;
        if (c.halfOpenSuccesses >= c.config.successThreshold) {
          c.state = "CLOSED";
          c.results = [];
          c.halfOpenSuccesses = 0;
        }
      } else {
        c.state = "OPEN";
        c.openedAt = Date.now();
      }
      return;
    }

    /* CLOSED — نضيف للنافذة الزمنية */
    c.results.push(success);
    if (c.results.length > c.config.windowSize) {
      c.results.shift();
    }

    if (c.results.length >= c.config.windowSize) {
      const failures = c.results.filter(r => !r).length;
      const rate = failures / c.results.length;
      if (rate >= c.config.failureThreshold) {
        c.state = "OPEN";
        c.openedAt = Date.now();
      }
    }
  }

  /** إحصائيات جميع الدوائر */
  getStats(): CircuitStats[] {
    return Array.from(this.circuits.entries()).map(([name, c]) => {
      const total = c.results.length;
      const failures = c.results.filter(r => !r).length;
      return {
        name,
        state: this.getState(name),
        failures,
        successes: total - failures,
        total,
        failureRate: total > 0 ? failures / total : 0,
        openedAt: c.openedAt,
        lastCheck: Date.now(),
      };
    });
  }

  /** إعادة ضبط دائرة (للاختبار أو التدخل اليدوي) */
  reset(name: string) {
    const c = this.circuits.get(name);
    if (c) {
      c.state = "CLOSED";
      c.results = [];
      c.halfOpenSuccesses = 0;
      c.openedAt = undefined;
    }
  }

  /** تطبيق circuit breaker على دالة async */
  async call<T>(
    name: string,
    fn: () => Promise<T>,
    fallback?: () => T | Promise<T>,
    config?: Partial<CircuitConfig>
  ): Promise<T> {
    if (!this.isAllowed(name, config)) {
      if (fallback) return fallback();
      throw new CircuitOpenError(name);
    }
    try {
      const result = await fn();
      this.record(name, true, config);
      return result;
    } catch (err) {
      this.record(name, false, config);
      if (fallback) return fallback();
      throw err;
    }
  }
}

export class CircuitOpenError extends Error {
  constructor(public readonly circuit: string) {
    super(`Circuit '${circuit}' is OPEN — requests blocked`);
    this.name = "CircuitOpenError";
  }
}

/* Singleton — يشترك فيه جميع أجزاء التطبيق */
export const circuitBreaker = new CircuitBreaker();

/* الدوائر المعرّفة مسبقاً */
export const CIRCUITS = {
  STRIPE:     "stripe",
  DATABASE:   "database",
  AI:         "ai",
  EMAIL:      "email",
  WEBHOOK:    "webhook",
} as const;
