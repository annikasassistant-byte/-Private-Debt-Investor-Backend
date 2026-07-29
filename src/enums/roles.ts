export const ROLES = Object.freeze({
  ADMIN: 'admin',
  INVESTOR: 'investor',
});

export const ROLE_HIERARCHY = Object.freeze({
  [ROLES.ADMIN]: 100,
  [ROLES.INVESTOR]: 20,
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
