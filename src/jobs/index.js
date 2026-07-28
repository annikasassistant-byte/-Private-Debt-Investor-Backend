import logger from '../config/logger.js';
import { startEmailWorker } from './email.job.js';
import { startNotificationWorker } from './notification.job.js';

/** @type {import('bullmq').Worker[]} */
const workers = [];

/**
 * Start all background workers.
 * Call from `server.js` after Redis is available (or in a dedicated worker process).
 * @returns {import('bullmq').Worker[]}
 */
export function startWorkers() {
  if (workers.length > 0) {
    logger.warn('Workers already started');
    return workers;
  }

  try {
    workers.push(startEmailWorker(), startNotificationWorker());
    logger.info('All workers started', { count: workers.length });
  } catch (err) {
    logger.warn('Failed to start workers — queues disabled', { message: err.message });
  }
  return workers;
}

/**
 * Gracefully close all workers.
 * @returns {Promise<void>}
 */
export async function stopWorkers() {
  if (workers.length === 0) return;

  await Promise.all(
    workers.map(async (worker) => {
      try {
        await worker.close();
      } catch (err) {
        logger.warn('Worker close error', { message: err.message });
      }
    }),
  );

  workers.length = 0;
  logger.info('All workers stopped');
}

export { processEmailJob, startEmailWorker } from './email.job.js';
export { processNotificationJob, startNotificationWorker } from './notification.job.js';

export default {
  startWorkers,
  stopWorkers,
};
