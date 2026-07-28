import crypto from 'node:crypto';
import env from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { MESSAGES } from '../constants/messages.js';
import { ERROR_CODES } from '../constants/errorCodes.js';

/**
 * Timing-safe string comparison.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Require a valid X-API-Key header for machine-to-machine routes.
 * @type {import('express').RequestHandler}
 */
export function apiKeyMiddleware(req, _res, next) {
  const provided =
    req.headers['x-api-key'] ||
    req.headers['X-API-Key'] ||
    (typeof req.query.apiKey === 'string' ? req.query.apiKey : null);

  if (!provided || typeof provided !== 'string') {
    return next(new ApiError(MESSAGES.UNAUTHORIZED, 401, ERROR_CODES.UNAUTHORIZED));
  }

  if (!safeEqual(provided, env.API_KEY)) {
    return next(new ApiError(MESSAGES.UNAUTHORIZED, 401, ERROR_CODES.UNAUTHORIZED));
  }

  req.apiKeyAuthenticated = true;
  return next();
}

export default apiKeyMiddleware;
