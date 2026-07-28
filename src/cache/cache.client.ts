import crypto from 'node:crypto';
import {
  redisGet,
  redisSet,
  redisDel,
  redisExists,
  redisGetOrSet,
  redisDeleteByPattern,
} from '../utils/redis.helper.js';
import logger from '../config/logger.js';
import { isRedisReady } from '../config/redis.js';
import { HTTP_CACHE_KEYS, HTTP_CACHE_TTL } from './keys.js';

/**
 * Thin HTTP-cache client wrapping Redis helpers.
 */
export class CacheClient {
  /**
   * @param {string} key
   * @returns {Promise<unknown|null>}
   */
  async get(key) {
    if (!isRedisReady()) return null;
    try {
      return await redisGet(key);
    } catch (err) {
      logger.warn('CacheClient.get failed', { key, message: err.message });
      return null;
    }
  }

  /**
   * @param {string} key
   * @param {unknown} value
   * @param {number} [ttlSeconds]
   */
  async set(key, value, ttlSeconds = HTTP_CACHE_TTL.DEFAULT) {
    if (!isRedisReady()) return null;
    try {
      return await redisSet(key, value, ttlSeconds);
    } catch (err) {
      logger.warn('CacheClient.set failed', { key, message: err.message });
      return null;
    }
  }

  /**
   * @param {...string} keys
   */
  async del(...keys) {
    if (!keys.length || !isRedisReady()) return 0;
    try {
      return await redisDel(...keys);
    } catch (err) {
      logger.warn('CacheClient.del failed', { message: err.message });
      return 0;
    }
  }

  /**
   * @param {string} key
   */
  async exists(key) {
    if (!isRedisReady()) return false;
    try {
      return await redisExists(key);
    } catch {
      return false;
    }
  }

  /**
   * @template T
   * @param {string} key
   * @param {() => Promise<T>} factory
   * @param {number} [ttlSeconds]
   * @returns {Promise<T>}
   */
  async getOrSet(key, factory, ttlSeconds = HTTP_CACHE_TTL.DEFAULT) {
    if (!isRedisReady()) return factory();
    try {
      return await redisGetOrSet(key, factory, ttlSeconds);
    } catch (err) {
      logger.warn('CacheClient.getOrSet failed', { key, message: err.message });
      return factory();
    }
  }

  /**
   * @param {string} pattern
   */
  async invalidatePattern(pattern) {
    if (!isRedisReady()) return 0;
    try {
      return await redisDeleteByPattern(pattern);
    } catch (err) {
      logger.warn('CacheClient.invalidatePattern failed', { pattern, message: err.message });
      return 0;
    }
  }

  /**
   * Build a stable hash for query objects.
   * @param {Record<string, unknown>} [query]
   * @returns {string}
   */
  hashQuery(query = {}) {
    const sorted = Object.keys(query)
      .sort()
      .reduce((acc, key) => {
        acc[key] = query[key];
        return acc;
      }, {});
    return crypto.createHash('sha1').update(JSON.stringify(sorted)).digest('hex').slice(0, 16);
  }

  /**
   * Build a route cache key from request parts.
   * @param {{ method: string, path: string, query?: object, userId?: string }} opts
   */
  buildRouteKey({ method, path, query, userId }) {
    const queryHash = query && Object.keys(query).length ? this.hashQuery(query) : '';
    if (userId) {
      return HTTP_CACHE_KEYS.USER_ROUTE(userId, method, path, queryHash);
    }
    return HTTP_CACHE_KEYS.ROUTE(method, path, queryHash);
  }
}

export const cacheClient = new CacheClient();

export { HTTP_CACHE_KEYS, HTTP_CACHE_TTL };

export default cacheClient;
