import bcrypt from 'bcryptjs';
import env from '../config/env.js';

/**
 * Hash a plain-text password.
 */
export async function hashPassword(
  plainPassword: string,
  rounds: number = env.BCRYPT_ROUNDS,
): Promise<string> {
  if (!plainPassword || typeof plainPassword !== 'string') {
    throw new TypeError('Password must be a non-empty string');
  }

  const salt = await bcrypt.genSalt(rounds);
  return bcrypt.hash(plainPassword, salt);
}

/**
 * Compare plain password against a bcrypt hash.
 */
export async function comparePassword(
  plainPassword: string,
  hashedPassword: string,
): Promise<boolean> {
  if (!plainPassword || !hashedPassword) {
    return false;
  }

  return bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * Synchronous hash (prefer async in request paths).
 */
export function hashPasswordSync(
  plainPassword: string,
  rounds: number = env.BCRYPT_ROUNDS,
): string {
  const salt = bcrypt.genSaltSync(rounds);
  return bcrypt.hashSync(plainPassword, salt);
}

/**
 * Synchronous compare.
 */
export function comparePasswordSync(plainPassword: string, hashedPassword: string): boolean {
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
