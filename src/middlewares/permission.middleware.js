import { ApiError } from '../utils/ApiError.js';
import { MESSAGES } from '../constants/messages.js';
import { ROLES } from '../enums/roles.js';

/**
 * Collect permission slugs from role + user overrides.
 * @param {object} user
 * @returns {Set<string>}
 */
export function collectUserPermissionSlugs(user) {
  const slugs = new Set();

  for (const p of user?.role?.permissions || []) {
    if (typeof p === 'string') slugs.add(p);
    else if (p?.slug) slugs.add(p.slug);
  }

  for (const p of user?.permissions || []) {
    if (typeof p === 'string') slugs.add(p);
    else if (p?.slug) slugs.add(p.slug);
  }

  // JWT payload may already carry permissions
  for (const p of user?.tokenPermissions || []) {
    if (typeof p === 'string') slugs.add(p);
  }

  return slugs;
}

/**
 * Require a specific permission slug (role permissions + user overrides).
 * @param {...string} permissionSlugs
 * @returns {import('express').RequestHandler}
 */
export function requirePermission(...permissionSlugs) {
  const required = permissionSlugs.flat().filter(Boolean);

  return (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized(MESSAGES.UNAUTHORIZED));
    }

    const roleSlug =
      typeof req.user.role === 'string' ? req.user.role : req.user.role?.slug || null;

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
 * @param {...string} permissionSlugs
 * @returns {import('express').RequestHandler}
 */
export function requireAnyPermission(...permissionSlugs) {
  const required = permissionSlugs.flat().filter(Boolean);

  return (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized(MESSAGES.UNAUTHORIZED));
    }

    const roleSlug =
      typeof req.user.role === 'string' ? req.user.role : req.user.role?.slug || null;

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
