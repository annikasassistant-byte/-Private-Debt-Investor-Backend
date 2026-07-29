import type { NextFunction, Request, Response } from 'express';
import env from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { MESSAGES } from '../constants/messages.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { container } from '../di/container.js';
import type { JwtAccessPayload } from '../types/common.js';

/**
 * Extract JWT from Authorization Bearer header or access cookie.
 */
export function extractAccessToken(req: Request): string | null {
  const header = req.headers.authorization || req.headers.Authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    if (token) return token;
  }

  const cookieName = env.ACCESS_COOKIE_NAME || 'access_token';
  if (req.cookies?.[cookieName]) {
    return req.cookies[cookieName];
  }

  return null;
}

/**
 * Authenticate request: verify JWT, check Redis blacklist, load user.
 */
export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = extractAccessToken(req);
  if (!token) {
    throw new ApiError(MESSAGES.TOKEN_MISSING, 401, ERROR_CODES.TOKEN_MISSING);
  }

  const { tokenService, userRepository } = container;

  const blacklisted = await tokenService.isAccessTokenBlacklisted(token);
  if (blacklisted) {
    throw ApiError.unauthorized(MESSAGES.TOKEN_INVALID);
  }

  const payload = tokenService.verifyAccessToken(token) as JwtAccessPayload & { userId?: string };
  const userId = payload.sub || payload.userId;
  if (!userId) {
    throw ApiError.unauthorized(MESSAGES.TOKEN_INVALID);
  }

  const user = await userRepository.findByIdWithRole(userId);
  if (!user) {
    throw ApiError.unauthorized(MESSAGES.UNAUTHORIZED);
  }

  if (!user.isActive) {
    throw new ApiError(MESSAGES.ACCOUNT_DISABLED, 403, ERROR_CODES.ACCOUNT_DISABLED);
  }

  if (user.isAccountLocked?.() || (user.isLocked && user.lockUntil && user.lockUntil > new Date())) {
    throw new ApiError(MESSAGES.ACCOUNT_LOCKED, 403, ERROR_CODES.ACCOUNT_LOCKED);
  }

  req.user = user;
  req.accessToken = token;
  req.tokenPayload = payload;
  next();
});

/**
 * Optional auth — attaches user when a valid token is present; never fails for missing token.
 */
export const optionalAuthenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = extractAccessToken(req);
  if (!token) {
    return next();
  }

  try {
    const { tokenService, userRepository } = container;
    const blacklisted = await tokenService.isAccessTokenBlacklisted(token);
    if (blacklisted) return next();

    const payload = tokenService.verifyAccessToken(token) as JwtAccessPayload & { userId?: string };
    const userId = payload.sub || payload.userId;
    if (!userId) return next();

    const user = await userRepository.findByIdWithRole(userId);
    if (user?.isActive) {
      req.user = user;
      req.accessToken = token;
      req.tokenPayload = payload;
    }
  } catch {
    // Ignore invalid tokens for optional auth
  }

  next();
});

/** Alias matching common naming. */
export const authMiddleware = authenticate;
export const protect = authenticate;

export default authenticate;
