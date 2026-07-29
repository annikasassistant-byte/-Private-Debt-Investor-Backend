import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import env from '../config/env.js';
import type { OtpWithExpiry, TokenPairResult } from '../types/common.js';

/**
 * Generate a cryptographically secure random hex token.
 */
export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generate a URL-safe random token (base64url).
 */
export function generateUrlSafeToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/**
 * Generate a numeric OTP of configurable length.
 */
export function generateOtp(length: number = env.OTP_LENGTH): string {
  const digits = Math.max(4, Math.min(10, length));
  const max = 10 ** digits;
  const num = crypto.randomInt(0, max);
  return String(num).padStart(digits, '0');
}

/**
 * Hash a token with SHA-256 for safe storage.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Timing-safe comparison of two strings.
 */
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));

  if (bufA.length !== bufB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Generate a UUID v4.
 */
export function generateUuid(): string {
  return uuidv4();
}

/**
 * Generate a password-reset style token pair (raw + hashed).
 */
export function generatePasswordResetToken(): TokenPairResult {
  const token = generateUrlSafeToken(32);
  return {
    token,
    hashed: hashToken(token),
    expiresAt: new Date(Date.now() + env.PASSWORD_RESET_EXPIRES_MS),
  };
}

/**
 * Generate an email-verification token pair.
 */
export function generateEmailVerifyToken(): TokenPairResult {
  const token = generateUrlSafeToken(32);
  return {
    token,
    hashed: hashToken(token),
    expiresAt: new Date(Date.now() + env.EMAIL_VERIFY_EXPIRES_MS),
  };
}

/**
 * Generate OTP with expiry.
 */
export function generateOtpWithExpiry(length: number = env.OTP_LENGTH): OtpWithExpiry {
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
