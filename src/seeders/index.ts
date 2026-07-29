import { container } from '../di/container.js';
import logger from '../config/logger.js';
import { seedPermissions } from './permission.seeder.js';
import { seedRoles } from './role.seeder.js';
import { seedAdmin } from './admin.seeder.js';
import { seedDomain } from './domain.seeder.js';

/**
 * Run all seeders in order.
 * @param {{ container?: import('../di/container.js').Container, admin?: object, domain?: object|false }} [options]
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

  let domain = null;
  if (options.domain !== false) {
    domain = await seedDomain(
      {
        investorService: c.investorService,
        investmentService: c.investmentService,
        investorRepository: c.investorRepository,
        roleRepository: c.roleRepository,
      },
      options.domain || {},
    );
  }

  logger.info('Seeders completed', {
    permissions: permissions.length,
    roles: roles.length,
    admin: admin.email,
    domainInvestor: domain?.investor?.email || domain?.investor?.id,
  });

  return { permissions, roles, admin, domain };
}

export { seedPermissions, seedRoles, seedAdmin, seedDomain };
export default runSeeders;
