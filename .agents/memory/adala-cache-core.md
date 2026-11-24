---
name: Adala Core Cache
description: In-memory TTL cache at src/core/cache.ts — usage and Redis migration path
---

## Location
`artifacts/api-server/src/core/cache.ts`

## API
```typescript
import { cache } from "../../core/cache";
cache.set("key", value, ttlSeconds);  // default 300s
cache.get<T>("key");                  // undefined if expired
cache.del("key");
cache.flush("prefix:");               // delete all keys with prefix
cache.has("key");
cache.stats();                        // { size, keys[] }
```

## Conventions
- Dashboard per-tenant: `dashboard:summary:<tenantId>` — 60s TTL
- AI responses: `ai:<sha256-16>` — 600s TTL (10 min)
- Auto-sweep runs every 60s (unref'd interval — doesn't block process exit)

**Why:** Redis-ready interface so switching to Redis later needs only a backing-store swap, no call-site changes.
