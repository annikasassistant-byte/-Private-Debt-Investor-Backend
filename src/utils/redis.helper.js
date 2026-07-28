import { getRedisClient, isRedisReady } from '../config/redis.js';
import logger from '../config/logger.js';

/**
 * @returns {import('ioredis').default | null}
 */
function clientOrNull() {
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
 * @param {string} key
 * @returns {Promise<unknown|null>}
 */
export async function redisGet(key) {
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
  } catch (error) {
    logger.debug('redisGet failed', { key, message: error.message });
    return null;
  }
}

/**
 * Set a value in Redis with optional TTL (seconds).
 * @param {string} key
 * @param {unknown} value
 * @param {number} [ttlSeconds]
 * @returns {Promise<'OK'|null>}
 */
export async function redisSet(key, value, ttlSeconds) {
  const client = clientOrNull();
  if (!client) return null;

  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      return client.set(key, serialized, 'EX', ttlSeconds);
    }
    return client.set(key, serialized);
  } catch (error) {
    logger.debug('redisSet failed', { key, message: error.message });
    return null;
  }
}

/**
 * Set only if key does not exist (NX) with TTL.
 * @param {string} key
 * @param {unknown} value
 * @param {number} ttlSeconds
 * @returns {Promise<boolean>}
 */
export async function redisSetNx(key, value, ttlSeconds) {
  const client = clientOrNull();
  if (!client) return false;

  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    const result = await client.set(key, serialized, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  } catch (error) {
    logger.debug('redisSetNx failed', { key, message: error.message });
    return false;
  }
}

/**
 * Delete one or more keys.
 * @param {...string} keys
 * @returns {Promise<number>}
 */
export async function redisDel(...keys) {
  if (!keys.length) return 0;
  const client = clientOrNull();
  if (!client) return 0;

  try {
    return await client.del(...keys);
  } catch (error) {
    logger.debug('redisDel failed', { message: error.message });
    return 0;
  }
}

/**
 * Get remaining TTL in seconds (-1 no expiry, -2 missing).
 * @param {string} key
 * @returns {Promise<number>}
 */
export async function redisTtl(key) {
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
 * @param {string} key
 * @returns {Promise<boolean>}
 */
export async function redisExists(key) {
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
 * @param {string} key
 * @param {number} [ttlSeconds]
 * @returns {Promise<number>}
 */
export async function redisIncr(key, ttlSeconds) {
  const client = clientOrNull();
  if (!client) return 0;

  try {
    const value = await client.incr(key);
    if (value === 1 && ttlSeconds && ttlSeconds > 0) {
      await client.expire(key, ttlSeconds);
    }
    return value;
  } catch (error) {
    logger.debug('redisIncr failed', { key, message: error.message });
    return 0;
  }
}

/**
 * Get-or-set cache pattern.
 * @param {string} key
 * @param {() => Promise<unknown>} factory
 * @param {number} ttlSeconds
 * @returns {Promise<unknown>}
 */
export async function redisGetOrSet(key, factory, ttlSeconds) {
  const cached = await redisGet(key);
  if (cached !== null) return cached;

  const fresh = await factory();
  await redisSet(key, fresh, ttlSeconds);
  return fresh;
}

/**
 * Delete keys matching a pattern (SCAN-based, non-blocking).
 * @param {string} pattern
 * @returns {Promise<number>}
 */
export async function redisDeleteByPattern(pattern) {
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
  } catch (error) {
    logger.debug('redisDeleteByPattern failed', { pattern, message: error.message });
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
