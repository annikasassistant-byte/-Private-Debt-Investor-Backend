import env from '../config/env.js';
import logger from '../config/logger.js';
import { ROLES } from '../enums/roles.js';

/**
 * Seed default admin user.
 * @param {{
 *   userRepository: import('../repositories/user.repository.js').UserRepository,
 *   roleRepository: import('../repositories/role.repository.js').RoleRepository,
 * }} deps
 * @param {{ email?: string, password?: string, firstName?: string, lastName?: string, roleSlug?: string }} [overrides]
 */
export async function seedAdmin(deps, overrides = {}) {
  const { userRepository, roleRepository } = deps;

  const roleSlug = overrides.roleSlug || ROLES.SUPER_ADMIN;
  const adminRole = await roleRepository.findBySlug(roleSlug);
  if (!adminRole) {
    throw new Error(`${roleSlug} role missing. Run role seeder first.`);
  }

  const email = (overrides.email || process.env.ADMIN_EMAIL || 'admin@depthdashboard.local')
    .trim()
    .toLowerCase();
  const password = overrides.password || process.env.ADMIN_PASSWORD || 'ChangeMeAdmin123!';
  const firstName = overrides.firstName || 'System';
  const lastName = overrides.lastName || 'Admin';

  let user = await userRepository.findByEmail(email, { includeDeleted: true });
  if (user && !user.isDeleted) {
    logger.info('Admin user already exists', { email });
    return user;
  }

  if (user?.isDeleted) {
    user = await userRepository.model.restoreById(user._id);
    user.password = password;
    user.role = adminRole._id;
    user.emailVerified = true;
    user.isActive = true;
    await user.save();
    logger.info('Admin user restored', { email });
    return user;
  }

  user = await userRepository.create({
    email,
    password,
    firstName,
    lastName,
    role: adminRole._id,
    emailVerified: true,
    isActive: true,
  });

  logger.info('Admin user seeded', {
    email,
    note: env.NODE_ENV === 'production' ? 'password from env' : 'default password — change immediately',
  });

  return user;
}

export default seedAdmin;
