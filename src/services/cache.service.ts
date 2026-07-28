import {
  redisGet,
  redisSet,
  redisDel,
  redisGetOrSet,
  redisDeleteByPattern,
} from '../utils/redis.helper.js';
import logger from '../config/logger.js';
import { CACHE_TTL } from '../constants/cacheKeys.js';

export class CacheService {
  async get(key) {
    return redisGet(this.#k(key));
  }

  async set(key, value, ttlSeconds = CACHE_TTL.MEDIUM) {
    return redisSet(this.#k(key), value, ttlSeconds);
  }

  async del(key) {
    return redisDel(this.#k(key));
  }

  /**
   * @template T
   * @param {string} key
   * @param {() => Promise<T>} factory
   * @param {number} [ttlSeconds]
   * @returns {Promise<T>}
   */
  async getOrSet(key, factory, ttlSeconds = CACHE_TTL.MEDIUM) {
    try {
      return await redisGetOrSet(this.#k(key), factory, ttlSeconds);
    } catch (err) {
      logger.warn('Cache getOrSet failed, computing without cache', {
        key,
        message: err.message,
      });
      return factory();
    }
  }

  async invalidatePattern(pattern) {
    return redisDeleteByPattern(this.#k(pattern));
  }

  async invalidate(...keys) {
    if (!keys.length) return 0;
    return redisDel(...keys.map((k) => this.#k(k)));
  }

  #k(key) {
    if (key.startsWith('cache:')) return key;
    return `cache:${key}`;
  }
}

export default CacheService;
