// Redis client singleton. Caching is OPT-IN: if REDIS_URL is unset (or the
// client can't reach Redis), every cache operation degrades to a no-op /
// pass-through and the API keeps working against Postgres exactly like Phase 1.
//
// Upstash exposes a standard Redis endpoint over TLS (`rediss://...`); `ioredis`
// infers TLS from the scheme, so no extra TLS config is needed. Use the Upstash
// **Redis** connection string, not the REST one.
import Redis from 'ioredis';
import { config } from '../config/env.js';

let client = null;
let enabled = false;

if (config.redisUrl) {
  const redisUrl = String(config.redisUrl).trim();

  // Some users may paste the Upstash CLI snippet into REDIS_URL:
  //   "redis-cli --tls -u redis://default:<pass>@<host>:6379"
  // ioredis expects a pure Redis URL only, e.g. "rediss://...".
  const normalized = redisUrl.startsWith('redis-cli ')
    ? redisUrl.split('-u')[1]?.trim()
    : redisUrl;

  if (!normalized) {
    console.error('[redis] Invalid REDIS_URL format; caching disabled.');
  } else {
    client = new Redis(normalized, {
      // Fail fast when Redis is unreachable, so cachedGet falls back to Postgres.
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy(times) {
        // back off: 200ms, 400ms, ... capped at 2s
        return Math.min(times * 200, 2000);
      },
    });

    client.on('error', (err) => console.error(`[redis] error: ${err.message}`));
    client.on('connect', () => console.log('[redis] connected'));
    client.on('ready', () => console.log('[redis] ready'));
    client.on('reconnecting', (delay) => console.log(`[redis] reconnecting in ${delay}ms`));

    enabled = true;
  }
} else {
  console.log('[redis] REDIS_URL not set — caching disabled (pass-through to Postgres).');
}

export const redis = client;
export const redisEnabled = enabled;

export async function disconnectRedis() {
  if (client) {
    try {
      await client.quit();
    } catch {
      /* best-effort on shutdown */
    }
  }
}

