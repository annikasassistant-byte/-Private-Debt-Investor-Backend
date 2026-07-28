import crypto from 'node:crypto';
import env from '../config/env.js';
import { jwtConfig } from '../config/jwt.js';
import logger from '../config/logger.js';
import { ApiError } from '../utils/ApiError.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken as verifyAccessJwt,
  verifyRefreshToken as verifyRefreshJwt,
  decodeToken,
} from '../utils/jwt.helper.js';
import {
  redisGet,
  redisSet,
  redisDel,
  redisExists,
} from '../utils/redis.helper.js';
import { CACHE_KEYS, CACHE_TTL } from '../constants/cacheKeys.js';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function parseDurationToSeconds(value, fallbackSeconds) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value || typeof value !== 'string') return fallbackSeconds;
  const match = value.trim().match(/^(\d+)(s|m|h|d)?$/i);
  if (!match) return fallbackSeconds;
  const amount = Number(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return amount * (multipliers[unit] || 1);
}

function toApiUnauthorized(err) {
  if (err instanceof ApiError) throw err;
  throw ApiError.unauthorized(err?.message || 'Unauthorized');
}

export class TokenService {
  /**
   * @param {{ refreshTokenRepository?: import('../repositories/refreshToken.repository.js').RefreshTokenRepository }} [deps]
   */
  constructor(deps = {}) {
    this.refreshTokenRepository = deps.refreshTokenRepository || null;
  }

  generateAccessToken(payload) {
    const { token } = signAccessToken({
      sub: String(payload.sub || payload.userId),
      email: payload.email,
      role: payload.role,
      permissions: payload.permissions || [],
    });
    return token;
  }

  async generateRefreshToken({
    userId,
    deviceId = null,
    family = null,
    ip = null,
    userAgent = null,
  }) {
    const tokenFamily = family || crypto.randomUUID();
    const expiresInSeconds = parseDurationToSeconds(jwtConfig.refreshExpiresIn, CACHE_TTL.WEEK);
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    const { token: raw, jti } = signRefreshToken({
      sub: String(userId),
      deviceId,
      family: tokenFamily,
    });

    const tokenHash = hashToken(raw);

    await redisSet(
      CACHE_KEYS.REFRESH_TOKEN(tokenHash),
      {
        userId: String(userId),
        deviceId,
        family: tokenFamily,
        jti,
        expiresAt: expiresAt.toISOString(),
      },
      expiresInSeconds,
    );

    await redisSet(
      `refresh:user:${userId}:${jti}`,
      tokenHash,
      expiresInSeconds,
    );

    let mongoDoc = null;
    if (this.refreshTokenRepository) {
      try {
        mongoDoc = await this.refreshTokenRepository.create({
          userId,
          tokenHash,
          deviceId,
          expiresAt,
          family: tokenFamily,
          ip,
          userAgent,
          revoked: false,
        });
      } catch (err) {
        logger.warn('Failed to persist refresh token to Mongo', { message: err.message });
      }
    }

    return {
      token: raw,
      tokenHash,
      jti,
      family: tokenFamily,
      expiresAt,
      mongoId: mongoDoc?._id || null,
    };
  }

  verifyAccessToken(token) {
    try {
      return verifyAccessJwt(token);
    } catch (err) {
      return toApiUnauthorized(err);
    }
  }

  verifyRefreshToken(token) {
    try {
      return verifyRefreshJwt(token);
    } catch (err) {
      return toApiUnauthorized(err);
    }
  }

  async isAccessTokenBlacklisted(token) {
    const decoded = decodeToken(token);
    if (!decoded || typeof decoded === 'string' || !decoded.jti) return false;
    return redisExists(CACHE_KEYS.ACCESS_BLACKLIST(decoded.jti));
  }

  async blacklistAccessToken(token) {
    const decoded = decodeToken(token);
    if (!decoded || typeof decoded === 'string' || !decoded.jti) return false;

    const expMs = decoded.exp ? decoded.exp * 1000 : Date.now() + 15 * 60 * 1000;
    const ttl = Math.max(1, Math.ceil((expMs - Date.now()) / 1000));
    await redisSet(CACHE_KEYS.ACCESS_BLACKLIST(decoded.jti), '1', ttl);
    return true;
  }

  async revokeRefreshToken(rawToken) {
    const tokenHash = hashToken(rawToken);
    const stored = await redisGet(CACHE_KEYS.REFRESH_TOKEN(tokenHash));
    await redisDel(CACHE_KEYS.REFRESH_TOKEN(tokenHash));

    if (stored?.jti && stored?.userId) {
      await redisDel(`refresh:user:${stored.userId}:${stored.jti}`);
    }

    if (this.refreshTokenRepository) {
      const doc = await this.refreshTokenRepository.findByTokenHash(tokenHash);
      if (doc) await this.refreshTokenRepository.revokeById(doc._id);
    }
  }

  async rotateRefreshToken(rawToken, { deviceId = null, ip = null, userAgent = null } = {}) {
    let payload;
    try {
      payload = verifyRefreshJwt(rawToken);
    } catch (err) {
      toApiUnauthorized(err);
    }

    const tokenHash = hashToken(rawToken);
    const stored = await redisGet(CACHE_KEYS.REFRESH_TOKEN(tokenHash));

    if (!stored) {
      if (payload.family && this.refreshTokenRepository) {
        await this.refreshTokenRepository.revokeFamily(payload.family);
      }
      logger.warn('Refresh token reuse detected', {
        userId: payload.sub,
        family: payload.family,
      });
      throw ApiError.unauthorized('Refresh token reuse detected. Please login again.');
    }

    await redisDel(CACHE_KEYS.REFRESH_TOKEN(tokenHash));
    if (payload.jti) {
      await redisDel(`refresh:user:${payload.sub}:${payload.jti}`);
    }

    if (this.refreshTokenRepository) {
      const doc = await this.refreshTokenRepository.findByTokenHash(tokenHash);
      if (doc) {
        const next = await this.generateRefreshToken({
          userId: payload.sub,
          deviceId: deviceId || payload.deviceId || doc.deviceId,
          family: payload.family || doc.family,
          ip,
          userAgent,
        });
        await this.refreshTokenRepository.revokeById(doc._id, next.tokenHash);
        return { payload, refresh: next };
      }
    }

    const next = await this.generateRefreshToken({
      userId: payload.sub,
      deviceId: deviceId || payload.deviceId,
      family: payload.family,
      ip,
      userAgent,
    });

    return { payload, refresh: next };
  }

  async revokeAllRefreshTokensForUser(userId) {
    const { getRedisClient } = await import('../config/redis.js');
    const client = getRedisClient();
    let cursor = '0';

    do {
      const [nextCursor, keys] = await client.scan(
        cursor,
        'MATCH',
        `refresh:user:${userId}:*`,
        'COUNT',
        100,
      );
      cursor = nextCursor;

      for (const key of keys) {
        const tokenHash = await client.get(key);
        if (tokenHash) {
          await redisDel(CACHE_KEYS.REFRESH_TOKEN(tokenHash));
        }
        await redisDel(key);
      }
    } while (cursor !== '0');

    if (this.refreshTokenRepository) {
      await this.refreshTokenRepository.revokeAllForUser(userId);
    }
  }

  async storeEmailVerificationToken(userId, email) {
    const token = crypto.randomBytes(32).toString('hex');
    const hash = hashToken(token);
    const ttl = Math.ceil(env.EMAIL_VERIFY_EXPIRES_MS / 1000) || CACHE_TTL.EMAIL_VERIFY;

    await redisSet(
      CACHE_KEYS.EMAIL_VERIFY(hash),
      { userId: String(userId), email },
      ttl,
    );
    await redisSet(`emailverify:user:${userId}`, hash, ttl);
    return token;
  }

  async verifyEmailToken(token) {
    const hash = hashToken(token);
    const data = await redisGet(CACHE_KEYS.EMAIL_VERIFY(hash));
    if (!data) throw ApiError.badRequest('Invalid or expired verification token');

    await redisDel(CACHE_KEYS.EMAIL_VERIFY(hash));
    await redisDel(`emailverify:user:${data.userId}`);
    return data;
  }

  async storePasswordResetToken(userId, email) {
    const token = crypto.randomBytes(32).toString('hex');
    const hash = hashToken(token);
    const ttl = Math.ceil(env.PASSWORD_RESET_EXPIRES_MS / 1000) || CACHE_TTL.PASSWORD_RESET;

    const prev = await redisGet(`pwdreset:user:${userId}`);
    if (prev) await redisDel(CACHE_KEYS.PASSWORD_RESET(prev));

    await redisSet(
      CACHE_KEYS.PASSWORD_RESET(hash),
      { userId: String(userId), email },
      ttl,
    );
    await redisSet(`pwdreset:user:${userId}`, hash, ttl);
    return token;
  }

  async verifyPasswordResetToken(token) {
    const hash = hashToken(token);
    const data = await redisGet(CACHE_KEYS.PASSWORD_RESET(hash));
    if (!data) throw ApiError.badRequest('Invalid or expired password reset token');

    await redisDel(CACHE_KEYS.PASSWORD_RESET(hash));
    await redisDel(`pwdreset:user:${data.userId}`);
    return data;
  }

  hashToken = hashToken;
}

export default TokenService;
