import IORedis from 'ioredis';
import env from '../config/env.js';
import logger from '../config/logger.js';

/** @type {IORedis | null} */
let connection = null;

/**
 * Shared BullMQ Redis connection.
 * BullMQ requires `maxRetriesPerRequest: null` for blocking commands.
 * @returns {IORedis}
 */
export function getQueueConnection() {
  if (connection) {
    return connection;
  }

  const options = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectTimeout: env.REDIS_CONNECT_TIMEOUT_MS,
    lazyConnect: false,
  };

  if (env.REDIS_PASSWORD) {
    options.password = env.REDIS_PASSWORD;
  }

  connection = new IORedis(env.REDIS_URL, options);

  connection.on('connect', () => {
    logger.info('BullMQ Redis connecting...');
  });

  connection.on('ready', () => {
    logger.info('BullMQ Redis ready');
  });

  connection.on('error', (err) => {
    logger.error('BullMQ Redis error', { message: err.message });
  });

  connection.on('close', () => {
    logger.warn('BullMQ Redis connection closed');
  });

  return connection;
}

/**
 * Default job options shared across queues.
 * @returns {import('bullmq').JobsOptions}
 */
export function getDefaultJobOptions() {
  return {
    attempts: env.QUEUE_ATTEMPTS,
    backoff: {
      type: 'exponential',
      delay: env.QUEUE_BACKOFF_MS,
    },
    removeOnComplete: {
      count: 200,
      age: 24 * 60 * 60,
    },
    removeOnFail: {
      count: 500,
      age: 7 * 24 * 60 * 60,
    },
  };
}

/**
 * Gracefully close the shared BullMQ connection.
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
