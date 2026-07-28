import { Queue } from 'bullmq';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { getQueueConnection, getDefaultJobOptions } from './connection.js';

export const NOTIFICATION_QUEUE_NAME = `${env.QUEUE_PREFIX}-notification`;

/** @type {Queue | null} */
let notificationQueue = null;

/**
 * @returns {Queue}
 */
export function getNotificationQueue() {
  if (notificationQueue) {
    return notificationQueue;
  }

  notificationQueue = new Queue(NOTIFICATION_QUEUE_NAME, {
    connection: getQueueConnection(),
    defaultJobOptions: getDefaultJobOptions(),
  });

  notificationQueue.on('error', (err) => {
    logger.error('Notification queue error', { message: err.message });
  });

  return notificationQueue;
}

/**
 * Enqueue an in-app / push notification job.
 * @param {{
 *   userId: string,
 *   type?: string,
 *   title: string,
 *   body?: string,
 *   data?: object,
 *   channel?: 'in-app'|'email'|'push',
 * }} payload
 * @param {import('bullmq').JobsOptions} [options]
 */
export async function enqueueNotification(payload, options = {}) {
  if (!payload?.userId || !payload?.title) {
    throw new TypeError('enqueueNotification requires userId and title');
  }

  const queue = getNotificationQueue();
  const job = await queue.add('notification:create', payload, {
    ...getDefaultJobOptions(),
    ...options,
  });

  logger.debug('Notification job enqueued', {
    jobId: job.id,
    userId: payload.userId,
    title: payload.title,
  });

  return job;
}

/**
 * Close the notification queue.
 * @returns {Promise<void>}
 */
export async function closeNotificationQueue() {
  if (!notificationQueue) return;
  await notificationQueue.close();
  notificationQueue = null;
}

export default {
  NOTIFICATION_QUEUE_NAME,
  getNotificationQueue,
  enqueueNotification,
  closeNotificationQueue,
};
