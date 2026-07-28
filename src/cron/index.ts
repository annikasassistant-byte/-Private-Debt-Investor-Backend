import cron from 'node-cron';
import mongoose from 'mongoose';
import logger from '../config/logger.js';
import env from '../config/env.js';

/** Soft-deleted users older than this many days are hard-deleted. */
const SOFT_DELETE_RETENTION_DAYS = Number.parseInt(
  process.env.SOFT_DELETE_RETENTION_DAYS || '30',
  10,
);

/** @type {import('node-cron').ScheduledTask[]} */
const scheduledTasks = [];

/**
 * Remove expired / revoked refresh tokens from Mongo.
 * @returns {Promise<number>} deleted count
 */
export async function cleanupExpiredTokens() {
  if (mongoose.connection.readyState !== 1) {
    logger.warn('Skipping token cleanup — MongoDB not connected');
    return 0;
  }

  try {
    const RefreshToken = mongoose.models.RefreshToken;
    if (!RefreshToken) {
      logger.warn('RefreshToken model not registered — skipping token cleanup');
      return 0;
    }

    const now = new Date();
    const result = await RefreshToken.deleteMany({
      $or: [{ expiresAt: { $lte: now } }, { revoked: true, revokedAt: { $lte: now } }],
    });

    const deleted = result.deletedCount || 0;
    logger.info('Expired refresh tokens cleaned up', { deleted });
    return deleted;
  } catch (err) {
    logger.error('Token cleanup failed', { message: err.message, stack: err.stack });
    return 0;
  }
}

/**
 * Permanently remove soft-deleted users older than retention window.
 * @param {number} [retentionDays]
 * @returns {Promise<number>} deleted count
 */
export async function cleanupSoftDeletedUsers(retentionDays = SOFT_DELETE_RETENTION_DAYS) {
  if (mongoose.connection.readyState !== 1) {
    logger.warn('Skipping soft-deleted user cleanup — MongoDB not connected');
    return 0;
  }

  try {
    const User = mongoose.models.User;
    if (!User) {
      logger.warn('User model not registered — skipping user cleanup');
      return 0;
    }

    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const result = await User.deleteMany({
      isDeleted: true,
      deletedAt: { $lte: cutoff },
    });

    const deleted = result.deletedCount || 0;
    logger.info('Soft-deleted users purged', { deleted, retentionDays, cutoff: cutoff.toISOString() });
    return deleted;
  } catch (err) {
    logger.error('Soft-deleted user cleanup failed', { message: err.message, stack: err.stack });
    return 0;
  }
}

/**
 * Register cron schedules (and optional setInterval fallbacks).
 * Safe to call once during app bootstrap.
 * @returns {{ tasks: import('node-cron').ScheduledTask[], intervals: NodeJS.Timeout[] }}
 */
export function startCronJobs() {
  if (env.NODE_ENV === 'test') {
    logger.info('Cron jobs skipped in test environment');
    return { tasks: [], intervals: [] };
  }

  const intervals = [];

  // Every day at 02:15 UTC — expired tokens
  const tokenTask = cron.schedule(
    '15 2 * * *',
    () => {
      cleanupExpiredTokens().catch((err) => {
        logger.error('Scheduled token cleanup error', { message: err.message });
      });
    },
    { timezone: 'UTC' },
  );
  scheduledTasks.push(tokenTask);

  // Every Sunday at 03:30 UTC — soft-deleted users
  const userTask = cron.schedule(
    '30 3 * * 0',
    () => {
      cleanupSoftDeletedUsers().catch((err) => {
        logger.error('Scheduled user cleanup error', { message: err.message });
      });
    },
    { timezone: 'UTC' },
  );
  scheduledTasks.push(userTask);

  // setInterval example: lightweight heartbeat / health log every 6 hours
  const heartbeat = setInterval(
    () => {
      logger.info('Cron heartbeat', {
        uptimeSec: Math.floor(process.uptime()),
        nodeEnv: env.NODE_ENV,
        mongoReady: mongoose.connection.readyState === 1,
      });
    },
    6 * 60 * 60 * 1000,
  );
  if (typeof heartbeat.unref === 'function') heartbeat.unref();
  intervals.push(heartbeat);

  logger.info('Cron jobs registered', {
    schedules: ['15 2 * * * (tokens)', '30 3 * * 0 (soft-deleted users)', '6h heartbeat'],
    softDeleteRetentionDays: SOFT_DELETE_RETENTION_DAYS,
  });

  return { tasks: scheduledTasks, intervals };
}

/**
 * Stop all scheduled cron tasks.
 */
export function stopCronJobs() {
  for (const task of scheduledTasks) {
    try {
      task.stop();
    } catch (err) {
      logger.warn('Failed to stop cron task', { message: err.message });
    }
  }
  scheduledTasks.length = 0;
  logger.info('Cron jobs stopped');
}

export default {
  startCronJobs,
  stopCronJobs,
  cleanupExpiredTokens,
  cleanupSoftDeletedUsers,
};
