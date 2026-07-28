import morgan from 'morgan';
import logger from '../config/logger.js';
import env, { isProduction } from '../config/env.js';

morgan.token('request-id', (req) => req.requestId || req.id || '-');
morgan.token('user-id', (req) => {
  const id = req.user?._id || req.user?.id;
  return id ? String(id) : '-';
});

const format =
  ':remote-addr :method :url :status :res[content-length] - :response-time ms rid=:request-id uid=:user-id';

/**
 * Morgan HTTP logger streaming into Winston.
 */
export const requestLoggerMiddleware = morgan(format, {
  stream: {
    write: (message) => {
      logger.http(message.trim());
    },
  },
  skip: (req) => {
    if (env.NODE_ENV === 'test') return true;
    if (isProduction && req.url?.startsWith('/api/v1/health')) return true;
    return false;
  },
});

export default requestLoggerMiddleware;
