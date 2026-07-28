import { Redis } from 'ioredis';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { buildRedisOptions, isRedisTlsUrl } from '../config/redisOptions.js';

let connection: Redis | null = null;

/**
 * BullMQ Redis connection from REDIS_URL only.
 */
export function getQueueConnection(): Redis {
  if (connection) return connection;

  const options = buildRedisOptions({
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
    keyPrefix: undefined,
  });

  connection = new Redis(env.REDIS_URL, options);

  connection.on('connect', () => {
    logger.info('BullMQ Redis connecting...', { tls: isRedisTlsUrl() });
  });
  connection.on('ready', () => logger.info('BullMQ Redis ready'));
  connection.on('error', (err) => logger.error('BullMQ Redis error', { message: err.message }));
  connection.on('close', () => logger.warn('BullMQ Redis connection closed'));

  return connection;
}

/**
 * @returns {import('bullmq').JobsOptions}
 */
export function getDefaultJobOptions() {
  return {
    attempts: env.QUEUE_ATTEMPTS,
    backoff: { type: 'exponential', delay: env.QUEUE_BACKOFF_MS },
    removeOnComplete: { count: 200, age: 24 * 60 * 60 },
    removeOnFail: { count: 500, age: 7 * 24 * 60 * 60 },
  };
}

/**
 * @returns {Promise<void>}
 */
export async function closeQueueConnection() {
  if (!connection) return;
  try {
    await connection.quit();
  } catch {
    connection.disconnect();
  } finally {
    connection = null;
    logger.info('BullMQ Redis disconnected');
  }
}

export default {
  getQueueConnection,
  getDefaultJobOptions,
  closeQueueConnection,
};
