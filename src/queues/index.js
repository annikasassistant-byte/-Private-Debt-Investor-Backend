import {
  EMAIL_QUEUE_NAME,
  getEmailQueue,
  enqueueEmail,
  closeEmailQueue,
} from './email.queue.js';
import {
  NOTIFICATION_QUEUE_NAME,
  getNotificationQueue,
  enqueueNotification,
  closeNotificationQueue,
} from './notification.queue.js';
import {
  getQueueConnection,
  getDefaultJobOptions,
  closeQueueConnection,
} from './connection.js';
import logger from '../config/logger.js';

/**
 * Initialize queue producers (lazy — creates connections on first use).
 */
export function initQueues() {
  getEmailQueue();
  getNotificationQueue();
  logger.info('Queues initialized', {
    email: EMAIL_QUEUE_NAME,
    notification: NOTIFICATION_QUEUE_NAME,
  });
}

/**
 * Gracefully close all queues and the shared Redis connection.
 * @returns {Promise<void>}
 */
export async function closeQueues() {
  await Promise.all([closeEmailQueue(), closeNotificationQueue()]);
  await closeQueueConnection();
  logger.info('All queues closed');
}

export {
  EMAIL_QUEUE_NAME,
  getEmailQueue,
  enqueueEmail,
  closeEmailQueue,
  NOTIFICATION_QUEUE_NAME,
  getNotificationQueue,
  enqueueNotification,
  closeNotificationQueue,
  getQueueConnection,
  getDefaultJobOptions,
  closeQueueConnection,
};

export default {
  initQueues,
  closeQueues,
  enqueueEmail,
  enqueueNotification,
};
