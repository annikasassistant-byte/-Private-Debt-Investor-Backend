/**
 * Create / restore the platform admin user.
 * Usage:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='SecurePass123!' node src/scripts/createAdmin.js
 *   npm run create-admin
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

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const part = argv[i];
    if (part.startsWith('--')) {
      const [key, ...rest] = part.slice(2).split('=');
      const value = rest.length ? rest.join('=') : argv[i + 1];
      if (!rest.length) i += 1;
      args[key] = value;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  const email = args.email || process.env.ADMIN_EMAIL || 'admin@depthdashboard.local';
  const password = args.password || process.env.ADMIN_PASSWORD || 'ChangeMeAdmin123!';
  const firstName = args.firstName || process.env.ADMIN_FIRST_NAME || 'System';
  const lastName = args.lastName || process.env.ADMIN_LAST_NAME || 'Admin';

  if (env.NODE_ENV === 'production' && password === 'ChangeMeAdmin123!') {
    throw new Error('Refusing to create admin with default password in production');
  }

  logger.info('createAdmin starting', { email });

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
    { email, password, firstName, lastName },
  );

  logger.info('Admin ready', {
    id: String(admin._id),
    email: admin.email,
    role: admin.role,
  });

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
