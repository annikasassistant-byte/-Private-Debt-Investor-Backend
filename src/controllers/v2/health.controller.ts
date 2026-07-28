import env from '../../config/env.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { MESSAGES } from '../../constants/messages.js';

/**
 * API v2 health — versioning example.
 */
export const health = asyncHandler(async (_req, res) => {
  return ApiResponse.ok(
    res,
    {
      status: 'ok',
      version: env.APP_VERSION,
      api: 'v2',
      message: 'Depth Dashboard API version 2',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    MESSAGES.SUCCESS,
  );
});

export default { health };
