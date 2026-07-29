import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ApiError } from '../utils/ApiError.js';
import { MESSAGES } from '../constants/messages.js';
import { ROLES, hasRoleLevel } from '../enums/roles.js';
import type { AuthUser } from '../types/express.js';

/**
 * Resolve role slug from authenticated user document.
 */
function resolveRoleSlug(user: AuthUser | null | undefined): string | null {
  if (!user) return null;
  if (typeof user.role === 'string') return user.role;
  if (user.role && typeof user.role === 'object' && 'slug' in user.role && user.role.slug) {
    return user.role.slug;
  }
  return null;
}

/**
 * Require the user to have one of the listed roles (exact match).
 */
export function authorize(...roles: Array<string | string[]>): RequestHandler {
  const allowed = roles.flat().filter(Boolean);

  return (req: Request, _res: Response, next: NextFunction) => {
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
 */
export function authorizeMinRole(minimumRole: string): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
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
