import Redis from 'ioredis';
import env from './env.js';
import logger from './logger.js';
import { buildRedisOptions, isRedisTlsUrl } from './redisOptions.js';

/** @type {Redis | null} */
let redisClient = null;
let redisEnabled = true;

/**
 * Build reconnect delay with exponential backoff capped at 30s.
 * @param {number} times
 * @returns {number | null}
 */
function reconnectStrategy(times) {
  if (times > env.REDIS_MAX_RETRIES) {
    logger.error('Redis max reconnect attempts exceeded — disabling Redis client', { times });
    redisEnabled = false;
    return null;
  }

  const delay = Math.min(times * 200, 30000);
  logger.warn('Redis reconnecting', { attempt: times, delayMs: delay });
  return delay;
}

/**
 * Create Redis client from REDIS_URL only (password + TLS come from the URL).
 * @returns {Redis | null}
 */
export function getRedisClient() {
  if (!redisEnabled) return null;
  if (redisClient) return redisClient;

  const options = buildRedisOptions({
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    retryStrategy: reconnectStrategy,
  });

  redisClient = new Redis(env.REDIS_URL, options);

  redisClient.on('connect', () => {
    logger.info('Redis connecting...', { tls: isRedisTlsUrl() });
  });

  redisClient.on('ready', () => {
    redisEnabled = true;
    logger.info('Redis ready');
  });

  redisClient.on('error', (err) => {
    if (env.NODE_ENV === 'production') {
      logger.error('Redis error', { message: err.message });
    } else {
      logger.debug('Redis error', { message: err.message });
    }
  });

  redisClient.on('close', () => logger.warn('Redis connection closed'));
  redisClient.on('reconnecting', (delay) => logger.warn('Redis reconnecting', { delayMs: delay }));
  redisClient.on('end', () => logger.warn('Redis connection ended'));

  return redisClient;
}

/**
 * Ensure Redis is connected (no-op if already ready or disabled).
 * @returns {Promise<boolean>}
 */
export async function connectRedis() {
  const client = getRedisClient();
  if (!client) return false;

  if (client.status === 'ready') return true;

  try {
    if (client.status === 'wait' || client.status === 'end') {
      await client.connect();
    }
    // Wait briefly for ready
    if (client.status !== 'ready') {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Redis connect timeout')), 3000);
        client.once('ready', () => {
          clearTimeout(timer);
          resolve();
        });
        client.once('error', (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });
    }
    return true;
  } catch (error) {
    logger.warn('Redis unavailable — continuing without cache/session store', {
      message: error.message,
    });
    redisEnabled = false;
    try {
      client.disconnect();
    } catch {
      /* ignore */
    }
    redisClient = null;
    return false;
  }
}

/**
 * Ping Redis and return latency info.
 * @returns {Promise<{ ok: boolean, latencyMs: number }>}
 */
export async function pingRedis() {
  const start = Date.now();
  const client = getRedisClient();

  if (!client) {
    return { ok: false, latencyMs: Date.now() - start };
  }

  try {
    if (client.status !== 'ready') {
      const connected = await connectRedis();
      if (!connected) {
        return { ok: false, latencyMs: Date.now() - start };
      }
    }
    const result = await client.ping();
    return {
      ok: result === 'PONG',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    logger.warn('Redis ping failed', { message: error.message });
    return { ok: false, latencyMs: Date.now() - start };
  }
}

/**
 * Gracefully quit Redis.
 * @returns {Promise<void>}
 */
export async function disconnectRedis() {
  if (!redisClient) return;

  try {
    if (redisClient.status === 'ready') {
      await redisClient.quit();
    } else {
      redisClient.disconnect();
    }
  } catch (_error) {
    try {
      redisClient.disconnect();
    } catch {
      /* ignore */
    }
  } finally {
    redisClient = null;
    logger.info('Redis disconnected');
  }
}

/**
 * Whether the client is currently ready.
 * @returns {boolean}
 */
export function isRedisReady() {
  return Boolean(redisClient && redisClient.status === 'ready' && redisEnabled);
}

export default {
  getRedisClient,
  connectRedis,
  pingRedis,
  disconnectRedis,
  isRedisReady,
};
