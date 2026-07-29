import { ApiError } from '../utils/ApiError.js';
import { ROLES } from '../enums/roles.js';
import { INVESTOR_STATUS } from '../enums/domain.js';
import { mapInvestor } from '../utils/domain.mappers.js';
import type { InvestorRepository } from '../repositories/domain.repositories.js';
import type { UserRepository } from '../repositories/user.repository.js';
import type { RoleRepository } from '../repositories/role.repository.js';
import type { AuditRepository } from '../repositories/audit.repository.js';
import type { InvestmentRepository } from '../repositories/domain.repositories.js';

export class InvestorService {
  constructor(
    private investors: InvestorRepository,
    private users: UserRepository,
    private roles: RoleRepository,
    private investments: InvestmentRepository,
    private audit: AuditRepository,
  ) {}

  async list(query: Record<string, any> = {}) {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    const result = await this.investors.findMany(filter, {
      page: query.page,
      limit: query.limit,
      sort: query.sort || '-createdAt',
      search: query.search,
      searchFields: ['name', 'email', 'company'],
      lean: true,
    });
    return {
      data: result.data.map(mapInvestor),
      meta: result.meta || result.pagination,
    };
  }

  async getById(id: string) {
    const doc = await this.investors.findById(id);
    if (!doc) throw ApiError.notFound('Investor not found');
    return mapInvestor(doc);
  }

  async getByUserId(userId: string) {
    const doc = await this.investors.findByUserId(userId);
    if (!doc) throw ApiError.notFound('Investor profile not found');
    return mapInvestor(doc);
  }

  async create(input: Record<string, any>, actorId?: string) {
    const email = String(input.email || '')
      .trim()
      .toLowerCase();
    const name = String(input.name || '').trim();
    const password = String(input.password || '');
    if (!email || !name) throw ApiError.badRequest('name and email are required');
    if (password.length < 8) throw ApiError.badRequest('Password must be at least 8 characters');

    const existingInvestor = await this.investors.findByEmail(email, { includeDeleted: true });
    if (existingInvestor && !existingInvestor.isDeleted) {
      throw ApiError.conflict('Investor with this email already exists');
    }

    const existingUser = await this.users.findByEmail(email, { includeDeleted: true });
    if (existingUser && !existingUser.isDeleted) {
      throw ApiError.conflict('A user with this email already exists');
    }

    let role = await this.roles.findBySlug(ROLES.INVESTOR);
    if (!role) {
      // Self-heal: ensure system investor role exists without requiring a manual re-seed mid-request
      role = await this.roles.create({
        name: 'Investor',
        slug: ROLES.INVESTOR,
        description: 'Investor portal access to own data',
        permissions: [],
        isSystem: true,
        isActive: true,
      });
    }

    const parts = name.split(/\s+/);
    const firstName = parts[0] || 'Investor';
    const lastName = parts.slice(1).join(' ') || 'User';

    const user = await this.users.create(
      {
        email,
        password,
        firstName,
        lastName,
        phone: input.phone || null,
        role: role._id,
        emailVerified: true,
        isActive: true,
      },
      { actor: actorId },
    );

    const investor = await this.investors.create(
      {
        user: user._id,
        name,
        email,
        phone: input.phone || '',
        company: input.company || '',
        title: input.title || '',
        status: input.status || INVESTOR_STATUS.ACTIVE,
        joinedAt: new Date(),
      },
      { actor: actorId },
    );

    await this.audit?.log({
      actor: actorId,
      action: 'investor.create',
      resource: 'investor',
      resourceId: investor._id,
    });

    return mapInvestor(investor);
  }

  async update(id: string, input: Record<string, any>, actorId?: string) {
    const allowed = ['name', 'phone', 'company', 'title', 'status', 'notes'];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (input[key] !== undefined) update[key] = input[key];
    }
    if (!Object.keys(update).length) throw ApiError.badRequest('No valid fields to update');

    const doc = await this.investors.update(id, update, { actor: actorId });
    if (!doc) throw ApiError.notFound('Investor not found');

    if (update.name || update.phone) {
      const investor = await this.investors.findById(id);
      if (investor?.user) {
        const nameParts = String(update.name || investor.name).split(/\s+/);
        await this.users.update(
          investor.user,
          {
            ...(update.name
              ? { firstName: nameParts[0], lastName: nameParts.slice(1).join(' ') || 'User' }
              : {}),
            ...(update.phone !== undefined ? { phone: update.phone } : {}),
          },
          { actor: actorId },
        );
      }
    }

    await this.audit?.log({
      actor: actorId,
      action: 'investor.update',
      resource: 'investor',
      resourceId: id,
    });

    return mapInvestor(doc);
  }

  async remove(id: string, actorId?: string) {
    const doc = await this.investors.softDelete(id, actorId);
    if (!doc) throw ApiError.notFound('Investor not found');
    if (doc.user) await this.users.softDelete(doc.user, actorId);
    await this.audit?.log({
      actor: actorId,
      action: 'investor.delete',
      resource: 'investor',
      resourceId: id,
    });
    return { success: true };
  }

  async syncTotals(investorId: string) {
    const result = await this.investments.findMany(
      { investor: investorId, status: { $in: ['active', 'pending', 'matured'] } },
      { limit: 500, page: 1, lean: true },
    );
    const totalInvested = result.data.reduce((s: number, i: any) => s + (i.principal || 0), 0);
    const outstandingBalance = result.data.reduce(
      (s: number, i: any) => s + (i.outstandingBalance || 0),
      0,
    );
    await this.investors.update(investorId, { totalInvested, outstandingBalance });
  }
}
