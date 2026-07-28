import type { Types } from 'mongoose';
import User from '../models/user.model.js';
import { BaseRepository } from './base.repository.js';
import type { RepositoryOptions } from '../types/common.js';
import type { IUser } from '../types/models.js';

type Id = string | Types.ObjectId;

export interface ListUsersOptions {
  page?: number;
  limit?: number;
  sort?: string | Record<string, 1 | -1>;
  search?: string;
  role?: string | Types.ObjectId;
  isActive?: boolean;
  emailVerified?: boolean;
}

export class UserRepository extends BaseRepository<IUser> {
  constructor() {
    super(User as import('mongoose').Model<IUser>, 'User');
  }

  async findByEmail(email: string, options: RepositoryOptions = {}) {
    const normalized = String(email || '').trim().toLowerCase();
    return this.findOne(
      { email: normalized },
      {
        select: options.select,
        populate: options.populate ?? { path: 'role', populate: { path: 'permissions' } },
        includeDeleted: options.includeDeleted,
        lean: options.lean,
      },
    );
  }

  /**
   * Fetch user with password (+ optional 2FA secret) for auth flows.
   */
  async findByEmailForAuth(email: string) {
    const normalized = String(email || '').trim().toLowerCase();
    return this.model
      .findOne({ email: normalized })
      .select('+password +twoFactorSecret')
      .populate({ path: 'role', populate: { path: 'permissions' } })
      .populate('permissions')
      .exec();
  }

  async findByIdForAuth(id: Id) {
    return this.model
      .findById(id)
      .select('+password +twoFactorSecret')
      .populate({ path: 'role', populate: { path: 'permissions' } })
      .populate('permissions')
      .exec();
  }

  async findByIdWithRole(id: Id, options: RepositoryOptions = {}) {
    return this.findById(id, {
      populate: [
        { path: 'role', populate: { path: 'permissions' } },
        { path: 'permissions' },
      ],
      ...options,
    });
  }

  async listUsers({
    page = 1,
    limit = 20,
    sort = '-createdAt',
    search,
    role,
    isActive,
    emailVerified,
  }: ListUsersOptions = {}) {
    const filter: Record<string, unknown> = {};
    if (role) filter.role = role;
    if (typeof isActive === 'boolean') filter.isActive = isActive;
    if (typeof emailVerified === 'boolean') filter.emailVerified = emailVerified;

    return this.findMany(filter, {
      page,
      limit,
      sort,
      search,
      searchFields: ['email', 'firstName', 'lastName', 'phone'],
      populate: [
        { path: 'role', select: 'name slug' },
        { path: 'permissions', select: 'name slug resource action' },
      ],
      select: '-loginHistory -devices',
    });
  }

  async updatePassword(
    userId: Id,
    hashedOrPlainPassword: string,
    actor: string | null = null,
  ) {
    const user = await this.findByIdForAuth(userId);
    if (!user) return null;
    user.password = hashedOrPlainPassword;
    if (actor) user.$locals = { actor };
    return user.save();
  }

  async setActive(userId: Id, isActive: boolean, actor: string | null = null) {
    return this.update(userId, { isActive }, { actor });
  }

  async removeDevice(userId: Id, deviceId: string) {
    return this.model.findByIdAndUpdate(
      userId,
      { $pull: { devices: { deviceId } } },
      { new: true },
    );
  }

  async clearDevices(userId: Id) {
    return this.model.findByIdAndUpdate(userId, { $set: { devices: [] } }, { new: true });
  }
}

export default UserRepository;
