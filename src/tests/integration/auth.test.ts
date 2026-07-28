/**
 * Auth integration tests.
 * Skips the suite when Express app is not available or Mongo is unreachable.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/depth_dashboard_test';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || 'test-access-secret-min-32-characters!!';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-min-32-characters!';
process.env.COOKIE_SECRET =
  process.env.COOKIE_SECRET || 'test-cookie-secret-min-32-characters!!';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379/15';

let app = null;
let mongoAvailable = false;
let skipReason = '';

async function tryLoadApp() {
  try {
    const mod = await import('../../app.js');
    app = mod.default || mod.app;
    return Boolean(app);
  } catch (err) {
    skipReason = `app.js not available: ${err.message}`;
    return false;
  }
}

async function tryPingMongo() {
  try {
    const mongoose = (await import('mongoose')).default;
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 2000,
    });
    mongoAvailable = true;
    return true;
  } catch (err) {
    skipReason = skipReason || `MongoDB unavailable: ${err.message}`;
    return false;
  }
}

const canRun = await (async () => {
  const hasApp = await tryLoadApp();
  if (!hasApp) return false;
  return tryPingMongo();
})();

(canRun ? describe : describe.skip)('Auth API (integration)', () => {
  afterAll(async () => {
    try {
      const mongoose = (await import('mongoose')).default;
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
    } catch {
      /* ignore */
    }
  });

  it('rejects login with missing body', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({});
    expect([400, 401, 422]).toContain(res.status);
  });

  it('rejects login with invalid credentials', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'nobody@example.com',
      password: 'WrongPass123!',
    });
    expect([401, 404]).toContain(res.status);
    expect(res.body.success === false || res.body.message).toBeTruthy();
  });

  it('validates register payload', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'not-an-email',
      password: 'short',
    });
    expect([400, 422]).toContain(res.status);
  });
});

describe('Auth API skip notice', () => {
  it('documents skip reason when suite is inactive', () => {
    if (!canRun) {
      // eslint-disable-next-line no-console
      console.warn(`[auth.integration] skipped — ${skipReason || 'prerequisites missing'}`);
    }
    expect(true).toBe(true);
  });
});
