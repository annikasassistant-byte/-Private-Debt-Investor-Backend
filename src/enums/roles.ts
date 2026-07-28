export const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  USER: 'user',
  GUEST: 'guest',
});

export const ROLE_HIERARCHY = Object.freeze({
  [ROLES.SUPER_ADMIN]: 100,
  [ROLES.ADMIN]: 80,
  [ROLES.MANAGER]: 60,
  [ROLES.USER]: 40,
  [ROLES.GUEST]: 10,
});

/**
 * @param {string} role
 * @param {string} requiredRole
 * @returns {boolean}
 */
export function hasRoleLevel(role, requiredRole) {
  const current = ROLE_HIERARCHY[role] ?? 0;
  const required = ROLE_HIERARCHY[requiredRole] ?? Number.MAX_SAFE_INTEGER;
  return current >= required;
}

export const ROLE_LIST = Object.freeze(Object.values(ROLES));

export default ROLES;
