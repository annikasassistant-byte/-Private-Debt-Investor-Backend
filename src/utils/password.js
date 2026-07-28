import bcrypt from 'bcryptjs';
import env from '../config/env.js';

/**
 * Hash a plain-text password.
 * @param {string} plainPassword
 * @param {number} [rounds]
 * @returns {Promise<string>}
 */
export async function hashPassword(plainPassword, rounds = env.BCRYPT_ROUNDS) {
  if (!plainPassword || typeof plainPassword !== 'string') {
    throw new TypeError('Password must be a non-empty string');
  }

  const salt = await bcrypt.genSalt(rounds);
  return bcrypt.hash(plainPassword, salt);
}

/**
 * Compare plain password against a bcrypt hash.
 * @param {string} plainPassword
 * @param {string} hashedPassword
 * @returns {Promise<boolean>}
 */
export async function comparePassword(plainPassword, hashedPassword) {
  if (!plainPassword || !hashedPassword) {
    return false;
  }

  return bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * Synchronous hash (prefer async in request paths).
 * @param {string} plainPassword
 * @param {number} [rounds]
 * @returns {string}
 */
export function hashPasswordSync(plainPassword, rounds = env.BCRYPT_ROUNDS) {
  const salt = bcrypt.genSaltSync(rounds);
  return bcrypt.hashSync(plainPassword, salt);
}

/**
 * Synchronous compare.
 * @param {string} plainPassword
 * @param {string} hashedPassword
 * @returns {boolean}
 */
export function comparePasswordSync(plainPassword, hashedPassword) {
  if (!plainPassword || !hashedPassword) {
    return false;
  }

  return bcrypt.compareSync(plainPassword, hashedPassword);
}

export default {
  hashPassword,
  comparePassword,
  hashPasswordSync,
  comparePasswordSync,
};
