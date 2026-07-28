/**
 * Placeholder migration runner.
 * Usage: npm run migrate
 *
 * Future: load numbered migration files from `src/migrations/` and track
 * applied versions in a `migrations` collection.
 */
import '../config/env.js';
import logger from '../config/logger.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';

/**
 * @typedef {{ id: string, name: string, up: () => Promise<void> }} MigrationStep
 */

/** @type {MigrationStep[]} */
const MIGRATIONS = [
  {
    id: '001',
    name: 'noop-baseline',
    async up() {
      logger.info('Baseline migration — no schema changes');
    },
  },
  {
    id: '002',
    name: 'ensure-indexes-placeholder',
    async up() {
      logger.info('Placeholder: sync indexes via Model.syncIndexes() when models are ready');
    },
  },
];

async function runMigrations() {
  logger.info('Migrate script starting', { steps: MIGRATIONS.length });

  await connectDatabase();

  for (const step of MIGRATIONS) {
    logger.info('Running migration', { id: step.id, name: step.name });
    const started = Date.now();
    await step.up();
    logger.info('Migration completed', {
      id: step.id,
      name: step.name,
      durationMs: Date.now() - started,
    });
  }

  logger.info('All migrations finished', { applied: MIGRATIONS.length });
}

runMigrations()
  .then(async () => {
    await disconnectDatabase();
    process.exit(0);
  })
  .catch(async (err) => {
    logger.error('Migrate script failed', { message: err.message, stack: err.stack });
    try {
      await disconnectDatabase();
    } catch {
      /* ignore */
    }
    process.exit(1);
  });
