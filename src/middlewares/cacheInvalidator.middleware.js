import { cacheClient, HTTP_CACHE_KEYS } from '../cache/cache.client.js';
import logger from '../config/logger.js';

/**
 * Invalidate HTTP Redis caches after mutating requests.
 *
 * @param {string|string[]|((req) => string|string[])} patterns - glob-style patterns or builder
 * @returns {import('express').RequestHandler}
 */
export function cacheInvalidator(patterns = []) {
  return async (req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode < 200 || res.statusCode >= 300) return;

      Promise.resolve()
        .then(async () => {
          const resolved =
            typeof patterns === 'function' ? patterns(req) : patterns;
          const list = (Array.isArray(resolved) ? resolved : [resolved]).filter(Boolean);

          for (const pattern of list) {
            await cacheClient.invalidatePattern(pattern);
          }
        })
        .catch((err) => {
          logger.warn('cacheInvalidator failed', { message: err.message });
        });
    });

    next();
  };
}

/** Convenience presets. */
export const invalidateUsersCache = cacheInvalidator([HTTP_CACHE_KEYS.USERS, 'cache:users:*', 'cache:user:*']);
export const invalidateRolesCache = cacheInvalidator([HTTP_CACHE_KEYS.ROLES, 'cache:roles:*']);
export const invalidatePermissionsCache = cacheInvalidator([
  HTTP_CACHE_KEYS.PERMISSIONS,
  'cache:permissions:*',
]);

export const cacheInvalidatorMiddleware = cacheInvalidator;
export default cacheInvalidator;
