import type { Redis } from 'ioredis';
import { getRedisClient, isRedisReady } from '../config/redis.js';
import logger from '../config/logger.js';

function clientOrNull(): Redis | null {
  try {
    const client = getRedisClient();
    if (!client || !isRedisReady()) return null;
    return client;
  } catch {
    return null;
  }
}

/**
 * Get a value from Redis (JSON-parsed when possible).
 */
export async function redisGet(key: string): Promise<unknown | null> {
  const client = clientOrNull();
  if (!client) return null;

  try {
    const value = await client.get(key);
    if (value === null || value === undefined) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.debug('redisGet failed', { key, message });
    return null;
  }
}

/**
 * Set a value in Redis with optional TTL (seconds).
 */
export async function redisSet(
  key: string,
  value: unknown,
  ttlSeconds?: number,
): Promise<'OK' | null> {
  const client = clientOrNull();
  if (!client) return null;

  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      return client.set(key, serialized, 'EX', ttlSeconds);
    }
    return client.set(key, serialized);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.debug('redisSet failed', { key, message });
    return null;
  }
}

/**
 * Set only if key does not exist (NX) with TTL.
 */
export async function redisSetNx(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<boolean> {
  const client = clientOrNull();
  if (!client) return false;

  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    const result = await client.set(key, serialized, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.debug('redisSetNx failed', { key, message });
    return false;
  }
}

/**
 * Delete one or more keys.
 */
export async function redisDel(...keys: string[]): Promise<number> {
  if (!keys.length) return 0;
  const client = clientOrNull();
  if (!client) return 0;

  try {
    return await client.del(...keys);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.debug('redisDel failed', { message });
    return 0;
  }
}

/**
 * Get remaining TTL in seconds (-1 no expiry, -2 missing).
 */
export async function redisTtl(key: string): Promise<number> {
  const client = clientOrNull();
  if (!client) return -2;

  try {
    return await client.ttl(key);
  } catch {
    return -2;
  }
}

/**
 * Check whether a key exists.
 */
export async function redisExists(key: string): Promise<boolean> {
  const client = clientOrNull();
  if (!client) return false;

  try {
    const result = await client.exists(key);
    return result === 1;
  } catch {
    return false;
  }
}

/**
 * Increment a counter; optionally set TTL on first increment.
 */
export async function redisIncr(key: string, ttlSeconds?: number): Promise<number> {
  const client = clientOrNull();
  if (!client) return 0;

  try {
    const value = await client.incr(key);
    if (value === 1 && ttlSeconds && ttlSeconds > 0) {
      await client.expire(key, ttlSeconds);
    }
    return value;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.debug('redisIncr failed', { key, message });
    return 0;
  }
}

/**
 * Get-or-set cache pattern.
 */
export async function redisGetOrSet<T = unknown>(
  key: string,
  factory: () => Promise<T>,
  ttlSeconds: number,
): Promise<T> {
  const cached = await redisGet(key);
  if (cached !== null) return cached as T;

  const fresh = await factory();
  await redisSet(key, fresh, ttlSeconds);
  return fresh;
}

/**
 * Delete keys matching a pattern (SCAN-based, non-blocking).
 */
export async function redisDeleteByPattern(pattern: string): Promise<number> {
  const client = clientOrNull();
  if (!client) return 0;

  let cursor = '0';
  let deleted = 0;

  try {
    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length) {
        deleted += await client.del(...keys);
      }
    } while (cursor !== '0');

    logger.debug('Redis keys deleted by pattern', { pattern, deleted });
    return deleted;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.debug('redisDeleteByPattern failed', { pattern, message });
    return deleted;
  }
}

export default {
  redisGet,
  redisSet,
  redisSetNx,
  redisDel,
  redisTtl,
  redisExists,
  redisIncr,
  redisGetOrSet,
  redisDeleteByPattern,
};
