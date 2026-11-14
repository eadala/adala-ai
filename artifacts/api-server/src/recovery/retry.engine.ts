export async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Full jitter: delay ∈ [0, base] then exponential growth capped. */
function nextDelay(base: number, attempt: number, cap = 30_000): number {
  const exp = Math.min(cap, base * Math.pow(2, attempt));
  return Math.floor(Math.random() * exp);
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number;
    initialDelay?: number;
    label?: string;
    /** When false, skip retry (caller asserts non-idempotent). Default true. */
    idempotent?: boolean;
  } = {}
): Promise<T> {
  const { retries = 3, initialDelay = 1000, label = "operation", idempotent = true } = options;
  if (!idempotent) {
    return fn();
  }

  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: unknown) {
      if (i === retries - 1) throw err;
      const delay = nextDelay(initialDelay, i);
      console.warn(`[RetryEngine] ${label} failed (attempt ${i + 1}/${retries}), retrying in ${delay}ms…`);
      await sleep(delay);
    }
  }
  throw new Error(`[RetryEngine] Max retries exceeded for "${label}"`);
}

export async function withTimeout<T>(fn: () => Promise<T>, ms: number, label = "op"): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`[Timeout] ${label} exceeded ${ms}ms`)), ms)
    ),
  ]);
}
