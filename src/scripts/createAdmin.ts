/**
 * Create / restore / update the platform admin user.
 *
 * Usage:
 *   npm run create-admin
 *   npm run create-admin -- --email=admin@example.com --password='SecurePass123!'
 *   npm run create-admin -- --email=admin@example.com --password='NewPass123!' --force
 *
 * Env fallbacks: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FIRST_NAME, ADMIN_LAST_NAME
 */
import '../config/env.js';
import mongoose from 'mongoose';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { container } from '../di/container.js';
import { seedPermissions } from '../seeders/permission.seeder.js';
import { seedRoles } from '../seeders/role.seeder.js';
import { seedAdmin } from '../seeders/admin.seeder.js';
import { ROLES } from '../enums/roles.js';

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (let i = 2; i < argv.length; i += 1) {
    const part = argv[i];
    if (!part.startsWith('--')) continue;
    const [key, ...rest] = part.slice(2).split('=');
    if (rest.length) {
      args[key] = rest.join('=');
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  const email = String(args.email || process.env.ADMIN_EMAIL || 'admin@depthdashboard.local')
    .trim()
    .toLowerCase();
  const password = String(args.password || process.env.ADMIN_PASSWORD || 'ChangeMeAdmin123!');
  const firstName = String(args.firstName || process.env.ADMIN_FIRST_NAME || 'System');
  const lastName = String(args.lastName || process.env.ADMIN_LAST_NAME || 'Admin');
  const force = args.force === true || args.force === 'true' || args.force === '1';

  if (env.NODE_ENV === 'production' && password === 'ChangeMeAdmin123!') {
    throw new Error('Refusing to create admin with default password in production');
  }

  logger.info('createAdmin starting', { email, force: Boolean(force) });

  await connectDatabase();

  await seedPermissions({ permissionRepository: container.permissionRepository });
  await seedRoles({
    roleRepository: container.roleRepository,
    permissionRepository: container.permissionRepository,
  });

  const admin = await seedAdmin(
    {
      userRepository: container.userRepository,
      roleRepository: container.roleRepository,
    },
    { email, password, firstName, lastName, roleSlug: ROLES.SUPER_ADMIN },
  );

  if (force) {
    const user = await container.userRepository.findByEmailForAuth(email);
    if (user) {
      user.password = password;
      user.firstName = firstName;
      user.lastName = lastName;
      user.emailVerified = true;
      user.isActive = true;
      await user.save();
      logger.info('Admin password/profile force-updated', { email });
    }
  }

  logger.info('Admin ready', {
    id: String(admin._id),
    email: admin.email,
    role: ROLES.SUPER_ADMIN,
    hint: 'Use this account to sign in via POST /api/v1/auth/login',
  });

  // eslint-disable-next-line no-console
  console.log('\nAdmin credentials');
  // eslint-disable-next-line no-console
  console.log(`  email:    ${email}`);
  // eslint-disable-next-line no-console
  console.log(`  password: ${password}`);
  // eslint-disable-next-line no-console
  console.log('');

  return admin;
}

main()
  .then(async () => {
    await disconnectDatabase().catch(() => mongoose.disconnect());
    process.exit(0);
  })
  .catch(async (err) => {
    logger.error('createAdmin failed', { message: err.message, stack: err.stack });
    try {
      await disconnectDatabase();
    } catch {
      try {
        await mongoose.disconnect();
      } catch {
        /* ignore */
      }
    }
    process.exit(1);
  });
