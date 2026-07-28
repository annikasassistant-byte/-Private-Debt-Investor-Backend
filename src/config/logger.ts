import fs from 'node:fs';
import path from 'node:path';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import env, { isProduction } from './env.js';

const logDir = path.resolve(process.cwd(), env.LOG_DIR);

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const { combine, timestamp, errors, printf, colorize, json, splat } = winston.format;

const consoleFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  splat(),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const metaKeys = Object.keys(meta).filter((k) => k !== 'service');
    const metaStr = metaKeys.length ? ` ${JSON.stringify(meta)}` : '';
    const stackStr = stack ? `\n${stack}` : '';
    return `${ts} [${level}]: ${message}${metaStr}${stackStr}`;
  }),
);

const fileFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  splat(),
  json(),
);

const dailyRotateDefaults = {
  dirname: logDir,
  datePattern: env.LOG_DATE_PATTERN,
  maxSize: env.LOG_MAX_SIZE,
  maxFiles: env.LOG_MAX_FILES,
  zippedArchive: true,
};

const errorRotateTransport = new DailyRotateFile({
  ...dailyRotateDefaults,
  filename: 'errors-%DATE%.log',
  level: 'error',
  format: fileFormat,
});

const combinedRotateTransport = new DailyRotateFile({
  ...dailyRotateDefaults,
  filename: 'combined-%DATE%.log',
  format: fileFormat,
});

const exceptionsTransport = new DailyRotateFile({
  ...dailyRotateDefaults,
  filename: 'exceptions-%DATE%.log',
  format: fileFormat,
});

const rejectionsTransport = new DailyRotateFile({
  ...dailyRotateDefaults,
  filename: 'rejections-%DATE%.log',
  format: fileFormat,
});

const consoleTransport = new winston.transports.Console({
  level: isProduction ? 'info' : 'debug',
  format: consoleFormat,
  handleExceptions: true,
  handleRejections: true,
});

const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  defaultMeta: { service: env.APP_NAME },
  transports: [errorRotateTransport, combinedRotateTransport, consoleTransport],
  exceptionHandlers: [exceptionsTransport, consoleTransport],
  rejectionHandlers: [rejectionsTransport, consoleTransport],
  exitOnError: false,
});

logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

export default logger;
