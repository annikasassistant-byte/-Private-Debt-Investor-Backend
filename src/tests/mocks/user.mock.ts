import crypto from 'node:crypto';
import { buildUser } from '../../factories/user.factory.js';

/**
 * Create a mock user document-like object for unit/integration tests.
 * @param {Partial<object>} overrides
 */
export function createMockUser(overrides = {}) {
  const id = overrides._id || overrides.id || crypto.randomBytes(12).toString('hex');

  return {
    _id: id,
    id: String(id),
    ...buildUser(overrides),
    emailVerified: overrides.emailVerified ?? true,
    isActive: overrides.isActive ?? true,
    isDeleted: overrides.isDeleted ?? false,
    deletedAt: overrides.deletedAt ?? null,
    role: overrides.role || {
      _id: crypto.randomBytes(12).toString('hex'),
      slug: 'user',
      name: 'User',
    },
    permissions: overrides.permissions || [],
    createdAt: overrides.createdAt || new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: overrides.updatedAt || new Date('2024-01-01T00:00:00.000Z'),
    toObject() {
      return { ...this };
    },
    toJSON() {
      const obj = { ...this };
      delete obj.password;
      return obj;
    },
  };
}

/**
 * Admin mock user.
 * @param {Partial<object>} overrides
 */
export function createMockAdmin(overrides = {}) {
  return createMockUser({
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    emailVerified: true,
    role: {
      _id: crypto.randomBytes(12).toString('hex'),
      slug: 'super-admin',
      name: 'Super Admin',
    },
    ...overrides,
  });
}

export default {
  createMockUser,
  createMockAdmin,
};
