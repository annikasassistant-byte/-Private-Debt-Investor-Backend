import env from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { MESSAGES } from '../constants/messages.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ROLES } from '../enums/roles.js';

/**
 * Block non-admin traffic when MAINTENANCE_MODE is enabled.
 * Health checks and docs remain reachable.
 * @type {import('express').RequestHandler}
 */
export function maintenanceMiddleware(req, _res, next) {
  if (!env.MAINTENANCE_MODE) {
    return next();
  }

  const path = req.path || req.originalUrl || '';
  const bypass =
    path.includes('/health') ||
    path.includes('/api-docs') ||
    path.includes('/api/docs') ||
    path.includes('/docs');

  if (bypass) {
    return next();
  }

  const roleSlug =
    typeof req.user?.role === 'string' ? req.user.role : req.user?.role?.slug || null;

  if (roleSlug === ROLES.SUPER_ADMIN || roleSlug === ROLES.ADMIN) {
    return next();
  }

  return next(
    new ApiError(
      MESSAGES.MAINTENANCE,
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      ERROR_CODES.MAINTENANCE_MODE,
    ),
  );
}

export default maintenanceMiddleware;
