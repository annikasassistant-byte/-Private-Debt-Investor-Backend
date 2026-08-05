import crypto from 'node:crypto';
import { ApiError } from '../utils/ApiError.js';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { redisIncr, redisDel, redisTtl, redisGet } from '../utils/redis.helper.js';
import { isRedisReady } from '../config/redis.js';
import { CACHE_KEYS } from '../constants/cacheKeys.js';
import { ROLES } from '../enums/roles.js';
import type { UserRepository } from '../repositories/user.repository.js';
import type { RoleRepository } from '../repositories/role.repository.js';
import type { AuditRepository } from '../repositories/audit.repository.js';
import type { TokenService } from './token.service.js';
import type { EmailService } from './email.service.js';
import type { OtpService } from './otp.service.js';
import type { NotificationService } from './notification.service.js';
import type { CacheService } from './cache.service.js';
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  RequestContext,
  ResetPasswordInput,
} from '../types/common.js';
import type { IPermission, IRole, IUser } from '../types/models.js';

export interface AuthServiceDeps {
  userRepository: UserRepository;
  roleRepository: RoleRepository;
  tokenService: TokenService;
  emailService: EmailService;
  otpService: OtpService;
  auditRepository: AuditRepository;
  notificationService: NotificationService;
  cacheService: CacheService;
}

export interface AuthLogoutInput {
  accessToken?: string | null;
  refreshToken?: string | null;
  userId?: string | import('mongoose').Types.ObjectId | null;
}

export class AuthService {
  private users: UserRepository;
  private roles: RoleRepository;
  private tokens: TokenService;
  private email: EmailService;
  private otp: OtpService;
  private audit: AuditRepository;
  private notifications: NotificationService;
  private cache: CacheService;

  constructor(deps: AuthServiceDeps) {
    this.users = deps.userRepository;
    this.roles = deps.roleRepository;
    this.tokens = deps.tokenService;
    this.email = deps.emailService;
    this.otp = deps.otpService;
    this.audit = deps.auditRepository;
    this.notifications = deps.notificationService;
    this.cache = deps.cacheService;
  }

  async register(input: RegisterInput, context: RequestContext = {}) {
    const email = String(input.email || '')
      .trim()
      .toLowerCase();
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
      role = await this.roles.findBySlug(input.roleSlug || ROLES.INVESTOR);
    }
    if (!role) throw ApiError.badRequest('Default role not found. Seed roles first.');

    const user = (await this.users.create({
      email,
      password,
      firstName,
      lastName,
      phone: phone || null,
      role: role._id,
      emailVerified: false,
      isActive: true,
    })) as unknown as IUser;

    const verifyToken = await this.tokens.storeEmailVerificationToken(user._id, user.email);
    try {
      await this.email.sendVerification(user, verifyToken);
      await this.email.sendWelcome(user);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('Failed to send registration emails', { message });
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
    const authTokens = await this.#issueTokens(populated as IUser | null, context);

    return {
      user: this.#sanitizeUser(populated),
      ...authTokens,
    };
  }

  async login({ email, password, deviceId, deviceName }: LoginInput, context: RequestContext = {}) {
    const normalizedEmail = String(email || '')
      .trim()
      .toLowerCase();
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

    if (
      user.isAccountLocked?.() ||
      (user.isLocked && user.lockUntil && user.lockUntil > new Date())
    ) {
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

  async logout(
    { accessToken, refreshToken, userId }: AuthLogoutInput,
    context: RequestContext = {},
  ) {
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

  async logoutAll(
    userId: string,
    { accessToken }: { accessToken?: string | null } = {},
    context: RequestContext = {},
  ) {
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

  async refreshAccessToken(refreshToken: string, context: RequestContext = {}) {
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
      role: (user.role as IRole | undefined)?.slug || user.role,
      permissions: permissionSlugs,
    });

    if (context.deviceId) {
      user.upsertDevice!({
        deviceId: context.deviceId,
        name: context.deviceName || undefined,
        refreshTokenId: refresh.jti,
      });
      await user.save!({ validateBeforeSave: false });
    }

    return {
      accessToken,
      refreshToken: refresh.token,
      expiresAt: refresh.expiresAt,
      tokenType: 'Bearer',
    };
  }

  async forgotPassword(email: string, context: RequestContext = {}) {
    const normalized = String(email || '')
      .trim()
      .toLowerCase();
    if (!normalized) throw ApiError.badRequest('Email is required');

    await this.#assertNotBruteForced(`forgot:${context.ip || 'unknown'}`);
    await this.#hitBruteForce(`forgot:${context.ip || 'unknown'}`);

    const user = await this.users.findByEmail(normalized);
    if (user) {
      const { otp, expiresIn } = await this.otp.generate({
        purpose: 'password_reset',
        identifier: normalized,
        meta: { userId: String(user._id) },
      });

      try {
        await this.email.sendPasswordResetOtp(user, otp);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn('Failed to send password reset OTP email', { message });
      }

      if (env.NODE_ENV !== 'production') {
        logger.info('Password reset OTP generated (non-production)', {
          email: normalized,
          otp,
          expiresIn,
        });
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

    return {
      success: true,
      message: 'If that email exists, a verification code has been sent',
      expiresIn: Math.ceil(env.OTP_EXPIRES_MS / 1000),
    };
  }

  async verifyPasswordResetOtp(
    { email, otp }: { email: string; otp: string },
    context: RequestContext = {},
  ) {
    const normalized = String(email || '')
      .trim()
      .toLowerCase();
    if (!normalized || !otp) {
      throw ApiError.badRequest('Email and OTP are required');
    }

    await this.#assertNotBruteForced(`otp:${context.ip || 'unknown'}:${normalized}`);

    const user = await this.users.findByEmail(normalized);
    if (!user) {
      await this.#hitBruteForce(`otp:${context.ip || 'unknown'}:${normalized}`);
      throw ApiError.badRequest('Invalid OTP');
    }

    try {
      await this.otp.verify({
        purpose: 'password_reset',
        identifier: normalized,
        otp,
      });
    } catch (err) {
      await this.#hitBruteForce(`otp:${context.ip || 'unknown'}:${normalized}`);
      throw err;
    }

    const resetToken = await this.tokens.storePasswordResetToken(user._id, user.email);

    await this.audit?.log({
      actor: user._id,
      action: 'auth.verify_otp',
      resource: 'user',
      resourceId: user._id,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return {
      success: true,
      email: normalized,
      resetToken,
      expiresIn: Math.ceil(env.PASSWORD_RESET_EXPIRES_MS / 1000),
    };
  }

  async resetPassword(input: ResetPasswordInput, context: RequestContext = {}) {
    const password = input.password;
    if (!password) throw ApiError.badRequest('New password is required');
    if (password.length < 8) throw ApiError.badRequest('Password must be at least 8 characters');

    let userId: string | undefined;

    const resetToken = input.resetToken || input.token;
    if (resetToken) {
      const data = (await this.tokens.verifyPasswordResetToken(resetToken)) as {
        userId: string;
      };
      userId = data.userId;
    } else if (input.email && input.otp) {
      const normalized = String(input.email).trim().toLowerCase();
      await this.otp.verify({
        purpose: 'password_reset',
        identifier: normalized,
        otp: input.otp,
      });
      const userByEmail = await this.users.findByEmail(normalized);
      if (!userByEmail) throw ApiError.notFound('User not found');
      userId = String(userByEmail._id);
    } else {
      throw ApiError.badRequest('Reset token or email + OTP is required');
    }

    const user = await this.users.findByIdForAuth(userId);
    if (!user) throw ApiError.notFound('User not found');

    user.password = password;
    await user.save();
    await user.resetLoginAttempts();
    await this.tokens.revokeAllRefreshTokensForUser(user._id);
    await this.otp.invalidate({
      purpose: 'password_reset',
      identifier: user.email,
    });

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

  async verifyEmail(token: string, context: RequestContext = {}) {
    const data = (await this.tokens.verifyEmailToken(token)) as { userId: string };
    const user = (await this.users.update(data.userId, {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    })) as unknown as IUser | null;
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

  async resendVerification(email: string, context: RequestContext = {}) {
    const normalized = String(email || '')
      .trim()
      .toLowerCase();
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

  async changePassword(
    userId: string,
    { currentPassword, newPassword }: ChangePasswordInput,
    context: RequestContext = {},
  ) {
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

  async #issueTokens(user: IUser | null | undefined, context: RequestContext = {}) {
    const permissionSlugs = this.#collectPermissionSlugs(user);
    const accessToken = this.tokens.generateAccessToken({
      sub: user._id,
      email: user.email,
      role: (user.role as IRole)?.slug || user.role,
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

  #collectPermissionSlugs(user: IUser | null | undefined): string[] {
    const slugs = new Set<string>();
    const role = user?.role as IRole | undefined;
    for (const p of (role?.permissions as IPermission[]) || []) {
      if (p?.slug) slugs.add(p.slug);
    }
    for (const p of (user?.permissions as IPermission[]) || []) {
      if (p?.slug) slugs.add(p.slug);
    }
    return [...slugs];
  }

  #sanitizeUser(user: IUser | Record<string, unknown> | null | undefined): Record<string, unknown> {
    const obj =
      user && typeof (user as IUser).toObject === 'function'
        ? (user as IUser).toObject!({ virtuals: true })
        : { ...(user as Record<string, unknown>) };
    delete obj.password;
    delete obj.twoFactorSecret;
    delete obj.emailVerificationToken;
    delete obj.passwordResetToken;
    return obj;
  }

  async #assertNotBruteForced(key: string): Promise<void> {
    // Fail closed: without Redis we cannot enforce attempt counters reliably.
    if (!isRedisReady()) {
      logger.warn('Auth brute-force check unavailable — Redis not ready', { key });
      throw ApiError.serviceUnavailable(
        'Authentication temporarily unavailable. Please try again shortly.',
      );
    }
    const redisKey = CACHE_KEYS.RATE_LIMIT('bruteforce', key);
    const attempts = Number((await redisGet(redisKey)) || 0);
    if (attempts >= env.RATE_LIMIT_AUTH_MAX) {
      const ttl = await redisTtl(redisKey);
      throw ApiError.tooManyRequests(
        `Too many attempts. Try again in ${ttl > 0 ? ttl : Math.ceil(env.RATE_LIMIT_AUTH_WINDOW_MS / 1000)} seconds`,
      );
    }
  }

  async #hitBruteForce(key: string): Promise<number> {
    if (!isRedisReady()) {
      throw ApiError.serviceUnavailable(
        'Authentication temporarily unavailable. Please try again shortly.',
      );
    }
    const redisKey = CACHE_KEYS.RATE_LIMIT('bruteforce', key);
    const windowSec = Math.ceil(env.RATE_LIMIT_AUTH_WINDOW_MS / 1000);
    return redisIncr(redisKey, windowSec);
  }

  async #clearBruteForce(key: string): Promise<void> {
    await redisDel(CACHE_KEYS.RATE_LIMIT('bruteforce', key));
  }
}

export default AuthService;
