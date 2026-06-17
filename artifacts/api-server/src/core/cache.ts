/**
 * Core In-Memory TTL Cache
 * ─────────────────────────────────────────────────────────────────
 * Simple, zero-dependency, Map-backed cache with per-entry TTL.
 * Redis-ready: swap the backing store without changing call sites.
 *
 * Usage:
 *   import { cache } from "../core/cache";
 *   cache.set("key", value, 600);         // 600s TTL
 *   const v = cache.get<MyType>("key");   // undefined if expired
 *   cache.del("key");
 *   cache.flush("ai:");                   // flush all keys with prefix
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // Unix ms
}

class InMemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private sweepIntervalMs: number;

  constructor(sweepIntervalMs = 60_000) {
    this.sweepIntervalMs = sweepIntervalMs;
    // Periodic sweep to free memory of expired entries
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
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
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
  stats(): { size: number; keys: string[] } {
    const now = Date.now();
    const keys: string[] = [];
    for (const [k, v] of this.store) {
      if (v.expiresAt > now) keys.push(k);
    }
    return { size: keys.length, keys };
  }
}

export const cache = new InMemoryCache();
