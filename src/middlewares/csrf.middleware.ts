import crypto from 'node:crypto';
import env from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

const CSRF_COOKIE = process.env.CSRF_COOKIE_NAME || 'csrf_token';
const CSRF_HEADER = (process.env.CSRF_HEADER_NAME || 'x-csrf-token').toLowerCase();
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Public auth routes used by the SPA before a session exists (no Bearer yet). */
const CSRF_EXEMPT_PATHS = [
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/register-admin',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/verify-otp',
  '/api/v1/auth/reset-password',
  '/api/v1/auth/refresh',
  '/api/v1/auth/verify-email',
  '/api/v1/auth/resend-verification',
];

/**
 * Whether CSRF protection is enabled.
 * Defaults to production only; override with CSRF_ENABLED=true|false.
 */
function isCsrfEnabled() {
  if (process.env.CSRF_ENABLED === 'true' || process.env.CSRF_ENABLED === '1') return true;
  if (process.env.CSRF_ENABLED === 'false' || process.env.CSRF_ENABLED === '0') return false;
  return env.NODE_ENV === 'production';
}

function isCsrfExemptPath(path) {
  if (!path) return false;
  const normalized = path.split('?')[0].replace(/\/+$/, '') || '/';
  return CSRF_EXEMPT_PATHS.some((exempt) => normalized === exempt || normalized.endsWith(exempt));
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
 *
 * Skips when:
 * - CSRF disabled
 * - Safe HTTP methods
 * - Public auth routes (login/register/forgot/…)
 * - Bearer JWT present (SPA / Postman Authorization header)
 * - X-API-Key present (M2M / register-admin)
 * - No CSRF cookie (pure API client, not cookie-session)
 *
 * @type {import('express').RequestHandler}
 */
export function csrfMiddleware(req, res, next) {
  if (!isCsrfEnabled()) {
    return next();
  }

  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    if (!req.cookies?.[CSRF_COOKIE]) {
      issueCsrfToken(res);
    }
    return next();
  }

  if (isCsrfExemptPath(req.path) || isCsrfExemptPath(req.originalUrl)) {
    return next();
  }

  const hasBearer =
    typeof req.headers.authorization === 'string' &&
    req.headers.authorization.startsWith('Bearer ');

  // SPA stores JWT in localStorage and sends Bearer — CSRF not required
  if (hasBearer) {
    return next();
  }

  const apiKeyHeader = req.headers['x-api-key'] || req.headers['X-API-Key'];
  if (typeof apiKeyHeader === 'string' && apiKeyHeader.trim()) {
    return next();
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE];

  // No CSRF cookie → not a cookie-session browser flow
  if (!cookieToken) {
    return next();
  }

  const headerToken =
    req.headers[CSRF_HEADER] || req.headers['csrf-token'] || req.body?._csrf || req.query?._csrf;

  if (!headerToken || String(cookieToken) !== String(headerToken)) {
    return next(new ApiError('Invalid CSRF token', HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN));
  }

  return next();
}

export default csrfMiddleware;
