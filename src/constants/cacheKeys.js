/**
 * Centralized Redis / cache key builders.
 * Keys are relative — Redis client already applies REDIS_KEY_PREFIX.
 */
export const CACHE_KEYS = Object.freeze({
  USER: (userId) => `user:${userId}`,
  USER_SESSION: (userId, sessionId) => `session:${userId}:${sessionId}`,
  USER_SESSIONS: (userId) => `sessions:${userId}`,
  REFRESH_TOKEN: (tokenId) => `refresh:${tokenId}`,
  ACCESS_BLACKLIST: (jti) => `blacklist:access:${jti}`,
  PASSWORD_RESET: (tokenHash) => `pwdreset:${tokenHash}`,
  EMAIL_VERIFY: (tokenHash) => `emailverify:${tokenHash}`,
  OTP: (purpose, identifier) => `otp:${purpose}:${identifier}`,
  RATE_LIMIT: (scope, id) => `rl:${scope}:${id}`,
  ACCOUNT_LOCK: (userId) => `lock:${userId}`,
  LOGIN_ATTEMPTS: (identifier) => `login:attempts:${identifier}`,
  PERMISSIONS: (role) => `permissions:${role}`,
  CONFIG: (key) => `config:${key}`,
  HEALTH: 'health:ping',
});

export const CACHE_TTL = Object.freeze({
  SHORT: 60,
  MEDIUM: 300,
  LONG: 3600,
  DAY: 86400,
  WEEK: 604800,
  USER: 900,
  SESSION: 604800,
  OTP: 600,
  PASSWORD_RESET: 3600,
  EMAIL_VERIFY: 86400,
});

export default CACHE_KEYS;
