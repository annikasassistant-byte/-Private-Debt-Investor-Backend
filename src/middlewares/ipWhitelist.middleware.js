import { ApiError } from '../utils/ApiError.js';
import { MESSAGES } from '../constants/messages.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import logger from '../config/logger.js';

/**
 * Parse allow-list from env or options.
 * @param {string|string[]} [source]
 * @returns {string[]}
 */
function parseList(source) {
  if (Array.isArray(source)) return source.map(String).filter(Boolean);
  if (typeof source === 'string') {
    return source
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Restrict access to configured IP addresses.
 * Reads `IP_WHITELIST` from process.env when options.ips is omitted.
 * Empty list = allow all (disabled).
 *
 * @param {{ ips?: string[], trustProxy?: boolean }} [options]
 * @returns {import('express').RequestHandler}
 */
export function ipWhitelist(options = {}) {
  const allowed = parseList(options.ips ?? process.env.IP_WHITELIST ?? '');

  return (req, _res, next) => {
    if (!allowed.length) {
      return next();
    }

    const clientIp =
      req.ip ||
      req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      '';

    const normalized = clientIp.replace(/^::ffff:/, '');

    if (allowed.includes(normalized) || allowed.includes(clientIp) || allowed.includes('*')) {
      return next();
    }

    logger.warn('IP blocked by whitelist', { ip: normalized, path: req.originalUrl });
    return next(
      new ApiError(MESSAGES.FORBIDDEN, HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN),
    );
  };
}

export const ipWhitelistMiddleware = ipWhitelist();
export default ipWhitelist;
