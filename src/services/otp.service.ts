import crypto from 'node:crypto';
import env from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { redisGet, redisSet, redisDel, redisTtl } from '../utils/redis.helper.js';
import { CACHE_KEYS, CACHE_TTL } from '../constants/cacheKeys.js';

/** In-memory fallback when Redis is unavailable (dev / degraded mode). */
const memoryOtps = new Map();

function memoryGet(key) {
  const entry = memoryOtps.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memoryOtps.delete(key);
    return null;
  }
  return entry.data;
}

function memorySet(key, data, ttlSeconds) {
  memoryOtps.set(key, {
    data,
    expiresAt: Date.now() + Math.max(1, ttlSeconds) * 1000,
  });
}

function memoryDel(key) {
  memoryOtps.delete(key);
}

function memoryTtl(key) {
  const entry = memoryOtps.get(key);
  if (!entry) return -1;
  return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
}

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
    const payload = {
      otp,
      attempts: 0,
      meta,
      createdAt: new Date().toISOString(),
    };

    const stored = await redisSet(key, payload, ttlSeconds);
    if (!stored) {
      memorySet(key, payload, ttlSeconds);
    }

    return { otp, expiresIn: ttlSeconds, purpose, identifier };
  }

  async verify({ purpose, identifier, otp, maxAttempts = 5 }) {
    if (!purpose || !identifier || !otp) {
      throw ApiError.badRequest('OTP purpose, identifier and code are required');
    }

    const key = CACHE_KEYS.OTP(purpose, String(identifier).toLowerCase());
    let data = await redisGet(key);
    let fromMemory = false;
    if (!data) {
      data = memoryGet(key);
      fromMemory = Boolean(data);
    }
    if (!data) throw ApiError.badRequest('OTP expired or not found');

    if (data.attempts >= maxAttempts) {
      await redisDel(key);
      memoryDel(key);
      throw ApiError.tooManyRequests('Too many invalid OTP attempts');
    }

    if (String(data.otp) !== String(otp).trim()) {
      data.attempts += 1;
      if (fromMemory) {
        memorySet(key, data, memoryTtl(key) > 0 ? memoryTtl(key) : 60);
      } else {
        const ttl = await redisTtl(key);
        await redisSet(key, data, ttl > 0 ? ttl : 60);
      }
      throw ApiError.badRequest('Invalid OTP');
    }

    await redisDel(key);
    memoryDel(key);
    return { valid: true, meta: data.meta || {} };
  }

  async invalidate({ purpose, identifier }) {
    const key = CACHE_KEYS.OTP(purpose, String(identifier).toLowerCase());
    memoryDel(key);
    return redisDel(key);
  }
}

export default OtpService;
