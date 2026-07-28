import Role from '../models/role.model.js';
import { BaseRepository } from './base.repository.js';

export class RoleRepository extends BaseRepository {
  constructor() {
    super(Role, 'Role');
  }

  async findBySlug(slug, options = {}) {
    return this.findOne(
      { slug: String(slug || '').toLowerCase() },
      {
        populate: options.populate ?? 'permissions',
        includeDeleted: options.includeDeleted,
        lean: options.lean,
      },
    );
  }

  async findByName(name, options = {}) {
    return this.findOne({ name }, options);
  }

  async listRoles({ page = 1, limit = 50, sort = 'name', search, isActive } = {}) {
    const filter = {};
    if (typeof isActive === 'boolean') filter.isActive = isActive;

    return this.findMany(filter, {
      page,
      limit,
      sort,
      search,
      searchFields: ['name', 'slug', 'description'],
      populate: { path: 'permissions', select: 'name slug resource action' },
    });
  }

  async assignPermissions(roleId, permissionIds, actor = null) {
    return this.model
      .findByIdAndUpdate(
        roleId,
        { $set: { permissions: permissionIds, ...(actor ? { updatedBy: actor } : {}) } },
        { new: true, runValidators: true, actor },
      )
      .populate('permissions')
      .exec();
  }

  async addPermissions(roleId, permissionIds, actor = null) {
    return this.model
      .findByIdAndUpdate(
        roleId,
        {
          $addToSet: { permissions: { $each: permissionIds } },
          ...(actor ? { $set: { updatedBy: actor } } : {}),
        },
        { new: true, actor },
      )
      .populate('permissions')
      .exec();
  }

  async removePermissions(roleId, permissionIds, actor = null) {
    return this.model
      .findByIdAndUpdate(
        roleId,
        {
          $pull: { permissions: { $in: permissionIds } },
          ...(actor ? { $set: { updatedBy: actor } } : {}),
        },
        { new: true, actor },
      )
      .populate('permissions')
      .exec();
  }
}

export default RoleRepository;
