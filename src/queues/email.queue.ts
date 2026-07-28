import { Queue } from 'bullmq';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { getQueueConnection, getDefaultJobOptions } from './connection.js';

export const EMAIL_QUEUE_NAME = `${env.QUEUE_PREFIX}-email`;

/** @type {Queue | null} */
let emailQueue = null;

/**
 * @returns {Queue}
 */
export function getEmailQueue() {
  if (emailQueue) {
    return emailQueue;
  }

  emailQueue = new Queue(EMAIL_QUEUE_NAME, {
    connection: getQueueConnection(),
    defaultJobOptions: getDefaultJobOptions(),
  });

  emailQueue.on('error', (err) => {
    logger.error('Email queue error', { message: err.message });
  });

  return emailQueue;
}

/**
 * Enqueue a transactional email job.
 * @param {{
 *   type: 'raw'|'verification'|'password-reset'|'welcome',
 *   to?: string,
 *   subject?: string,
 *   html?: string,
 *   text?: string,
 *   user?: object,
 *   token?: string,
 * }} payload
 * @param {import('bullmq').JobsOptions} [options]
 */
export async function enqueueEmail(payload, options = {}) {
  const queue = getEmailQueue();
  const job = await queue.add(`email:${payload.type || 'raw'}`, payload, {
    ...getDefaultJobOptions(),
    ...options,
  });

  logger.debug('Email job enqueued', { jobId: job.id, type: payload.type });
  return job;
}

/**
 * Close the email queue.
 * @returns {Promise<void>}
 */
export async function closeEmailQueue() {
  if (!emailQueue) return;
  await emailQueue.close();
  emailQueue = null;
}

export default {
  EMAIL_QUEUE_NAME,
  getEmailQueue,
  enqueueEmail,
  closeEmailQueue,
};
