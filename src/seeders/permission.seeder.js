import { PERMISSION_DEFINITIONS } from '../permissions/index.js';
import logger from '../config/logger.js';

/**
 * Seed all canonical permissions.
 * @param {{ permissionRepository: import('../repositories/permission.repository.js').PermissionRepository }} deps
 */
export async function seedPermissions(deps) {
  const { permissionRepository } = deps;
  const created = await permissionRepository.upsertMany(PERMISSION_DEFINITIONS);
  logger.info('Permissions seeded', { count: created.length });
  return created;
}

export default seedPermissions;
