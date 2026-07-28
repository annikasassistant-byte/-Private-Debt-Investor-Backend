import User from '../models/user.model.js';
import { BaseRepository } from './base.repository.js';

export class UserRepository extends BaseRepository {
  constructor() {
    super(User, 'User');
  }

  async findByEmail(email, options = {}) {
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
  async findByEmailForAuth(email) {
    const normalized = String(email || '').trim().toLowerCase();
    return this.model
      .findOne({ email: normalized })
      .select('+password +twoFactorSecret')
      .populate({ path: 'role', populate: { path: 'permissions' } })
      .populate('permissions')
      .exec();
  }

  async findByIdForAuth(id) {
    return this.model
      .findById(id)
      .select('+password +twoFactorSecret')
      .populate({ path: 'role', populate: { path: 'permissions' } })
      .populate('permissions')
      .exec();
  }

  async findByIdWithRole(id, options = {}) {
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
  } = {}) {
    const filter = {};
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

  async updatePassword(userId, hashedOrPlainPassword, actor = null) {
    const user = await this.findByIdForAuth(userId);
    if (!user) return null;
    user.password = hashedOrPlainPassword;
    if (actor) user.$locals = { actor };
    return user.save();
  }

  async setActive(userId, isActive, actor = null) {
    return this.update(userId, { isActive }, { actor });
  }

  async removeDevice(userId, deviceId) {
    return this.model.findByIdAndUpdate(
      userId,
      { $pull: { devices: { deviceId } } },
      { new: true },
    );
  }

  async clearDevices(userId) {
    return this.model.findByIdAndUpdate(userId, { $set: { devices: [] } }, { new: true });
  }
}

export default UserRepository;
