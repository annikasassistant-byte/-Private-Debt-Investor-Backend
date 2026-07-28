import AuditLog from '../models/auditLog.model.js';
import { BaseRepository } from './base.repository.js';

export class AuditRepository extends BaseRepository {
  constructor() {
    super(AuditLog, 'AuditLog');
  }

  /**
   * @param {{
   *   actor?: string|null,
   *   action: string,
   *   resource: string,
   *   resourceId?: string|null,
   *   meta?: object,
   *   ip?: string|null,
   *   userAgent?: string|null,
   * }} entry
   */
  async log(entry) {
    return this.create({
      actor: entry.actor || null,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId != null ? String(entry.resourceId) : null,
      meta: entry.meta || {},
      ip: entry.ip || null,
      userAgent: entry.userAgent || null,
    });
  }

  async listForResource(resource, resourceId, { page = 1, limit = 50 } = {}) {
    return this.findMany(
      { resource, resourceId: String(resourceId) },
      { page, limit, sort: '-createdAt', populate: { path: 'actor', select: 'email firstName lastName' } },
    );
  }

  async listForActor(actorId, { page = 1, limit = 50 } = {}) {
    return this.findMany(
      { actor: actorId },
      { page, limit, sort: '-createdAt' },
    );
  }
}

export default AuditRepository;
