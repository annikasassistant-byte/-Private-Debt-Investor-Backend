import { ROLES } from './roles.js';

export const PERMISSIONS = Object.freeze({
  USER_READ: 'user:read',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_MANAGE_ROLES: 'user:manage_roles',

  PROFILE_READ: 'profile:read',
  PROFILE_UPDATE: 'profile:update',

  DASHBOARD_READ: 'dashboard:read',
  DASHBOARD_EXPORT: 'dashboard:export',

  SETTINGS_READ: 'settings:read',
  SETTINGS_UPDATE: 'settings:update',

  AUDIT_READ: 'audit:read',
  SYSTEM_MANAGE: 'system:manage',
  FILE_UPLOAD: 'file:upload',
  FILE_DELETE: 'file:delete',
});

export const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),
  [ROLES.ADMIN]: [
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.USER_DELETE,
    PERMISSIONS.USER_MANAGE_ROLES,
    PERMISSIONS.PROFILE_READ,
    PERMISSIONS.PROFILE_UPDATE,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.DASHBOARD_EXPORT,
    PERMISSIONS.SETTINGS_READ,
    PERMISSIONS.SETTINGS_UPDATE,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.FILE_UPLOAD,
    PERMISSIONS.FILE_DELETE,
  ],
  [ROLES.MANAGER]: [
    PERMISSIONS.USER_READ,
    PERMISSIONS.PROFILE_READ,
    PERMISSIONS.PROFILE_UPDATE,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.DASHBOARD_EXPORT,
    PERMISSIONS.SETTINGS_READ,
    PERMISSIONS.FILE_UPLOAD,
  ],
  [ROLES.USER]: [
    PERMISSIONS.PROFILE_READ,
    PERMISSIONS.PROFILE_UPDATE,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.FILE_UPLOAD,
  ],
  [ROLES.GUEST]: [PERMISSIONS.DASHBOARD_READ, PERMISSIONS.PROFILE_READ],
});

/**
 * @param {string} role
 * @returns {string[]}
 */
export function getPermissionsForRole(role) {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * @param {string} role
 * @param {string} permission
 * @returns {boolean}
 */
export function roleHasPermission(role, permission) {
  return getPermissionsForRole(role).includes(permission);
}

export const PERMISSION_LIST = Object.freeze(Object.values(PERMISSIONS));

export default PERMISSIONS;
