import Permission from '../models/permission.model.js';
import { BaseRepository } from './base.repository.js';

export class PermissionRepository extends BaseRepository {
  constructor() {
    super(Permission, 'Permission');
  }

  async findBySlug(slug, options = {}) {
    return this.findOne({ slug: String(slug || '').toLowerCase() }, options);
  }

  async findByResourceAction(resource, action, options = {}) {
    return this.findOne(
      {
        resource: String(resource || '').toLowerCase(),
        action: String(action || '').toLowerCase(),
      },
      options,
    );
  }

  async listPermissions({
    page = 1,
    limit = 100,
    sort = 'resource',
    search,
    resource,
    action,
  } = {}) {
    const filter = {};
    if (resource) filter.resource = String(resource).toLowerCase();
    if (action) filter.action = String(action).toLowerCase();

    return this.findMany(filter, {
      page,
      limit,
      sort,
      search,
      searchFields: ['name', 'slug', 'resource', 'action', 'description'],
    });
  }

  async findByIds(ids = []) {
    return this.model.find({ _id: { $in: ids } }).lean().exec();
  }

  async findBySlugs(slugs = []) {
    const normalized = slugs.map((s) => String(s).toLowerCase());
    return this.model.find({ slug: { $in: normalized } }).exec();
  }

  async upsertMany(permissions = [], actor = null) {
    const results = [];
    for (const perm of permissions) {
      const slug = perm.slug || `${perm.resource}:${perm.action}`;
      const doc = await this.model.findOneAndUpdate(
        { slug },
        {
          $set: {
            name: perm.name || slug,
            slug,
            resource: perm.resource,
            action: perm.action,
            description: perm.description || '',
            isDeleted: false,
            deletedAt: null,
            ...(actor ? { updatedBy: actor } : {}),
          },
          $setOnInsert: {
            ...(actor ? { createdBy: actor } : {}),
          },
        },
        { upsert: true, new: true, includeDeleted: true, actor },
      );
      results.push(doc);
    }
    return results;
  }
}

export default PermissionRepository;
