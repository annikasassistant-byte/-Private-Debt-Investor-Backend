import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ApiError } from '../utils/ApiError.js';
import { MESSAGES } from '../constants/messages.js';
import { ROLES } from '../enums/roles.js';
import type { AuthUser } from '../types/express.js';

/**
 * Collect permission slugs from role + user overrides.
 */
export function collectUserPermissionSlugs(user: AuthUser | null | undefined): Set<string> {
  const slugs = new Set<string>();

  const rolePermissions =
    user?.role && typeof user.role === 'object' && 'permissions' in user.role
      ? (user.role.permissions as Array<string | { slug?: string }>) || []
      : [];

  for (const p of rolePermissions) {
    if (typeof p === 'string') slugs.add(p);
    else if (p?.slug) slugs.add(p.slug);
  }

  for (const p of user?.permissions || []) {
    if (typeof p === 'string') slugs.add(p);
    else if (p && typeof p === 'object' && 'slug' in p && p.slug) slugs.add(p.slug);
  }

  // JWT payload may already carry permissions
  for (const p of user?.tokenPermissions || []) {
    if (typeof p === 'string') slugs.add(p);
  }

  return slugs;
}

/**
 * Require a specific permission slug (role permissions + user overrides).
 */
export function requirePermission(...permissionSlugs: Array<string | string[]>): RequestHandler {
  const required = permissionSlugs.flat().filter(Boolean);

  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ApiError.unauthorized(MESSAGES.UNAUTHORIZED));
    }

    const roleSlug =
      typeof req.user.role === 'string'
        ? req.user.role
        : req.user.role && typeof req.user.role === 'object' && 'slug' in req.user.role
          ? req.user.role.slug || null
          : null;

    if (roleSlug === ROLES.SUPER_ADMIN) {
      return next();
    }

    if (req.tokenPayload?.permissions?.length) {
      req.user.tokenPermissions = req.tokenPayload.permissions;
    }

    const owned = collectUserPermissionSlugs(req.user);
    const ok = required.every((slug) => owned.has(slug));

    if (!ok) {
      return next(ApiError.forbidden(MESSAGES.FORBIDDEN));
    }

    return next();
  };
}

/**
 * Require any one of the listed permissions.
 */
export function requireAnyPermission(...permissionSlugs: Array<string | string[]>): RequestHandler {
  const required = permissionSlugs.flat().filter(Boolean);

  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ApiError.unauthorized(MESSAGES.UNAUTHORIZED));
    }

    const roleSlug =
      typeof req.user.role === 'string'
        ? req.user.role
        : req.user.role && typeof req.user.role === 'object' && 'slug' in req.user.role
          ? req.user.role.slug || null
          : null;

    if (roleSlug === ROLES.SUPER_ADMIN) {
      return next();
    }

    if (req.tokenPayload?.permissions?.length) {
      req.user.tokenPermissions = req.tokenPayload.permissions;
    }

    const owned = collectUserPermissionSlugs(req.user);
    const ok = required.some((slug) => owned.has(slug));

    if (!ok) {
      return next(ApiError.forbidden(MESSAGES.FORBIDDEN));
    }

    return next();
  };
}

export const permissionMiddleware = requirePermission;
export default requirePermission;
