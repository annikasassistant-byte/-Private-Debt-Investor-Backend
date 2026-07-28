import crypto from 'node:crypto';
import env from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

const CSRF_COOKIE = process.env.CSRF_COOKIE_NAME || 'csrf_token';
const CSRF_HEADER = (process.env.CSRF_HEADER_NAME || 'x-csrf-token').toLowerCase();
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Whether CSRF protection is enabled.
 * Defaults to production only; override with CSRF_ENABLED=true|false.
 */
function isCsrfEnabled() {
  if (process.env.CSRF_ENABLED === 'true' || process.env.CSRF_ENABLED === '1') return true;
  if (process.env.CSRF_ENABLED === 'false' || process.env.CSRF_ENABLED === '0') return false;
  return env.NODE_ENV === 'production';
}

/**
 * Issue a CSRF token cookie (double-submit pattern).
 * Call on login / session bootstrap responses.
 *
 * @param {import('express').Response} res
 * @returns {string} token
 */
export function issueCsrfToken(res) {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    domain: env.COOKIE_DOMAIN,
    path: env.COOKIE_PATH,
    maxAge: env.COOKIE_MAX_AGE_MS,
  });
  return token;
}

/**
 * Optional CSRF double-submit cookie middleware.
 * Skips safe methods, Bearer-only API clients without cookies, and when disabled.
 *
 * @type {import('express').RequestHandler}
 */
export function csrfMiddleware(req, res, next) {
  if (!isCsrfEnabled()) {
    return next();
  }

  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    // Ensure browser clients have a token available
    if (!req.cookies?.[CSRF_COOKIE]) {
      issueCsrfToken(res);
    }
    return next();
  }

  // Skip pure Bearer API requests with no CSRF cookie (machine clients)
  const hasBearer =
    typeof req.headers.authorization === 'string' &&
    req.headers.authorization.startsWith('Bearer ');
  const cookieToken = req.cookies?.[CSRF_COOKIE];

  if (hasBearer && !cookieToken) {
    return next();
  }

  const headerToken =
    req.headers[CSRF_HEADER] ||
    req.headers['csrf-token'] ||
    req.body?._csrf ||
    req.query?._csrf;

  if (!cookieToken || !headerToken || String(cookieToken) !== String(headerToken)) {
    return next(
      new ApiError('Invalid CSRF token', HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN),
    );
  }

  return next();
}

export default csrfMiddleware;
