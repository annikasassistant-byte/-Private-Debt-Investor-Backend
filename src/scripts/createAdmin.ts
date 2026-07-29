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
import logger from '../config/logger.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { container } from '../di/container.js';
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

  logger.info('createAdmin starting', { email, force: Boolean(force) });

  await connectDatabase();

  const result = await container.adminBootstrapService.registerAdmin({
    email,
    password,
    firstName,
    lastName,
    force,
    roleSlug: ROLES.ADMIN,
  });

  logger.info('Admin ready', {
    id: String(result.user._id || result.user.id),
    email: result.user.email,
    role: ROLES.ADMIN,
    created: result.created,
    forceUpdated: result.forceUpdated,
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

  return result;
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
