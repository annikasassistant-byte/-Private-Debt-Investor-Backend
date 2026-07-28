import { ApiError } from '../utils/ApiError.js';

/**
 * 404 Not Found handler for unmatched routes.
 * @type {import('express').RequestHandler}
 */
export function notFoundMiddleware(req, _res, next) {
  next(ApiError.notFound(`Cannot ${req.method} ${req.originalUrl}`));
}

export default notFoundMiddleware;
