import crypto from 'node:crypto';
import { ApiError } from '../utils/ApiError.js';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { redisIncr, redisDel, redisTtl, redisGet } from '../utils/redis.helper.js';
import { CACHE_KEYS } from '../constants/cacheKeys.js';
import { ROLES } from '../enums/roles.js';

export class AuthService {
  /**
   * @param {{
   *   userRepository: import('../repositories/user.repository.js').UserRepository,
   *   roleRepository: import('../repositories/role.repository.js').RoleRepository,
   *   tokenService: import('./token.service.js').TokenService,
   *   emailService: import('./email.service.js').EmailService,
   *   otpService: import('./otp.service.js').OtpService,
   *   auditRepository: import('../repositories/audit.repository.js').AuditRepository,
   *   notificationService: import('./notification.service.js').NotificationService,
   *   cacheService: import('./cache.service.js').CacheService,
   * }} deps
   */
  constructor(deps) {
    this.users = deps.userRepository;
    this.roles = deps.roleRepository;
    this.tokens = deps.tokenService;
    this.email = deps.emailService;
    this.otp = deps.otpService;
    this.audit = deps.auditRepository;
    this.notifications = deps.notificationService;
    this.cache = deps.cacheService;
  }

  async register(input, context = {}) {
    const email = String(input.email || '').trim().toLowerCase();
    const { password, firstName, lastName, phone } = input;

    if (!email || !password || !firstName || !lastName) {
      throw ApiError.badRequest('email, password, firstName and lastName are required');
    }
    if (password.length < 8) {
      throw ApiError.badRequest('Password must be at least 8 characters');
    }

    await this.#assertNotBruteForced(`register:${context.ip || 'unknown'}`);

    const existing = await this.users.findByEmail(email, { includeDeleted: true });
    if (existing && !existing.isDeleted) {
      throw ApiError.conflict('Email already registered');
    }

    let role = null;
    if (input.roleId) {
      role = await this.roles.findById(input.roleId);
    } else {
      role = await this.roles.findBySlug(input.roleSlug || ROLES.USER);
    }
    if (!role) throw ApiError.badRequest('Default role not found. Seed roles first.');

    const user = await this.users.create({
      email,
      password,
      firstName,
      lastName,
      phone: phone || null,
      role: role._id,
      emailVerified: false,
      isActive: true,
    });

    const verifyToken = await this.tokens.storeEmailVerificationToken(user._id, user.email);
    try {
      await this.email.sendVerification(user, verifyToken);
      await this.email.sendWelcome(user);
    } catch (err) {
      logger.warn('Failed to send registration emails', { message: err.message });
    }

    await this.audit?.log({
      actor: user._id,
      action: 'auth.register',
      resource: 'user',
      resourceId: user._id,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    const populated = await this.users.findByIdWithRole(user._id);
    const authTokens = await this.#issueTokens(populated, context);

    return {
      user: this.#sanitizeUser(populated),
      ...authTokens,
    };
  }

  async login({ email, password, deviceId, deviceName }, context = {}) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail || !password) {
      throw ApiError.badRequest('Email and password are required');
    }

    const bruteKey = `login:${context.ip || 'unknown'}:${normalizedEmail}`;
    await this.#assertNotBruteForced(bruteKey);

    const user = await this.users.findByEmailForAuth(normalizedEmail);
    if (!user) {
      await this.#hitBruteForce(bruteKey);
      throw ApiError.unauthorized('Invalid email or password');
    }

    if (user.isAccountLocked?.() || (user.isLocked && user.lockUntil && user.lockUntil > new Date())) {
      throw ApiError.forbidden('Account is temporarily locked. Try again later.');
    }

    if (!user.isActive) {
      throw ApiError.forbidden('Account is deactivated');
    }

    const valid = await user.correctPassword(password);
    if (!valid) {
      await user.incrementLoginAttempts();
      await this.#hitBruteForce(bruteKey);
      throw ApiError.unauthorized('Invalid email or password');
    }

    await user.resetLoginAttempts();
    await this.#clearBruteForce(bruteKey);

    const resolvedDeviceId = deviceId || crypto.randomUUID();
    user.lastLogin = new Date();
    user.pushLoginHistory({
      ip: context.ip,
      userAgent: context.userAgent,
      deviceId: resolvedDeviceId,
    });

    const tokens = await this.#issueTokens(user, {
      ...context,
      deviceId: resolvedDeviceId,
      deviceName: deviceName || context.deviceName,
    });

    user.upsertDevice({
      deviceId: resolvedDeviceId,
      name: deviceName || context.deviceName || 'Unknown device',
      refreshTokenId: tokens.refreshMeta?.jti || null,
    });
    await user.save({ validateBeforeSave: false });

    await this.audit?.log({
      actor: user._id,
      action: 'auth.login',
      resource: 'user',
      resourceId: user._id,
      ip: context.ip,
      userAgent: context.userAgent,
      meta: { deviceId: resolvedDeviceId },
    });

    return {
      user: this.#sanitizeUser(user),
      ...tokens,
      deviceId: resolvedDeviceId,
    };
  }

  async logout({ accessToken, refreshToken, userId }, context = {}) {
    if (accessToken) await this.tokens.blacklistAccessToken(accessToken);
    if (refreshToken) await this.tokens.revokeRefreshToken(refreshToken);

    await this.audit?.log({
      actor: userId,
      action: 'auth.logout',
      resource: 'user',
      resourceId: userId,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return { success: true };
  }

  async logoutAll(userId, { accessToken } = {}, context = {}) {
    if (accessToken) await this.tokens.blacklistAccessToken(accessToken);
    await this.tokens.revokeAllRefreshTokensForUser(userId);
    await this.users.clearDevices(userId);

    await this.audit?.log({
      actor: userId,
      action: 'auth.logout_all',
      resource: 'user',
      resourceId: userId,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return { success: true };
  }

  async refreshAccessToken(refreshToken, context = {}) {
    if (!refreshToken) throw ApiError.badRequest('Refresh token is required');

    const { payload, refresh } = await this.tokens.rotateRefreshToken(refreshToken, {
      deviceId: context.deviceId,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    const user = await this.users.findByIdWithRole(payload.sub);
    if (!user || !user.isActive) {
      throw ApiError.unauthorized('User not found or inactive');
    }

    const permissionSlugs = this.#collectPermissionSlugs(user);
    const accessToken = this.tokens.generateAccessToken({
      sub: user._id,
      email: user.email,
      role: user.role?.slug || user.role,
      permissions: permissionSlugs,
    });

    if (context.deviceId) {
      user.upsertDevice({
        deviceId: context.deviceId,
        name: context.deviceName,
        refreshTokenId: refresh.jti,
      });
      await user.save({ validateBeforeSave: false });
    }

    return {
      accessToken,
      refreshToken: refresh.token,
      expiresAt: refresh.expiresAt,
      tokenType: 'Bearer',
    };
  }

  async forgotPassword(email, context = {}) {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) throw ApiError.badRequest('Email is required');

    await this.#assertNotBruteForced(`forgot:${context.ip || 'unknown'}`);
    await this.#hitBruteForce(`forgot:${context.ip || 'unknown'}`);

    const user = await this.users.findByEmail(normalized);
    if (user) {
      const token = await this.tokens.storePasswordResetToken(user._id, user.email);
      try {
        await this.email.sendPasswordReset(user, token);
      } catch (err) {
        logger.warn('Failed to send password reset email', { message: err.message });
      }
      await this.audit?.log({
        actor: user._id,
        action: 'auth.forgot_password',
        resource: 'user',
        resourceId: user._id,
        ip: context.ip,
        userAgent: context.userAgent,
      });
    }

    return { success: true, message: 'If that email exists, a reset link has been sent' };
  }

  async resetPassword({ token, password }, context = {}) {
    if (!token || !password) throw ApiError.badRequest('Token and new password are required');
    if (password.length < 8) throw ApiError.badRequest('Password must be at least 8 characters');

    const data = await this.tokens.verifyPasswordResetToken(token);
    const user = await this.users.findByIdForAuth(data.userId);
    if (!user) throw ApiError.notFound('User not found');

    user.password = password;
    await user.save();
    await user.resetLoginAttempts();
    await this.tokens.revokeAllRefreshTokensForUser(user._id);

    await this.audit?.log({
      actor: user._id,
      action: 'auth.reset_password',
      resource: 'user',
      resourceId: user._id,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    await this.notifications?.notify({
      userId: user._id,
      type: 'security',
      title: 'Password reset',
      body: 'Your password was reset successfully.',
    });

    return { success: true };
  }

  async verifyEmail(token, context = {}) {
    const data = await this.tokens.verifyEmailToken(token);
    const user = await this.users.update(data.userId, {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    });
    if (!user) throw ApiError.notFound('User not found');

    await this.audit?.log({
      actor: user._id,
      action: 'auth.verify_email',
      resource: 'user',
      resourceId: user._id,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return { success: true, user: this.#sanitizeUser(user) };
  }

  async resendVerification(email, context = {}) {
    const normalized = String(email || '').trim().toLowerCase();
    const user = await this.users.findByEmail(normalized);
    if (!user) {
      return { success: true, message: 'If that email exists, a verification link has been sent' };
    }
    if (user.emailVerified) {
      throw ApiError.badRequest('Email is already verified');
    }

    await this.#assertNotBruteForced(`verify-resend:${context.ip || 'unknown'}`);
    await this.#hitBruteForce(`verify-resend:${context.ip || 'unknown'}`);

    const token = await this.tokens.storeEmailVerificationToken(user._id, user.email);
    await this.email.sendVerification(user, token);
    return { success: true, message: 'If that email exists, a verification link has been sent' };
  }

  async changePassword(userId, { currentPassword, newPassword }, context = {}) {
    if (!currentPassword || !newPassword) {
      throw ApiError.badRequest('currentPassword and newPassword are required');
    }
    if (newPassword.length < 8) {
      throw ApiError.badRequest('Password must be at least 8 characters');
    }

    const user = await this.users.findByIdForAuth(userId);
    if (!user) throw ApiError.notFound('User not found');

    const valid = await user.correctPassword(currentPassword);
    if (!valid) throw ApiError.unauthorized('Current password is incorrect');

    user.password = newPassword;
    await user.save();
    await this.tokens.revokeAllRefreshTokensForUser(user._id);

    await this.audit?.log({
      actor: userId,
      action: 'auth.change_password',
      resource: 'user',
      resourceId: userId,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return { success: true };
  }

  async #issueTokens(user, context = {}) {
    const permissionSlugs = this.#collectPermissionSlugs(user);
    const accessToken = this.tokens.generateAccessToken({
      sub: user._id,
      email: user.email,
      role: user.role?.slug || user.role,
      permissions: permissionSlugs,
    });

    const refresh = await this.tokens.generateRefreshToken({
      userId: user._id,
      deviceId: context.deviceId || null,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return {
      accessToken,
      refreshToken: refresh.token,
      expiresAt: refresh.expiresAt,
      tokenType: 'Bearer',
      refreshMeta: { jti: refresh.jti, family: refresh.family },
    };
  }

  #collectPermissionSlugs(user) {
    const slugs = new Set();
    for (const p of user.role?.permissions || []) {
      if (p?.slug) slugs.add(p.slug);
    }
    for (const p of user.permissions || []) {
      if (p?.slug) slugs.add(p.slug);
    }
    return [...slugs];
  }

  #sanitizeUser(user) {
    const obj = typeof user.toObject === 'function' ? user.toObject({ virtuals: true }) : { ...user };
    delete obj.password;
    delete obj.twoFactorSecret;
    delete obj.emailVerificationToken;
    delete obj.passwordResetToken;
    return obj;
  }

  async #assertNotBruteForced(key) {
    const redisKey = CACHE_KEYS.RATE_LIMIT('bruteforce', key);
    const attempts = Number((await redisGet(redisKey)) || 0);
    if (attempts >= env.RATE_LIMIT_AUTH_MAX) {
      const ttl = await redisTtl(redisKey);
      throw ApiError.tooManyRequests(
        `Too many attempts. Try again in ${ttl > 0 ? ttl : Math.ceil(env.RATE_LIMIT_AUTH_WINDOW_MS / 1000)} seconds`,
      );
    }
  }

  async #hitBruteForce(key) {
    const redisKey = CACHE_KEYS.RATE_LIMIT('bruteforce', key);
    const windowSec = Math.ceil(env.RATE_LIMIT_AUTH_WINDOW_MS / 1000);
    return redisIncr(redisKey, windowSec);
  }

  async #clearBruteForce(key) {
    await redisDel(CACHE_KEYS.RATE_LIMIT('bruteforce', key));
  }
}

export default AuthService;
