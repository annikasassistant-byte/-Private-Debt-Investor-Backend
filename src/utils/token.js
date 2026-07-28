import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import env from '../config/env.js';

/**
 * Generate a cryptographically secure random hex token.
 * @param {number} [bytes=32]
 * @returns {string}
 */
export function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generate a URL-safe random token (base64url).
 * @param {number} [bytes=32]
 * @returns {string}
 */
export function generateUrlSafeToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

/**
 * Generate a numeric OTP of configurable length.
 * @param {number} [length]
 * @returns {string}
 */
export function generateOtp(length = env.OTP_LENGTH) {
  const digits = Math.max(4, Math.min(10, length));
  const max = 10 ** digits;
  const num = crypto.randomInt(0, max);
  return String(num).padStart(digits, '0');
}

/**
 * Hash a token with SHA-256 for safe storage.
 * @param {string} token
 * @returns {string}
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Timing-safe comparison of two strings.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function safeCompare(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));

  if (bufA.length !== bufB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Generate a UUID v4.
 * @returns {string}
 */
export function generateUuid() {
  return uuidv4();
}

/**
 * Generate a password-reset style token pair (raw + hashed).
 * @returns {{ token: string, hashed: string, expiresAt: Date }}
 */
export function generatePasswordResetToken() {
  const token = generateUrlSafeToken(32);
  return {
    token,
    hashed: hashToken(token),
    expiresAt: new Date(Date.now() + env.PASSWORD_RESET_EXPIRES_MS),
  };
}

/**
 * Generate an email-verification token pair.
 * @returns {{ token: string, hashed: string, expiresAt: Date }}
 */
export function generateEmailVerifyToken() {
  const token = generateUrlSafeToken(32);
  return {
    token,
    hashed: hashToken(token),
    expiresAt: new Date(Date.now() + env.EMAIL_VERIFY_EXPIRES_MS),
  };
}

/**
 * Generate OTP with expiry.
 * @param {number} [length]
 * @returns {{ otp: string, hashed: string, expiresAt: Date }}
 */
export function generateOtpWithExpiry(length = env.OTP_LENGTH) {
  const otp = generateOtp(length);
  return {
    otp,
    hashed: hashToken(otp),
    expiresAt: new Date(Date.now() + env.OTP_EXPIRES_MS),
  };
}

export default {
  generateToken,
  generateUrlSafeToken,
  generateOtp,
  hashToken,
  safeCompare,
  generateUuid,
  generatePasswordResetToken,
  generateEmailVerifyToken,
  generateOtpWithExpiry,
};
