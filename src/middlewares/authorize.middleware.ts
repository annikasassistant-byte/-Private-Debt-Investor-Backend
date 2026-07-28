import { ApiError } from '../utils/ApiError.js';
import { MESSAGES } from '../constants/messages.js';
import { ROLES, hasRoleLevel } from '../enums/roles.js';

/**
 * Resolve role slug from authenticated user document.
 * @param {object} user
 * @returns {string|null}
 */
function resolveRoleSlug(user) {
  if (!user) return null;
  if (typeof user.role === 'string') return user.role;
  if (user.role?.slug) return user.role.slug;
  return null;
}

/**
 * Require the user to have one of the listed roles (exact match).
 * @param {...string} roles
 * @returns {import('express').RequestHandler}
 */
export function authorize(...roles) {
  const allowed = roles.flat().filter(Boolean);

  return (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized(MESSAGES.UNAUTHORIZED));
    }

    const slug = resolveRoleSlug(req.user);
    if (!slug) {
      return next(ApiError.forbidden(MESSAGES.FORBIDDEN));
    }

    if (slug === ROLES.SUPER_ADMIN) {
      return next();
    }

    if (!allowed.length || allowed.includes(slug)) {
      return next();
    }

    return next(ApiError.forbidden(MESSAGES.FORBIDDEN));
  };
}

/**
 * Require role hierarchy level >= required role.
 * @param {string} minimumRole
 * @returns {import('express').RequestHandler}
 */
export function authorizeMinRole(minimumRole) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized(MESSAGES.UNAUTHORIZED));
    }

    const slug = resolveRoleSlug(req.user);
    if (!slug || !hasRoleLevel(slug, minimumRole)) {
      return next(ApiError.forbidden(MESSAGES.FORBIDDEN));
    }

    return next();
  };
}

export const authorizeMiddleware = authorize;
export default authorize;
