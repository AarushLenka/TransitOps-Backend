// Read-through caching built on the opt-in Redis singleton in lib/redis.js.
//
// When Redis is off (REDIS_URL unset) or a command fails, every helper here
// degrades to a no-op / pass-through: cachedGet just runs the loader, the
// invalidators do nothing, and the API behaves exactly as it does without
// caching (pure Postgres). So caching is always safe to ship.
//
// Design notes:
//  - Services stay pure (DB only). Controllers own the cache: they read via
//    cachedGet and bust via the invalidate* helpers after a successful write.
//  - We cache reads whose invalidation surface is bounded (dashboard counts,
//    report aggregates, vehicles/drivers rows). We deliberately do NOT cache
//    trips/maintenance/fuel/expenses reads — those payloads `include` mutable
//    related entities, so any status flip would stale-date them and force
//    near-total invalidation. See README "Caching" for the full contract.
import { redis, redisEnabled } from './redis.js';
import { config } from '../config/env.js';

const NS = 'transitops';

// TTLs (seconds). Writes bust the relevant namespace eagerly, so these are a
// self-healing safety net more than the primary freshness mechanism — keep them
// long enough to absorb a read spike but short enough that a missed invalidation
// corrects itself soon.
export const TTL = {
  dashboard: 60, // KPIs flip on every trip / maintenance / vehicle change
  reports: 300, // heavy per-vehicle aggregates; change only when source tables do
  vehicles: 120,
  drivers: 120,
};

// Canonical cache keys. Query filters are already coerced upstream by Zod, so the
// input here is a small predictable object. Sort parts so the same logical query
// always maps to the same key regardless of property order.
export const KEYS = {
  dashboard: (q = {}) => `${NS}:dashboard:${parts(q, ['type', 'region'])}`,
  reports: (name) => `${NS}:reports:${name}`,
  vehiclesList: (q = {}) => `${NS}:vehicles:list:${parts(q, ['status', 'type', 'region'])}`,
  vehicle: (id) => `${NS}:vehicles:id:${id}`,
  driversList: (q = {}) => `${NS}:drivers:list:${parts(q, ['status'])}`,
  driver: (id) => `${NS}:drivers:id:${id}`,
};

// Glob patterns for namespace-wide invalidation (SCAN, never KEYS).
export const PATTERNS = {
  dashboard: `${NS}:dashboard:*`,
  reports: `${NS}:reports:*`,
  vehicles: `${NS}:vehicles:*`,
  drivers: `${NS}:drivers:*`,
};

function parts(obj, fields) {
  return fields.map((f) => (obj[f] == null ? '' : obj[f])).join(':');
}

// Read-through: return cached JSON on hit, else run `loader`, store the result,
// return it. Redis errors never escape — on any failure we fall through to the
// loader and simply skip the write. The loader's own errors DO propagate (so a
// 404 from getById isn't cached or swallowed).
export async function cachedGet(key, loader, ttlSeconds) {
  if (redisEnabled) {
    try {
      const raw = await redis.get(key);
      if (raw != null) {
        debug(`HIT  ${key}`);
        return JSON.parse(raw);
      }
      debug(`MISS ${key}`);
    } catch (err) {
      console.error(`[cache] GET failed for ${key}: ${err.message}`);
    }
  }
  const value = await loader();
  if (redisEnabled && value != null) {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      console.error(`[cache] SET failed for ${key}: ${err.message}`);
    }
  }
  return value;
}

// Delete a single key. No-op when caching is off; never throws.
export async function invalidateKey(key) {
  if (!redisEnabled) return;
  try {
    await redis.del(key);
  } catch (err) {
    console.error(`[cache] DEL failed for ${key}: ${err.message}`);
  }
}

// Delete every key matching each glob `pattern`. Uses SCAN (not KEYS) so it
// never blocks the shared Upstash instance. Best-effort: errors are logged and
// skipped, leaving any remaining keys to expire by TTL.
export async function invalidatePatterns(patterns) {
  if (!redisEnabled) return;
  for (const pattern of patterns) {
    try {
      let cursor = '0';
      do {
        const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
        cursor = next;
        if (keys.length) await redis.del(...keys);
      } while (cursor !== '0');
    } catch (err) {
      console.error(`[cache] invalidate "${pattern}" failed: ${err.message}`);
    }
  }
}

// ---- Domain invalidators: the single source of truth for the write -> bust map
// (which writes invalidate which namespaces). Controllers call these, not the
// raw pattern helpers, so the contract lives in one place. ----

// Dashboard counts + every report aggregate. Bust when vehicles, drivers,
// trips, maintenance, fuel or expenses change — all of them feed at least one
// dashboard count or report aggregate.
export const invalidateAnalytics = () => invalidatePatterns([PATTERNS.dashboard, PATTERNS.reports]);

// Vehicle rows (list + detail). Bust when a vehicle is written, or when a trip /
// maintenance transition flips a vehicle's status (AVAILABLE <-> ON_TRIP / IN_SHOP).
export const invalidateVehicles = () => invalidatePatterns([PATTERNS.vehicles]);

// Driver rows (list + detail). Bust when a driver is written, or when a trip
// dispatch / complete / cancel flips a driver's status (AVAILABLE <-> ON_TRIP).
export const invalidateDrivers = () => invalidatePatterns([PATTERNS.drivers]);

function debug(msg) {
  if (config.cacheDebug) console.debug(`[cache] ${msg}`);
}
