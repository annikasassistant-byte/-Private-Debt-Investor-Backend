export {
  authenticate,
  optionalAuthenticate,
  authMiddleware,
  protect,
  extractAccessToken,
  default as auth,
} from './auth.middleware.js';

export {
  authorize,
  authorizeMinRole,
  authorizeMiddleware,
  default as authorizeDefault,
} from './authorize.middleware.js';

export {
  requirePermission,
  requireAnyPermission,
  collectUserPermissionSlugs,
  permissionMiddleware,
  default as permission,
} from './permission.middleware.js';

export {
  validate,
  validateRequest,
  validateMiddleware,
  default as validateDefault,
} from './validate.middleware.js';

export {
  errorMiddleware,
  ensureDbConnected,
  default as error,
} from './error.middleware.js';

export { notFoundMiddleware, default as notFound } from './notFound.middleware.js';

export {
  methodNotAllowed,
  methodNotAllowedMiddleware,
  default as methodNotAllowedDefault,
} from './methodNotAllowed.middleware.js';

export {
  generalLimiter,
  authLimiter,
  uploadLimiter,
  sensitiveLimiter,
  globalRateLimiter,
  authRateLimiter,
  uploadRateLimiter,
  createRateLimiter,
  default as rateLimiter,
} from './rateLimiter.middleware.js';

export { requestIdMiddleware, default as requestId } from './requestId.middleware.js';
export { requestTimeMiddleware, default as requestTime } from './requestTime.middleware.js';
export {
  requestLoggerMiddleware,
  default as requestLogger,
} from './requestLogger.middleware.js';

export { cacheMiddleware, default as cache } from './cache.middleware.js';

export {
  cacheInvalidator,
  invalidateUsersCache,
  invalidateRolesCache,
  invalidatePermissionsCache,
  cacheInvalidatorMiddleware,
  default as cacheInvalidatorDefault,
} from './cacheInvalidator.middleware.js';

export {
  uploadSingle,
  uploadMultiple,
  uploadFields,
  uploadSingleMemory,
  uploadAvatar,
  requireFile,
  uploadMiddleware,
  default as upload,
} from './upload.middleware.js';

export {
  imageResize,
  resizeAvatar,
  imageResizeMiddleware,
  default as imageResizeDefault,
} from './imageResize.middleware.js';

export { xssMiddleware, default as xss } from './xss.middleware.js';
export { maintenanceMiddleware, default as maintenance } from './maintenance.middleware.js';
export { apiKeyMiddleware, default as apiKey } from './apiKey.middleware.js';
export {
  ipWhitelist,
  ipWhitelistMiddleware,
  default as ipWhitelistDefault,
} from './ipWhitelist.middleware.js';
export {
  csrfMiddleware,
  issueCsrfToken,
  default as csrf,
} from './csrf.middleware.js';
