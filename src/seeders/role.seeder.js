import { ROLE_PERMISSION_MATRIX } from '../permissions/index.js';
import { ROLES } from '../enums/roles.js';
import logger from '../config/logger.js';

const ROLE_META = {
  [ROLES.SUPER_ADMIN]: {
    name: 'Super Administrator',
    description: 'Unrestricted system access',
    isSystem: true,
  },
  [ROLES.ADMIN]: {
    name: 'Administrator',
    description: 'Full administrative access',
    isSystem: true,
  },
  [ROLES.MANAGER]: {
    name: 'Manager',
    description: 'Manage users and view audits',
    isSystem: true,
  },
  [ROLES.USER]: {
    name: 'User',
    description: 'Standard authenticated user',
    isSystem: true,
  },
  [ROLES.GUEST]: {
    name: 'Guest',
    description: 'Limited read-only access',
    isSystem: true,
  },
};

/**
 * Seed system roles and assign permissions from matrix.
 * @param {{
 *   roleRepository: import('../repositories/role.repository.js').RoleRepository,
 *   permissionRepository: import('../repositories/permission.repository.js').PermissionRepository,
 * }} deps
 */
export async function seedRoles(deps) {
  const { roleRepository, permissionRepository } = deps;
  const results = [];

  for (const [slug, permissionSlugs] of Object.entries(ROLE_PERMISSION_MATRIX)) {
    const meta = ROLE_META[slug] || { name: slug, description: '', isSystem: true };
    const uniqueSlugs = [...new Set(permissionSlugs)];
    const permissions = await permissionRepository.findBySlugs(uniqueSlugs);
    const permissionIds = permissions.map((p) => p._id);

    let role = await roleRepository.findBySlug(slug, { includeDeleted: true });
    if (role) {
      role = await roleRepository.update(
        role._id,
        {
          name: meta.name,
          description: meta.description,
          permissions: permissionIds,
          isSystem: meta.isSystem,
          isActive: true,
          isDeleted: false,
          deletedAt: null,
        },
        { includeDeleted: true },
      );
    } else {
      role = await roleRepository.create({
        name: meta.name,
        slug,
        description: meta.description,
        permissions: permissionIds,
        isSystem: meta.isSystem,
        isActive: true,
      });
    }

    results.push(role);
    logger.info('Role seeded', { slug, permissions: permissionIds.length });
  }

  return results;
}

export default seedRoles;
