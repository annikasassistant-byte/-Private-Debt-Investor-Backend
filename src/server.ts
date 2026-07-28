import http from 'node:http';
import env from './config/env.js';
import logger from './config/logger.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { connectRedis, disconnectRedis, pingRedis, isRedisReady } from './config/redis.js';
import { createExpressApp } from './app.js';
import { initSocketIo } from './sockets/index.js';
import { initEvents } from './events/index.js';
import { startWorkers, stopWorkers } from './jobs/index.js';
import { startCronJobs, stopCronJobs } from './cron/index.js';

/** @type {import('http').Server|null} */
let httpServer = null;
/** @type {import('socket.io').Server|null} */
let io = null;
let isShuttingDown = false;

/**
 * Bootstrap application: DB → Redis → Events → Workers → Cron → HTTP → Socket.IO.
 */
async function start() {
  logger.info('Starting Depth Dashboard API...', {
    env: env.NODE_ENV,
    version: env.APP_VERSION,
  });

  await connectDatabase();
  logger.info('MongoDB ready');

  const redisConnected = await connectRedis();
  if (redisConnected) {
    const redisPing = await pingRedis();
    logger.info('Redis ready', { latencyMs: redisPing.latencyMs });
  } else {
    logger.warn('Redis unavailable — cache, sessions, OTP, and queues run degraded');
  }

  initEvents();

  if (isRedisReady()) {
    try {
      startWorkers();
    } catch (err) {
      logger.warn('Background workers not started', { message: err.message });
    }
  } else {
    logger.warn('Skipping BullMQ workers (Redis not ready)');
  }

  startCronJobs();

  const app = createExpressApp();
  httpServer = http.createServer(app);

  io = await initSocketIo(httpServer);
  if (io) {
    app.set('io', io);
    logger.info('Socket.IO ready', { path: env.SOCKET_PATH });
  }

  await new Promise((resolve, reject) => {
    httpServer.listen(env.PORT, () => {
      logger.info(`${env.APP_NAME} listening`, {
        port: env.PORT,
        url: `http://localhost:${env.PORT}`,
        docs: `http://localhost:${env.PORT}/api/docs`,
      });
      resolve();
    });
    httpServer.on('error', reject);
  });
}

/**
 * Graceful shutdown on SIGTERM / SIGINT.
 * @param {string} signal
 */
async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}, shutting down gracefully...`);

  const forceTimer = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 15000);
  forceTimer.unref?.();

  try {
    stopCronJobs();
    await stopWorkers();

    if (io) {
      await new Promise((resolve) => {
        io.close(() => resolve());
      });
      io = null;
      logger.info('Socket.IO closed');
    }

    if (httpServer) {
      await new Promise((resolve, reject) => {
        httpServer.close((err) => (err ? reject(err) : resolve()));
      });
      httpServer = null;
      logger.info('HTTP server closed');
    }

    await disconnectRedis();
    await disconnectDatabase();

    logger.info('Shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error('Error during shutdown', { message: err.message, stack: err.stack });
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { message: err.message, stack: err.stack });
  // Non-fatal response lifecycle races should not take down the process
  if (err?.code === 'ERR_HTTP_HEADERS_SENT') {
    return;
  }
  shutdown('uncaughtException').catch(() => process.exit(1));
});

process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  logger.error('Unhandled rejection', {
    reason: message,
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  if (reason?.code === 'ERR_HTTP_HEADERS_SENT') {
    return;
  }
  shutdown('unhandledRejection').catch(() => process.exit(1));
});

start().catch((err) => {
  logger.error('Failed to start server', { message: err.message, stack: err.stack });
  process.exit(1);
});
