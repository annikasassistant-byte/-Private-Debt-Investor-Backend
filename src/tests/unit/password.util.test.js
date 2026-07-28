import { describe, it, expect, beforeAll } from '@jest/globals';

// Env must be set before importing modules that parse env
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/depth_dashboard_test';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || 'test-access-secret-min-32-characters!!';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-min-32-characters!';
process.env.COOKIE_SECRET =
  process.env.COOKIE_SECRET || 'test-cookie-secret-min-32-characters!!';

const { hashPassword, comparePassword, hashPasswordSync, comparePasswordSync } = await import(
  '../../utils/password.js'
);

describe('password util', () => {
  const plain = 'SecurePass123!';
  const fastRounds = 4;

  it('hashes and verifies a password asynchronously', async () => {
    const hash = await hashPassword(plain, fastRounds);
    expect(hash).toBeTruthy();
    expect(hash).not.toBe(plain);
    expect(await comparePassword(plain, hash)).toBe(true);
    expect(await comparePassword('wrong-password', hash)).toBe(false);
  });

  it('hashes and verifies synchronously', () => {
    const hash = hashPasswordSync(plain, fastRounds);
    expect(comparePasswordSync(plain, hash)).toBe(true);
    expect(comparePasswordSync('nope', hash)).toBe(false);
  });

  it('rejects empty password on hash', async () => {
    await expect(hashPassword('')).rejects.toThrow(TypeError);
    await expect(hashPassword(null)).rejects.toThrow(TypeError);
  });

  it('comparePassword returns false for missing inputs', async () => {
    expect(await comparePassword('', 'hash')).toBe(false);
    expect(await comparePassword('x', '')).toBe(false);
  });

  it('produces different hashes for the same password (salt)', async () => {
    const a = await hashPassword(plain, fastRounds);
    const b = await hashPassword(plain, fastRounds);
    expect(a).not.toBe(b);
  });
});
