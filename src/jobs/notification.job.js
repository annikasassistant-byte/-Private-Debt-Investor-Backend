import { Worker } from 'bullmq';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { NotificationService } from '../services/notification.service.js';
import { NOTIFICATION_QUEUE_NAME } from '../queues/notification.queue.js';
import { getQueueConnection } from '../queues/connection.js';

const notificationService = new NotificationService();

/**
 * Process a single notification job.
 * @param {import('bullmq').Job} job
 */
export async function processNotificationJob(job) {
  const payload = job.data || {};

  if (!payload.userId || !payload.title) {
    throw new Error('notification job requires userId and title');
  }

  logger.info('Processing notification job', {
    jobId: job.id,
    userId: payload.userId,
    type: payload.type,
    attempt: job.attemptsMade + 1,
  });

  return notificationService.notify({
    userId: payload.userId,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    data: payload.data,
    channel: payload.channel,
  });
}

/**
 * Start the notification worker.
 * @returns {Worker}
 */
export function startNotificationWorker() {
  const worker = new Worker(NOTIFICATION_QUEUE_NAME, processNotificationJob, {
    connection: getQueueConnection(),
    concurrency: env.QUEUE_CONCURRENCY,
  });

  worker.on('completed', (job) => {
    logger.info('Notification job completed', { jobId: job.id, name: job.name });
  });

  worker.on('failed', (job, err) => {
    logger.error('Notification job failed', {
      jobId: job?.id,
      name: job?.name,
      message: err.message,
      attemptsMade: job?.attemptsMade,
    });
  });

  worker.on('error', (err) => {
    logger.error('Notification worker error', { message: err.message });
  });

  logger.info('Notification worker started', {
    queue: NOTIFICATION_QUEUE_NAME,
    concurrency: env.QUEUE_CONCURRENCY,
  });

  return worker;
}

export default {
  processNotificationJob,
  startNotificationWorker,
};
