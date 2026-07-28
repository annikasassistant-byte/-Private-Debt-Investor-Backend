import {
  globalRateLimiter,
  authRateLimiter,
  uploadRateLimiter,
  createRateLimiter,
} from '../config/rateLimit.js';
import env from '../config/env.js';

/**
 * Re-export configured limiters for route-level use.
 */
export const generalLimiter = globalRateLimiter;
export const authLimiter = authRateLimiter;
export const uploadLimiter = uploadRateLimiter;

/**
 * Sensitive operations (password change, delete account, etc.).
 */
export const sensitiveLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_AUTH_WINDOW_MS,
  max: Math.max(5, Math.floor(env.RATE_LIMIT_AUTH_MAX / 2)),
  prefix: 'sensitive',
  message: 'Too many sensitive requests, please try again later.',
});

export {
  globalRateLimiter,
  authRateLimiter,
  uploadRateLimiter,
  createRateLimiter,
};

export default {
  generalLimiter,
  authLimiter,
  uploadLimiter,
  sensitiveLimiter,
  globalRateLimiter,
  authRateLimiter,
  uploadRateLimiter,
  createRateLimiter,
};
