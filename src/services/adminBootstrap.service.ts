import { createPlatformAdmin } from '../bootstrap/createPlatformAdmin.js';
import type { RequestContext } from '../types/common.js';
import type { UserRepository } from '../repositories/user.repository.js';
import type { RoleRepository } from '../repositories/role.repository.js';
import type { PermissionRepository } from '../repositories/permission.repository.js';
import type { AuditRepository } from '../repositories/audit.repository.js';
import type { CreatePlatformAdminInput } from '../bootstrap/createPlatformAdmin.js';

export interface AdminBootstrapServiceDeps {
  userRepository: UserRepository;
  roleRepository: RoleRepository;
  permissionRepository: PermissionRepository;
  auditRepository: AuditRepository;
}

export class AdminBootstrapService {
  private deps: AdminBootstrapServiceDeps;

  constructor(deps: AdminBootstrapServiceDeps) {
    this.deps = deps;
  }

  async registerAdmin(input: CreatePlatformAdminInput, context: RequestContext = {}) {
    const result = await createPlatformAdmin(
      {
        userRepository: this.deps.userRepository,
        roleRepository: this.deps.roleRepository,
        permissionRepository: this.deps.permissionRepository,
      },
      input,
    );

    await this.deps.auditRepository?.log({
      actor: result.user._id || result.user.id,
      action: 'admin.register_bootstrap',
      resource: 'user',
      resourceId: result.user._id || result.user.id,
      meta: { created: result.created, forceUpdated: result.forceUpdated, email: input.email },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return result;
  }
}

export default AdminBootstrapService;
