/**
 * Database seed CLI entry.
 * Usage: npm run seed
 * Requires MONGODB_URI (validated via env module when other imports pull config).
 */
import '../config/env.js';
import mongoose from 'mongoose';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { runSeeders } from '../seeders/index.js';

async function main() {
  logger.info('Seed script starting', { uri: env.MONGODB_URI.replace(/\/\/.*@/, '//***@') });

  await connectDatabase();
  const result = await runSeeders({
    admin: {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      firstName: process.env.ADMIN_FIRST_NAME,
      lastName: process.env.ADMIN_LAST_NAME,
    },
  });

  logger.info('Seed script completed', {
    permissions: result.permissions?.length,
    roles: result.roles?.length,
    admin: result.admin?.email,
  });
}

main()
  .then(async () => {
    await disconnectDatabase().catch(() => mongoose.disconnect());
    process.exit(0);
  })
  .catch(async (err) => {
    logger.error('Seed script failed', { message: err.message, stack: err.stack });
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
