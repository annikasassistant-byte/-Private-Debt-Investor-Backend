import crypto from 'node:crypto';

/**
 * Build a plain user payload for tests / seeding (not persisted).
 * @param {Partial<object>} overrides
 */
export function buildUser(overrides = {}) {
  const id = crypto.randomBytes(3).toString('hex');
  return {
    email: overrides.email || `user.${id}@example.com`,
    password: overrides.password || 'Password123!',
    firstName: overrides.firstName || 'Test',
    lastName: overrides.lastName || 'User',
    phone: overrides.phone || null,
    avatar: overrides.avatar || null,
    emailVerified: overrides.emailVerified ?? false,
    phoneVerified: overrides.phoneVerified ?? false,
    isActive: overrides.isActive ?? true,
    role: overrides.role || null,
    permissions: overrides.permissions || [],
    ...overrides,
  };
}

/**
 * Persist a user via repository.
 * @param {import('../repositories/user.repository.js').UserRepository} userRepository
 * @param {Partial<object>} overrides
 */
export async function createUser(userRepository, overrides = {}) {
  const payload = buildUser(overrides);
  if (!payload.role) {
    throw new Error('createUser requires overrides.role (Role ObjectId)');
  }
  return userRepository.create(payload);
}

/**
 * Create many users.
 */
export async function createUsers(userRepository, count = 5, overrides = {}) {
  const users = [];
  for (let i = 0; i < count; i += 1) {
    users.push(
      await createUser(userRepository, {
        ...overrides,
        email: overrides.email || `user.${i}.${crypto.randomBytes(2).toString('hex')}@example.com`,
        firstName: overrides.firstName || `User${i}`,
      }),
    );
  }
  return users;
}

export const userFactory = { build: buildUser, create: createUser, createMany: createUsers };
export default userFactory;
