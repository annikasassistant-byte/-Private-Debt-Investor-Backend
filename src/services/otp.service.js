import crypto from 'node:crypto';
import env from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { redisGet, redisSet, redisDel, redisTtl } from '../utils/redis.helper.js';
import { CACHE_KEYS, CACHE_TTL } from '../constants/cacheKeys.js';

export class OtpService {
  /**
   * @param {{ purpose: string, identifier: string, length?: number, ttlSeconds?: number, meta?: object }} opts
   */
  async generate(opts) {
    const {
      purpose,
      identifier,
      length = env.OTP_LENGTH,
      ttlSeconds = Math.ceil(env.OTP_EXPIRES_MS / 1000) || CACHE_TTL.OTP,
      meta = {},
    } = opts;

    if (!purpose || !identifier) {
      throw ApiError.badRequest('OTP purpose and identifier are required');
    }

    const max = 10 ** length;
    const otp = String(crypto.randomInt(0, max)).padStart(length, '0');
    const key = CACHE_KEYS.OTP(purpose, String(identifier).toLowerCase());

    await redisSet(
      key,
      {
        otp,
        attempts: 0,
        meta,
        createdAt: new Date().toISOString(),
      },
      ttlSeconds,
    );

    return { otp, expiresIn: ttlSeconds, purpose, identifier };
  }

  async verify({ purpose, identifier, otp, maxAttempts = 5 }) {
    if (!purpose || !identifier || !otp) {
      throw ApiError.badRequest('OTP purpose, identifier and code are required');
    }

    const key = CACHE_KEYS.OTP(purpose, String(identifier).toLowerCase());
    const data = await redisGet(key);
    if (!data) throw ApiError.badRequest('OTP expired or not found');

    if (data.attempts >= maxAttempts) {
      await redisDel(key);
      throw ApiError.tooManyRequests('Too many invalid OTP attempts');
    }

    if (String(data.otp) !== String(otp).trim()) {
      data.attempts += 1;
      const ttl = await redisTtl(key);
      await redisSet(key, data, ttl > 0 ? ttl : 60);
      throw ApiError.badRequest('Invalid OTP');
    }

    await redisDel(key);
    return { valid: true, meta: data.meta || {} };
  }

  async invalidate({ purpose, identifier }) {
    return redisDel(CACHE_KEYS.OTP(purpose, String(identifier).toLowerCase()));
  }
}

export default OtpService;
