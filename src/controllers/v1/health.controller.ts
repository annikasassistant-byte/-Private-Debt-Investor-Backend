import env from '../../config/env.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getDatabaseStatus } from '../../config/database.js';
import { pingRedis, isRedisReady } from '../../config/redis.js';
import { MESSAGES } from '../../constants/messages.js';

/**
 * Liveness probe — process is up.
 */
export const live = asyncHandler(async (_req, res) => {
  return ApiResponse.ok(
    res,
    {
      status: 'ok',
      version: env.APP_VERSION,
      api: 'v1',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    MESSAGES.SUCCESS,
  );
});

/**
 * Readiness probe — dependencies reachable.
 */
export const ready = asyncHandler(async (_req, res) => {
  const db = getDatabaseStatus();
  const redis = await pingRedis();

  const healthy = db.connected && redis.ok;
  const payload = {
    status: healthy ? 'ready' : 'degraded',
    version: env.APP_VERSION,
    api: 'v1',
    checks: {
      mongodb: {
        ok: db.connected,
        readyState: db.readyState,
        host: db.host,
        name: db.name,
      },
      redis: {
        ok: redis.ok,
        ready: isRedisReady(),
        latencyMs: redis.latencyMs,
      },
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };

  if (!healthy) {
    return res.status(503).json({
      success: false,
      message: MESSAGES.SERVICE_UNAVAILABLE,
      data: payload,
      timestamp: new Date().toISOString(),
    });
  }

  return ApiResponse.ok(res, payload, MESSAGES.SUCCESS);
});

/**
 * Combined health endpoint.
 */
export const health = asyncHandler(async (req, res) => {
  if (req.query.ready === '1' || req.query.ready === 'true') {
    return ready(req, res);
  }
  return live(req, res);
});

export default {
  live,
  ready,
  health,
};
