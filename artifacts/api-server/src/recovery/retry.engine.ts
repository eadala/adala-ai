export async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: { retries?: number; initialDelay?: number; label?: string } = {}
): Promise<T> {
  const { retries = 3, initialDelay = 1000, label = "operation" } = options;
  let delay = initialDelay;

  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      if (i === retries - 1) throw err;
      console.warn(`[RetryEngine] ${label} failed (attempt ${i + 1}/${retries}), retrying in ${delay}ms…`);
      await sleep(delay);
      delay = Math.min(delay * 2, 30_000);
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
