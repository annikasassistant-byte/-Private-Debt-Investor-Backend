import { Worker } from 'bullmq';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { EmailService } from '../services/email.service.js';
import { EMAIL_QUEUE_NAME } from '../queues/email.queue.js';
import { getQueueConnection } from '../queues/connection.js';

const emailService = new EmailService();

/**
 * Process a single email job.
 * @param {import('bullmq').Job} job
 */
export async function processEmailJob(job) {
  const { type = 'raw', to, subject, html, text, user, token } = job.data || {};

  logger.info('Processing email job', { jobId: job.id, type, attempt: job.attemptsMade + 1 });

  switch (type) {
    case 'verification':
      if (!user || !token) {
        throw new Error('verification email requires user and token');
      }
      return emailService.sendVerification(user, token);

    case 'password-reset':
      if (!user || !token) {
        throw new Error('password-reset email requires user and token');
      }
      return emailService.sendPasswordReset(user, token);

    case 'welcome':
      if (!user) {
        throw new Error('welcome email requires user');
      }
      return emailService.sendWelcome(user);

    case 'raw':
    default:
      if (!to || !subject) {
        throw new Error('raw email requires to and subject');
      }
      return emailService.send({ to, subject, html, text });
  }
}

/**
 * Start the email worker.
 * @returns {Worker}
 */
export function startEmailWorker() {
  const worker = new Worker(EMAIL_QUEUE_NAME, processEmailJob, {
    connection: getQueueConnection(),
    concurrency: env.QUEUE_CONCURRENCY,
  });

  worker.on('completed', (job) => {
    logger.info('Email job completed', { jobId: job.id, name: job.name });
  });

  worker.on('failed', (job, err) => {
    logger.error('Email job failed', {
      jobId: job?.id,
      name: job?.name,
      message: err.message,
      attemptsMade: job?.attemptsMade,
    });
  });

  worker.on('error', (err) => {
    logger.error('Email worker error', { message: err.message });
  });

  logger.info('Email worker started', { queue: EMAIL_QUEUE_NAME, concurrency: env.QUEUE_CONCURRENCY });
  return worker;
}

export default {
  processEmailJob,
  startEmailWorker,
};
