import { container } from '../di/container.js';
import logger from '../config/logger.js';
import { seedPermissions } from './permission.seeder.js';
import { seedRoles } from './role.seeder.js';
import { seedAdmin } from './admin.seeder.js';

/**
 * Run all seeders in order.
 * @param {{ container?: import('../di/container.js').Container, admin?: object }} [options]
 */
export async function runSeeders(options = {}) {
  const c = options.container || container;

  logger.info('Starting database seeders');

  const permissions = await seedPermissions({
    permissionRepository: c.permissionRepository,
  });

  const roles = await seedRoles({
    roleRepository: c.roleRepository,
    permissionRepository: c.permissionRepository,
  });

  const admin = await seedAdmin(
    {
      userRepository: c.userRepository,
      roleRepository: c.roleRepository,
    },
    options.admin,
  );

  logger.info('Seeders completed', {
    permissions: permissions.length,
    roles: roles.length,
    admin: admin.email,
  });

  return { permissions, roles, admin };
}

export { seedPermissions, seedRoles, seedAdmin };
export default runSeeders;
