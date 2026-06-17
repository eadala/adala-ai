/**
 * Core In-Memory TTL Cache
 * ─────────────────────────────────────────────────────────────────
 * Simple, zero-dependency, Map-backed cache with per-entry TTL.
 * Redis-ready: swap the backing store without changing call sites.
 *
 * Limits:
 *   MAX_SIZE = 500 entries — when exceeded, evicts expired entries
 *   first, then oldest entries (LRU-lite)
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // Unix ms
  insertedAt: number; // Unix ms — for LRU eviction
}

const MAX_SIZE = 500; // حد أقصى لعدد المدخلات في الـ cache

class InMemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private sweepIntervalMs: number;

  constructor(sweepIntervalMs = 30_000) {
    this.sweepIntervalMs = sweepIntervalMs;
    const sweep = () => {
      const now = Date.now();
      for (const [k, v] of this.store) {
        if (v.expiresAt <= now) this.store.delete(k);
      }
    };
    setInterval(sweep, this.sweepIntervalMs).unref();
  }

  /** Store a value with TTL in seconds (default 5 min) */
  set<T>(key: string, value: T, ttlSeconds = 300): void {
    /* إذا الـ cache ممتلئ، نحذف أولاً المنتهية ثم الأقدم */
    if (this.store.size >= MAX_SIZE && !this.store.has(key)) {
      this._evict();
    }
    this.store.set(key, {
      value,
      expiresAt:  Date.now() + ttlSeconds * 1000,
      insertedAt: Date.now(),
    });
  }

  /** Retrieve value; returns undefined if missing or expired */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /** Delete a specific key */
  del(key: string): void {
    this.store.delete(key);
  }

  /** Delete all keys that start with prefix */
  flush(prefix: string): void {
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) this.store.delete(k);
    }
  }

  /** Check if key exists and is not expired */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /** Current live entry count */
  size(): number {
    const now = Date.now();
    let count = 0;
    for (const v of this.store.values()) {
      if (v.expiresAt > now) count++;
    }
    return count;
  }

  /** Stats for monitoring */
  stats(): { size: number; keys: string[]; maxSize: number } {
    const now = Date.now();
    const keys: string[] = [];
    for (const [k, v] of this.store) {
      if (v.expiresAt > now) keys.push(k);
    }
    return { size: keys.length, keys, maxSize: MAX_SIZE };
  }

  /**
   * Eviction: حذف المنتهية أولاً — ثم الأقدم insertedAt
   * يُشغَّل فقط عند امتلاء الـ cache
   */
  private _evict(): void {
    const now = Date.now();

    /* 1. حذف المنتهية */
    for (const [k, v] of this.store) {
      if (v.expiresAt <= now) this.store.delete(k);
    }

    /* 2. إذا لا يزال ممتلئاً → احذف الأقدم 10% */
    if (this.store.size >= MAX_SIZE) {
      const entries = [...this.store.entries()]
        .sort((a, b) => a[1].insertedAt - b[1].insertedAt);
      const toRemove = Math.ceil(MAX_SIZE * 0.1);
      for (let i = 0; i < toRemove && i < entries.length; i++) {
        this.store.delete(entries[i][0]);
      }
    }
  }
}

export const cache = new InMemoryCache();
