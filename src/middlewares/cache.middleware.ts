import { cacheClient, HTTP_CACHE_TTL } from '../cache/cache.client.js';
import logger from '../config/logger.js';

/**
 * Redis GET response cache for GET routes.
 *
 * @param {{ ttl?: number, keyPrefix?: string, userScoped?: boolean, skip?: (req) => boolean }} [options]
 * @returns {import('express').RequestHandler}
 */
export function cacheMiddleware(options = {}) {
  const {
    ttl = HTTP_CACHE_TTL.DEFAULT,
    keyPrefix = '',
    userScoped = false,
    skip = null,
  } = options;

  return async (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }

    if (typeof skip === 'function' && skip(req)) {
      return next();
    }

    const path = `${keyPrefix}${req.baseUrl || ''}${req.path}`;
    const userId = userScoped ? String(req.user?._id || req.user?.id || '') : undefined;
    const cacheKey = cacheClient.buildRouteKey({
      method: req.method,
      path,
      query: req.query,
      userId: userId || undefined,
    });

    try {
      const cached = await cacheClient.get(cacheKey);
      if (cached && typeof cached === 'object' && cached.body !== undefined) {
        res.setHeader('X-Cache', 'HIT');
        if (cached.headers) {
          for (const [k, v] of Object.entries(cached.headers)) {
            res.setHeader(k, v);
          }
        }
        return res.status(cached.statusCode || 200).json(cached.body);
      }
    } catch (err) {
      logger.warn('cacheMiddleware read failed', { message: err.message });
    }

    res.setHeader('X-Cache', 'MISS');
    const originalJson = res.json.bind(res);

    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheClient
          .set(
            cacheKey,
            {
              statusCode: res.statusCode,
              body,
              headers: {
                'Content-Type': 'application/json',
              },
            },
            ttl,
          )
          .catch((err) => logger.warn('cacheMiddleware write failed', { message: err.message }));
      }
      return originalJson(body);
    };

    return next();
  };
}

export default cacheMiddleware;
