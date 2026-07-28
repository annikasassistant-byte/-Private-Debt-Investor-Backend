import { ApiError } from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';

/**
 * Build a middleware that rejects HTTP methods not in the allow-list.
 * Typically used after a router that only defines a subset of verbs on a path.
 *
 * @param {string[]} allowedMethods
 * @returns {import('express').RequestHandler}
 */
export function methodNotAllowed(allowedMethods = []) {
  const allowed = allowedMethods.map((m) => m.toUpperCase());

  return (req, res, next) => {
    if (allowed.includes(req.method.toUpperCase())) {
      return next();
    }

    res.setHeader('Allow', allowed.join(', '));
    return next(
      new ApiError(
        `Method ${req.method} not allowed for ${req.originalUrl}`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.BAD_REQUEST,
      ),
    );
  };
}

/**
 * Catch-all for Express routers: respond 405 when a path matched a sibling
 * but the verb did not. Use as the last handler on a router:
 * `router.all('*', methodNotAllowedMiddleware)`.
 *
 * @type {import('express').RequestHandler}
 */
export function methodNotAllowedMiddleware(req, res, next) {
  // If we reached here, no prior route matched this method.
  const allow = res.getHeader('Allow');
  if (!allow) {
    res.setHeader('Allow', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');
  }

  return next(
    new ApiError(
      `Method ${req.method} not allowed for ${req.originalUrl}`,
      405,
      ERROR_CODES.BAD_REQUEST,
    ),
  );
}

export default methodNotAllowedMiddleware;
