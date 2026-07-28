import { ApiError } from '../utils/ApiError.js';

export class RoleService {
  /**
   * @param {{
   *   roleRepository: import('../repositories/role.repository.js').RoleRepository,
   *   permissionRepository: import('../repositories/permission.repository.js').PermissionRepository,
   *   auditRepository: import('../repositories/audit.repository.js').AuditRepository,
   *   cacheService: import('./cache.service.js').CacheService,
   * }} deps
   */
  constructor(deps) {
    this.roles = deps.roleRepository;
    this.permissions = deps.permissionRepository;
    this.audit = deps.auditRepository;
    this.cache = deps.cacheService;
  }

  async createRole(input, actor = null, context = {}) {
    const name = String(input.name || '').trim();
    if (!name) throw ApiError.badRequest('Role name is required');

    const slug =
      input.slug ||
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    const existing = await this.roles.findBySlug(slug, { includeDeleted: true });
    if (existing && !existing.isDeleted) {
      throw ApiError.conflict('Role slug already exists');
    }

    let permissionIds = input.permissions || [];
    if (input.permissionSlugs?.length) {
      const perms = await this.permissions.findBySlugs(input.permissionSlugs);
      permissionIds = perms.map((p) => p._id);
    }

    const role = await this.roles.create(
      {
        name,
        slug,
        description: input.description || '',
        permissions: permissionIds,
        isSystem: Boolean(input.isSystem),
        isActive: input.isActive !== false,
      },
      { actor: actor?.id || actor?._id || actor },
    );

    await this.cache.invalidatePattern('roles:*');
    await this.audit?.log({
      actor: actor?.id || actor?._id || actor,
      action: 'role.create',
      resource: 'role',
      resourceId: role._id,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return this.roles.findById(role._id, { populate: 'permissions' });
  }

  async getRoleById(id) {
    const role = await this.roles.findById(id, { populate: 'permissions' });
    if (!role) throw ApiError.notFound('Role not found');
    return role;
  }

  async listRoles(query = {}) {
    return this.cache.getOrSet(
      `roles:list:${JSON.stringify(query)}`,
      () =>
        this.roles.listRoles({
          page: query.page,
          limit: query.limit,
          sort: query.sort,
          search: query.search,
          isActive: query.isActive,
        }),
      60,
    );
  }

  async updateRole(id, input, actor = null, context = {}) {
    const role = await this.roles.findById(id);
    if (!role) throw ApiError.notFound('Role not found');
    if (role.isSystem && (input.slug || input.isSystem === false)) {
      throw ApiError.forbidden('Cannot modify critical fields on system roles');
    }

    const update = {};
    if (input.name !== undefined) update.name = input.name;
    if (input.slug !== undefined) update.slug = input.slug;
    if (input.description !== undefined) update.description = input.description;
    if (input.isActive !== undefined) update.isActive = input.isActive;
    if (input.permissions !== undefined) update.permissions = input.permissions;

    const updated = await this.roles.update(id, update, {
      actor: actor?.id || actor?._id || actor,
      populate: 'permissions',
    });

    await this.cache.invalidatePattern('roles:*');
    await this.audit?.log({
      actor: actor?.id || actor?._id || actor,
      action: 'role.update',
      resource: 'role',
      resourceId: id,
      meta: { fields: Object.keys(update) },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return updated;
  }

  async deleteRole(id, actor = null, context = {}) {
    const role = await this.roles.findById(id);
    if (!role) throw ApiError.notFound('Role not found');
    if (role.isSystem) throw ApiError.forbidden('Cannot delete system roles');

    const deleted = await this.roles.softDelete(id, actor?.id || actor?._id || actor);
    await this.cache.invalidatePattern('roles:*');
    await this.audit?.log({
      actor: actor?.id || actor?._id || actor,
      action: 'role.delete',
      resource: 'role',
      resourceId: id,
      ip: context.ip,
      userAgent: context.userAgent,
    });
    return deleted;
  }

  async assignPermissions(roleId, permissionIdsOrSlugs, actor = null, context = {}) {
    const role = await this.roles.findById(roleId);
    if (!role) throw ApiError.notFound('Role not found');

    let permissionIds = permissionIdsOrSlugs;
    if (permissionIdsOrSlugs?.length && typeof permissionIdsOrSlugs[0] === 'string' && !permissionIdsOrSlugs[0].match(/^[a-f\d]{24}$/i)) {
      const perms = await this.permissions.findBySlugs(permissionIdsOrSlugs);
      permissionIds = perms.map((p) => p._id);
    }

    const updated = await this.roles.assignPermissions(
      roleId,
      permissionIds,
      actor?.id || actor?._id || actor,
    );

    await this.cache.invalidatePattern('roles:*');
    await this.audit?.log({
      actor: actor?.id || actor?._id || actor,
      action: 'role.assign_permissions',
      resource: 'role',
      resourceId: roleId,
      meta: { permissionIds },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return updated;
  }
}

export default RoleService;
