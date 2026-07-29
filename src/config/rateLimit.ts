import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import env from './env.js';
import { getRedisClient, isRedisReady } from './redis.js';
import logger from './logger.js';

/**
 * Lazy Redis store: binds on first hit after Redis is ready; otherwise
 * express-rate-limit falls back to its built-in memory store when `store` is undefined.
 * We always provide a thin wrapper so multi-instance Redis kicks in once connected (BUG-010).
 */
function createStore(prefix) {
  let redisStore = null;
  let warned = false;

  const ensureRedisStore = () => {
    if (redisStore) return redisStore;
    if (!isRedisReady()) return null;
    const client = getRedisClient();
    if (!client) return null;
    try {
      redisStore = new RedisStore({
        prefix: `rl:${prefix}:`,
        // ioredis — cast for rate-limit-redis RedisReply typing
        sendCommand: ((...args: string[]) => (client as any).call(...args)) as (
          ...args: string[]
        ) => Promise<any>,
      });
      logger.info('Rate limiter Redis store ready', { prefix });
      return redisStore;
    } catch (err) {
      if (!warned) {
        warned = true;
        logger.warn('Rate limiter Redis store init failed — using memory', {
          prefix,
          message: err instanceof Error ? err.message : String(err),
        });
      }
      return null;
    }
  };

  return {
    async increment(key) {
      const store = ensureRedisStore();
      if (store) return store.increment(key);

      // In-memory fallback (single-instance). Same shape as express-rate-limit MemoryStore.
      if (!this._hits) this._hits = new Map();
      const windowMs = this.windowMs || env.RATE_LIMIT_WINDOW_MS;
      const now = Date.now();
      let entry = this._hits.get(key);
      if (!entry || entry.resetTime <= now) {
        entry = { totalHits: 0, resetTime: now + windowMs };
      }
      entry.totalHits += 1;
      this._hits.set(key, entry);
      return {
        totalHits: entry.totalHits,
        resetTime: new Date(entry.resetTime),
      };
    },
    async decrement(key) {
      const store = ensureRedisStore();
      if (store?.decrement) return store.decrement(key);
      const entry = this._hits?.get(key);
      if (entry) {
        entry.totalHits = Math.max(0, entry.totalHits - 1);
        this._hits.set(key, entry);
      }
    },
    async resetKey(key) {
      const store = ensureRedisStore();
      if (store?.resetKey) return store.resetKey(key);
      this._hits?.delete(key);
    },
    init(options) {
      this.windowMs = options?.windowMs || env.RATE_LIMIT_WINDOW_MS;
      const store = ensureRedisStore();
      if (store?.init) return store.init(options);
    },
  };
}

function rateLimitHandler(_req, res, _next, options) {
  res.status(options.statusCode).json({
    success: false,
    message: options.message?.message || options.message || 'Too many requests',
    errors: null,
    meta: null,
    data: null,
  });
}

export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: env.RATE_LIMIT_SKIP_SUCCESSFUL,
  message: { message: 'Too many requests from this IP, please try again later.' },
  handler: rateLimitHandler,
  store: createStore('global'),
  skip: () => env.NODE_ENV === 'test',
});

export const authRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_AUTH_WINDOW_MS,
  max: env.RATE_LIMIT_AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts, please try again later.' },
  handler: rateLimitHandler,
  store: createStore('auth'),
  skip: () => env.NODE_ENV === 'test',
});

export const uploadRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_UPLOAD_WINDOW_MS,
  max: env.RATE_LIMIT_UPLOAD_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Upload rate limit exceeded, please try again later.' },
  handler: rateLimitHandler,
  store: createStore('upload'),
  skip: () => env.NODE_ENV === 'test',
});

export function createRateLimiter({ windowMs, max, prefix = 'custom', message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: message || 'Too many requests' },
    handler: rateLimitHandler,
    store: createStore(prefix),
    skip: () => env.NODE_ENV === 'test',
  });
}

export const rateLimitConfig = Object.freeze({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  authWindowMs: env.RATE_LIMIT_AUTH_WINDOW_MS,
  authMax: env.RATE_LIMIT_AUTH_MAX,
  uploadWindowMs: env.RATE_LIMIT_UPLOAD_WINDOW_MS,
  uploadMax: env.RATE_LIMIT_UPLOAD_MAX,
  redisReady: () => isRedisReady(),
});

export default {
  globalRateLimiter,
  authRateLimiter,
  uploadRateLimiter,
  createRateLimiter,
  rateLimitConfig,
};
