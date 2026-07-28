import mongoose from 'mongoose';
import env from './env.js';
import logger from './logger.js';

mongoose.set('strictQuery', true);

let isConnected = false;
let connectionPromise = null;

/**
 * Sleep helper for retry backoff.
 * @param {number} ms
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Connect to MongoDB with pooling, retries, and event logging.
 * @param {{ maxRetries?: number, retryDelayMs?: number }} [options]
 * @returns {Promise<typeof mongoose>}
 */
export async function connectDatabase(options = {}) {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  const maxRetries = options.maxRetries ?? env.MONGODB_MAX_RETRIES;
  const retryDelayMs = options.retryDelayMs ?? env.MONGODB_RETRY_DELAY_MS;

  connectionPromise = (async () => {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        const connectOptions = {
          maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
          minPoolSize: env.MONGODB_MIN_POOL_SIZE,
          serverSelectionTimeoutMS: env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
          socketTimeoutMS: env.MONGODB_SOCKET_TIMEOUT_MS,
          connectTimeoutMS: env.MONGODB_CONNECT_TIMEOUT_MS,
          autoIndex: env.MONGODB_AUTO_INDEX,
        };

        if (env.MONGODB_FAMILY) {
          connectOptions.family = env.MONGODB_FAMILY;
        }

        await mongoose.connect(env.MONGODB_URI, connectOptions);

        isConnected = true;
        logger.info('MongoDB connected successfully', {
          host: mongoose.connection.host,
          name: mongoose.connection.name,
          attempt,
        });

        return mongoose;
      } catch (error) {
        lastError = error;
        isConnected = false;
        logger.error(`MongoDB connection attempt ${attempt}/${maxRetries} failed`, {
          message: error.message,
        });

        if (attempt < maxRetries) {
          await sleep(retryDelayMs * attempt);
        }
      }
    }

    connectionPromise = null;
    throw lastError;
  })();

  return connectionPromise;
}

/**
 * Disconnect from MongoDB gracefully.
 * @returns {Promise<void>}
 */
export async function disconnectDatabase() {
  if (mongoose.connection.readyState === 0) {
    isConnected = false;
    connectionPromise = null;
    return;
  }

  await mongoose.disconnect();
  isConnected = false;
  connectionPromise = null;
  logger.info('MongoDB disconnected');
}

/**
 * Ensure indexes for all registered models.
 * @returns {Promise<void>}
 */
export async function syncIndexes() {
  const modelNames = mongoose.modelNames();

  await Promise.all(
    modelNames.map(async (name) => {
      const model = mongoose.model(name);
      await model.syncIndexes();
      logger.debug(`Indexes synced for model: ${name}`);
    }),
  );

  logger.info(`Synced indexes for ${modelNames.length} model(s)`);
}

/**
 * Current connection health snapshot.
 * @returns {{ connected: boolean, readyState: number, host: string|null, name: string|null }}
 */
export function getDatabaseStatus() {
  return {
    connected: isConnected && mongoose.connection.readyState === 1,
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host ?? null,
    name: mongoose.connection.name ?? null,
  };
}

mongoose.connection.on('connected', () => {
  isConnected = true;
  logger.debug('Mongoose connection event: connected');
});

mongoose.connection.on('error', (err) => {
  isConnected = false;
  logger.error('Mongoose connection error', { message: err.message });
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  connectionPromise = null;
  logger.warn('Mongoose disconnected');
});

mongoose.connection.on('reconnected', () => {
  isConnected = true;
  logger.info('Mongoose reconnected');
});

export default {
  connectDatabase,
  disconnectDatabase,
  syncIndexes,
  getDatabaseStatus,
};
