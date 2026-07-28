/**
 * HTTP-layer Redis cache key builders (route response caching).
 * Distinct from domain CACHE_KEYS in constants/cacheKeys.js.
 */

export const HTTP_CACHE_KEYS = Object.freeze({
  /** Full response cache for a GET route. */
  ROUTE: (method, path, queryHash = '') =>
    `http:cache:${method.toUpperCase()}:${path}${queryHash ? `:${queryHash}` : ''}`,

  /** User-scoped route cache. */
  USER_ROUTE: (userId, method, path, queryHash = '') =>
    `http:cache:user:${userId}:${method.toUpperCase()}:${path}${queryHash ? `:${queryHash}` : ''}`,

  /** Pattern to invalidate all HTTP caches for a resource prefix. */
  PATTERN: (prefix) => `http:cache:*${prefix}*`,

  /** Users list / profile patterns. */
  USERS: 'http:cache:*users*',
  ROLES: 'http:cache:*roles*',
  PERMISSIONS: 'http:cache:*permissions*',
});

export const HTTP_CACHE_TTL = Object.freeze({
  SHORT: 30,
  DEFAULT: 60,
  MEDIUM: 300,
  LONG: 900,
});

export default HTTP_CACHE_KEYS;
