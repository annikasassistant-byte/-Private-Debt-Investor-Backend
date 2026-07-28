import { PERMISSIONS, hasPermission, collectUserPermissions } from '../permissions/index.js';

function actorId(actor) {
  return String(actor?.id || actor?._id || actor || '');
}

function targetId(target) {
  return String(target?.id || target?._id || target || '');
}

function perms(actor) {
  if (Array.isArray(actor?.permissionSlugs)) return actor.permissionSlugs;
  if (Array.isArray(actor?.permissions) && typeof actor.permissions[0] === 'string') {
    return actor.permissions;
  }
  return collectUserPermissions(actor);
}

/**
 * @param {object} actor - authenticated user (with role/permissions or permissionSlugs)
 * @param {object|null} target - target user document (null when listing)
 * @param {{ list?: boolean }} [options]
 */
export function canViewUser(actor, target = null, options = {}) {
  if (!actor) return false;
  const permissions = perms(actor);

  if (options.list) {
    return hasPermission(permissions, [PERMISSIONS.USER_LIST]) ||
      hasPermission(permissions, [PERMISSIONS.USER_MANAGE]);
  }

  if (target && actorId(actor) === targetId(target)) return true;

  return hasPermission(permissions, [PERMISSIONS.USER_READ]) ||
    hasPermission(permissions, [PERMISSIONS.USER_MANAGE]);
}

export function canUpdateUser(actor, target) {
  if (!actor || !target) return false;
  if (actorId(actor) === targetId(target)) return true;

  const permissions = perms(actor);
  return hasPermission(permissions, [PERMISSIONS.USER_UPDATE]) ||
    hasPermission(permissions, [PERMISSIONS.USER_MANAGE]);
}

export function canDeleteUser(actor, target) {
  if (!actor || !target) return false;
  // Disallow self-delete via admin policy path (use profile soft-delete separately if desired)
  if (actorId(actor) === targetId(target)) {
    return hasPermission(perms(actor), [PERMISSIONS.USER_DELETE]) ||
      hasPermission(perms(actor), [PERMISSIONS.USER_MANAGE]);
  }

  const permissions = perms(actor);
  return hasPermission(permissions, [PERMISSIONS.USER_DELETE]) ||
    hasPermission(permissions, [PERMISSIONS.USER_MANAGE]);
}

export const userPolicy = {
  canView: canViewUser,
  canUpdate: canUpdateUser,
  canDelete: canDeleteUser,
};

export default userPolicy;
