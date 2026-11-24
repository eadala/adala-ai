/**
 * Core In-Memory TTL Cache
 * ─────────────────────────────────────────────────────────────────
 * Map-backed cache with:
 *   - Per-entry TTL (auto-expire on read + periodic sweep)
 *   - MAX_ENTRIES cap with LRU-lite eviction (expired first, then oldest)
 *   - flushTenant(tenantId) — removes all keys scoped to a tenant
 *   - clear() — full wipe for emergency reset
 *   - stats() — live size + key list for monitoring
 *
 * Usage:
 *   cache.set("dashboard:summary:officeId", value, 60);
 *   const v = cache.get<MyType>("dashboard:summary:officeId");
 *   cache.del("dashboard:summary:officeId");
 *   cache.flushTenant("officeId");   // removes all keys containing that id
 *   cache.flush("ai:");              // prefix-based flush
 *   cache.clear();                   // full reset
 */

const MAX_ENTRIES = 500;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;   // Unix ms
  insertedAt: number;  // Unix ms — used for LRU-lite eviction
}

class InMemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();

  constructor(sweepIntervalMs = 60_000) {
    const sweep = () => {
      const now = Date.now();
      for (const [k, v] of this.store) {
        if (v.expiresAt <= now) this.store.delete(k);
      }
    };
    setInterval(sweep, sweepIntervalMs).unref();
  }

  /** Evict when over MAX_ENTRIES: expired first, then oldest 10% */
  private _evict(): void {
    if (this.store.size < MAX_ENTRIES) return;
    const now = Date.now();
    // Pass 1: remove expired
    for (const [k, v] of this.store) {
      if (v.expiresAt <= now) this.store.delete(k);
    }
    if (this.store.size < MAX_ENTRIES) return;
    // Pass 2: remove oldest 10%
    const evictCount = Math.ceil(MAX_ENTRIES * 0.1);
    const sorted = [...this.store.entries()].sort((a, b) => a[1].insertedAt - b[1].insertedAt);
    for (let i = 0; i < evictCount && i < sorted.length; i++) {
      this.store.delete(sorted[i][0]);
    }
  }

  /** Store a value with TTL in seconds (default 5 min) */
  set<T>(key: string, value: T, ttlSeconds = 300): void {
    this._evict();
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
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

  /**
   * Delete all keys that CONTAIN tenantId anywhere in the key.
   * Covers patterns like "dashboard:summary:tenantId",
   * "ai:hash:tenantId", "tenantId:something".
   */
  flushTenant(tenantId: string): void {
    if (!tenantId) return;
    for (const k of this.store.keys()) {
      if (k.includes(tenantId)) this.store.delete(k);
    }
  }

  /** Full cache wipe — for emergency reset or admin action */
  clear(): void {
    this.store.clear();
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
  stats(): { size: number; maxEntries: number; keys: string[] } {
    const now = Date.now();
    const keys: string[] = [];
    for (const [k, v] of this.store) {
      if (v.expiresAt > now) keys.push(k);
    }
    return { size: keys.length, maxEntries: MAX_ENTRIES, keys };
  }
}

export const cache = new InMemoryCache();
