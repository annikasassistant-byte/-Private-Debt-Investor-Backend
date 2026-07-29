import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ApiError } from '../utils/ApiError.js';
import { canViewUser, canUpdateUser, canDeleteUser } from '../policies/user.policy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, '../uploads/avatars');

export class UserService {
  /**
   * @param {{
   *   userRepository: import('../repositories/user.repository.js').UserRepository,
   *   roleRepository: import('../repositories/role.repository.js').RoleRepository,
   *   auditRepository: import('../repositories/audit.repository.js').AuditRepository,
   *   cacheService: import('./cache.service.js').CacheService,
   *   tokenService?: import('./token.service.js').TokenService,
   * }} deps
   */
  constructor(deps) {
    this.users = deps.userRepository;
    this.roles = deps.roleRepository;
    this.audit = deps.auditRepository;
    this.cache = deps.cacheService;
    this.tokens = deps.tokenService || null;
  }

  async getProfile(userId) {
    const cacheKey = `user:profile:${userId}`;
    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const user = await this.users.findByIdWithRole(userId);
        if (!user) throw ApiError.notFound('User not found');
        return this.#sanitize(user);
      },
      60,
    );
  }

  async getUserById(actor, targetId) {
    const target = await this.users.findByIdWithRole(targetId);
    if (!target) throw ApiError.notFound('User not found');
    if (!canViewUser(actor, target)) throw ApiError.forbidden('Cannot view this user');
    return this.#sanitize(target);
  }

  async updateProfile(userId, input, context = {}) {
    const allowed = ['firstName', 'lastName', 'phone', 'avatar', 'notificationPreferences'];
    const update = {};
    for (const key of allowed) {
      if (input[key] !== undefined) update[key] = input[key];
    }
    if (input.notificationPreferences && typeof input.notificationPreferences === 'object') {
      const prefs = input.notificationPreferences;
      update.notificationPreferences = {
        paymentConfirmations: prefs.paymentConfirmations !== false,
        upcomingDueDates: prefs.upcomingDueDates !== false,
        newReports: prefs.newReports !== false,
        platformAnnouncements: prefs.platformAnnouncements !== false,
      };
    }
    if (!Object.keys(update).length) {
      throw ApiError.badRequest('No valid profile fields to update');
    }

    const user = await this.users.update(userId, update, { actor: userId });
    if (!user) throw ApiError.notFound('User not found');

    await this.cache.invalidate(`user:profile:${userId}`);
    await this.audit?.log({
      actor: userId,
      action: 'user.update_profile',
      resource: 'user',
      resourceId: userId,
      meta: { fields: Object.keys(update) },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return this.#sanitize(await this.users.findByIdWithRole(userId));
  }

  async updateNotificationPreferences(userId, prefs, context = {}) {
    return this.updateProfile(userId, { notificationPreferences: prefs }, context);
  }

  /**
   * @param {string} userId
   * @param {{ buffer: Buffer, originalname: string, mimetype: string }} file
   */
  async uploadAvatar(userId, file, context = {}) {
    if (!file?.buffer) throw ApiError.badRequest('Avatar file is required');

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.mimetype)) {
      throw ApiError.badRequest('Avatar must be jpeg, png, webp, or gif');
    }
    if (file.buffer.length > 5 * 1024 * 1024) {
      throw ApiError.badRequest('Avatar must be under 5MB');
    }

    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    const ext = mimeToExt(file.mimetype);
    const filename = `${userId}-${Date.now()}${ext}`;
    const dest = path.join(UPLOADS_DIR, filename);
    await fs.writeFile(dest, file.buffer);

    const avatarUrl = `/uploads/avatars/${filename}`;
    const user = await this.users.update(userId, { avatar: avatarUrl }, { actor: userId });
    if (!user) throw ApiError.notFound('User not found');

    await this.cache.invalidate(`user:profile:${userId}`);
    await this.audit?.log({
      actor: userId,
      action: 'user.upload_avatar',
      resource: 'user',
      resourceId: userId,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return this.#sanitize(user);
  }

  async softDeleteUser(actor, targetId, context = {}) {
    const target = await this.users.findById(targetId);
    if (!target) throw ApiError.notFound('User not found');
    if (!canDeleteUser(actor, target)) throw ApiError.forbidden('Cannot delete this user');

    const deleted = await this.users.softDelete(targetId, actor.id || actor._id);
    if (this.tokens) {
      await this.tokens.revokeAllRefreshTokensForUser(targetId);
    }
    await this.cache.invalidate(`user:profile:${targetId}`);
    await this.cache.invalidatePattern('users:list:*');

    await this.audit?.log({
      actor: actor.id || actor._id,
      action: 'user.soft_delete',
      resource: 'user',
      resourceId: targetId,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return deleted;
  }

  async listUsers(actor, query = {}) {
    if (!canViewUser(actor, null, { list: true })) {
      throw ApiError.forbidden('Cannot list users');
    }

    const cacheKey = `users:list:${JSON.stringify(query)}`;
    return this.cache.getOrSet(
      cacheKey,
      () =>
        this.users.listUsers({
          page: query.page,
          limit: query.limit,
          sort: query.sort,
          search: query.search,
          role: query.role,
          isActive: parseBool(query.isActive),
          emailVerified: parseBool(query.emailVerified),
        }),
      30,
    );
  }

  async adminUpdateUser(actor, targetId, input, context = {}) {
    const target = await this.users.findById(targetId);
    if (!target) throw ApiError.notFound('User not found');
    if (!canUpdateUser(actor, target)) throw ApiError.forbidden('Cannot update this user');

    const update = {};
    const fields = [
      'firstName',
      'lastName',
      'phone',
      'avatar',
      'isActive',
      'emailVerified',
      'phoneVerified',
      'role',
      'permissions',
    ];
    for (const key of fields) {
      if (input[key] !== undefined) update[key] = input[key];
    }

    if (input.roleId) update.role = input.roleId;
    if (input.roleSlug) {
      const role = await this.roles.findBySlug(input.roleSlug);
      if (!role) throw ApiError.badRequest('Role not found');
      update.role = role._id;
    }

    if (!Object.keys(update).length) {
      throw ApiError.badRequest('No valid fields to update');
    }

    const user = await this.users.update(targetId, update, {
      actor: actor.id || actor._id,
      populate: [{ path: 'role', populate: { path: 'permissions' } }, { path: 'permissions' }],
    });

    await this.cache.invalidate(`user:profile:${targetId}`);
    await this.cache.invalidatePattern('users:list:*');

    await this.audit?.log({
      actor: actor.id || actor._id,
      action: 'user.admin_update',
      resource: 'user',
      resourceId: targetId,
      meta: { fields: Object.keys(update) },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return this.#sanitize(user);
  }

  #sanitize(user) {
    const obj =
      typeof user.toObject === 'function' ? user.toObject({ virtuals: true }) : { ...user };
    delete obj.password;
    delete obj.twoFactorSecret;
    delete obj.emailVerificationToken;
    delete obj.passwordResetToken;
    return obj;
  }
}

function mimeToExt(mime) {
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
  };
  return map[mime] || '.bin';
}

function parseBool(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return undefined;
}

export default UserService;
