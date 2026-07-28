import type { RedisOptions } from 'ioredis';
import env from './env.js';

/**
 * Password / TLS are embedded in REDIS_URL (redis:// or rediss://).
 */
export function isRedisTlsUrl(url: string = env.REDIS_URL): boolean {
  return String(url || '').startsWith('rediss://');
}

/**
 * Shared ioredis options — URL-only auth (no REDIS_PASSWORD).
 */
export function buildRedisOptions(overrides: RedisOptions = {}): RedisOptions {
  const options: RedisOptions = {
    keyPrefix: env.REDIS_KEY_PREFIX,
    connectTimeout: env.REDIS_CONNECT_TIMEOUT_MS,
    enableOfflineQueue: env.REDIS_ENABLE_OFFLINE_QUEUE,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    showFriendlyErrorStack: env.NODE_ENV !== 'production',
    ...overrides,
  };

  if (isRedisTlsUrl()) {
    options.tls = {
      rejectUnauthorized: env.NODE_ENV === 'production',
    };
  }

  return options;
}

export default { isRedisTlsUrl, buildRedisOptions };
