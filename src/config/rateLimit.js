import rateLimit from 'express-rate-limit';
import env from './env.js';
import { isRedisReady } from './redis.js';
import logger from './logger.js';

/**
 * Create a Redis-backed store lazily when Redis is ready; otherwise memory store.
 * Avoids opening Redis sockets at module import time.
 * @param {string} prefix
 * @returns {import('express-rate-limit').Store | undefined}
 */
function createStore(prefix) {
  // Use in-memory by default. Redis store can be swapped in after connect if needed.
  // Creating RedisStore at import time causes reconnect spam when Redis is offline.
  logger.debug('Rate limiter using in-memory store', { prefix });
  return undefined;
}

/**
 * Shared handler for rate-limit responses.
 * @param {import('express').Request} _req
 * @param {import('express').Response} res
 * @param {Function} _next
 * @param {Object} options
 */
function rateLimitHandler(_req, res, _next, options) {
  res.status(options.statusCode).json({
    success: false,
    message: options.message?.message || options.message || 'Too many requests',
    errors: null,
    meta: null,
    data: null,
  });
}

/**
 * Global API rate limiter.
 */
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

/**
 * Stricter limiter for auth endpoints (login, register, password reset).
 */
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

/**
 * Upload endpoint limiter.
 */
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

/**
 * Factory for custom rate limiters.
 * @param {{ windowMs: number, max: number, prefix?: string, message?: string }} options
 * @returns {import('express').RequestHandler}
 */
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
