import { ApiError } from '../utils/ApiError.js';

export class PermissionService {
  /**
   * @param {{
   *   permissionRepository: import('../repositories/permission.repository.js').PermissionRepository,
   *   auditRepository: import('../repositories/audit.repository.js').AuditRepository,
   *   cacheService: import('./cache.service.js').CacheService,
   * }} deps
   */
  constructor(deps) {
    this.permissions = deps.permissionRepository;
    this.audit = deps.auditRepository;
    this.cache = deps.cacheService;
  }

  async createPermission(input, actor = null, context = {}) {
    const resource = String(input.resource || '').trim().toLowerCase();
    const action = String(input.action || '').trim().toLowerCase();
    if (!resource || !action) {
      throw ApiError.badRequest('resource and action are required');
    }

    const slug = (input.slug || `${resource}:${action}`).toLowerCase();
    const existing = await this.permissions.findBySlug(slug, { includeDeleted: true });
    if (existing && !existing.isDeleted) {
      throw ApiError.conflict('Permission already exists');
    }

    const permission = await this.permissions.create(
      {
        name: input.name || `${resource} ${action}`,
        slug,
        resource,
        action,
        description: input.description || '',
      },
      { actor: actor?.id || actor?._id || actor },
    );

    await this.cache.invalidatePattern('permissions:*');
    await this.audit?.log({
      actor: actor?.id || actor?._id || actor,
      action: 'permission.create',
      resource: 'permission',
      resourceId: permission._id,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return permission;
  }

  async getPermissionById(id) {
    const permission = await this.permissions.findById(id);
    if (!permission) throw ApiError.notFound('Permission not found');
    return permission;
  }

  async listPermissions(query = {}) {
    return this.cache.getOrSet(
      `permissions:list:${JSON.stringify(query)}`,
      () =>
        this.permissions.listPermissions({
          page: query.page,
          limit: query.limit,
          sort: query.sort,
          search: query.search,
          resource: query.resource,
          action: query.action,
        }),
      120,
    );
  }

  async updatePermission(id, input, actor = null, context = {}) {
    const permission = await this.permissions.findById(id);
    if (!permission) throw ApiError.notFound('Permission not found');

    const update = {};
    if (input.name !== undefined) update.name = input.name;
    if (input.description !== undefined) update.description = input.description;
    if (input.resource !== undefined) update.resource = String(input.resource).toLowerCase();
    if (input.action !== undefined) update.action = String(input.action).toLowerCase();
    if (input.slug !== undefined) update.slug = String(input.slug).toLowerCase();

    const updated = await this.permissions.update(id, update, {
      actor: actor?.id || actor?._id || actor,
    });

    await this.cache.invalidatePattern('permissions:*');
    await this.audit?.log({
      actor: actor?.id || actor?._id || actor,
      action: 'permission.update',
      resource: 'permission',
      resourceId: id,
      meta: { fields: Object.keys(update) },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return updated;
  }

  async deletePermission(id, actor = null, context = {}) {
    const permission = await this.permissions.findById(id);
    if (!permission) throw ApiError.notFound('Permission not found');

    const deleted = await this.permissions.softDelete(id, actor?.id || actor?._id || actor);
    await this.cache.invalidatePattern('permissions:*');
    await this.audit?.log({
      actor: actor?.id || actor?._id || actor,
      action: 'permission.delete',
      resource: 'permission',
      resourceId: id,
      ip: context.ip,
      userAgent: context.userAgent,
    });
    return deleted;
  }
}

export default PermissionService;
