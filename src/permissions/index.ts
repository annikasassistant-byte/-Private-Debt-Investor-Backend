import { PERMISSIONS as ENUM_PERMISSIONS, ROLE_PERMISSIONS } from '../enums/permissions.js';
import { ROLES } from '../enums/roles.js';

/**
 * Extended RBAC permission matrix for Mongo-backed Permission documents.
 * Merges enum permissions with additional CRUD/manage/export/list slugs.
 */

export const RESOURCES = {
  USER: 'user',
  ROLE: 'role',
  PERMISSION: 'permission',
  PROFILE: 'profile',
  DASHBOARD: 'dashboard',
  AUDIT: 'audit',
  SETTINGS: 'settings',
  FILE: 'file',
  SYSTEM: 'system',
};

export const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  MANAGE: 'manage',
  EXPORT: 'export',
  ASSIGN: 'assign',
};

/** Canonical permission slugs (enum + extras). */
export const PERMISSIONS = {
  ...ENUM_PERMISSIONS,

  USER_LIST: 'user:list',
  USER_MANAGE: 'user:manage',
  USER_EXPORT: 'user:export',

  ROLE_CREATE: 'role:create',
  ROLE_READ: 'role:read',
  ROLE_UPDATE: 'role:update',
  ROLE_DELETE: 'role:delete',
  ROLE_LIST: 'role:list',
  ROLE_ASSIGN: 'role:assign',
  ROLE_MANAGE: 'role:manage',

  PERMISSION_CREATE: 'permission:create',
  PERMISSION_READ: 'permission:read',
  PERMISSION_UPDATE: 'permission:update',
  PERMISSION_DELETE: 'permission:delete',
  PERMISSION_LIST: 'permission:list',
  PERMISSION_MANAGE: 'permission:manage',

  AUDIT_LIST: 'audit:list',
  SETTINGS_MANAGE: 'settings:manage',
};

/**
 * Seedable permission definitions derived from PERMISSIONS.
 */
export const PERMISSION_DEFINITIONS = Object.values(PERMISSIONS)
  .filter((slug, index, arr) => arr.indexOf(slug) === index)
  .map((slug) => {
    const [resource, action] = slug.split(':');
    return {
      slug,
      resource,
      action,
      name: `${resource} ${action}`,
      description: `Allow ${action} on ${resource}`,
    };
  });

/**
 * Default role → permission slug matrix (seeded into Role.permissions).
 */
export const ROLE_PERMISSION_MATRIX = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS).filter((slug, i, arr) => arr.indexOf(slug) === i),
  [ROLES.INVESTOR]: [
    PERMISSIONS.PROFILE_READ,
    PERMISSIONS.PROFILE_UPDATE,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.DASHBOARD_EXPORT,
    PERMISSIONS.FILE_READ,
  ].filter(Boolean),
};

/**
 * @param {string[]|Set<string>} userPermissions
 * @param {string|string[]} required
 */
export function hasPermission(userPermissions, required) {
  const set = userPermissions instanceof Set ? userPermissions : new Set(userPermissions || []);
  const needed = Array.isArray(required) ? required : [required];
  return needed.every(
    (p) =>
      set.has(p) ||
      set.has(`${String(p).split(':')[0]}:manage`) ||
      set.has(PERMISSIONS.SYSTEM_MANAGE),
  );
}

/**
 * Collect permission slugs from a populated user document.
 */
export function collectUserPermissions(user) {
  const slugs = new Set();
  for (const p of user?.role?.permissions || []) {
    if (typeof p === 'string') slugs.add(p);
    else if (p?.slug) slugs.add(p.slug);
  }
  for (const p of user?.permissions || []) {
    if (typeof p === 'string') slugs.add(p);
    else if (p?.slug) slugs.add(p.slug);
  }
  return [...slugs];
}

export default PERMISSIONS;
